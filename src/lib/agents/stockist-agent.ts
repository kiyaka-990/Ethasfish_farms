// The stockist agent - the stock-keeping member of the agentic ERP fleet.
// Staff chat with it from the Stock tab. It answers questions about live
// stock (farm balance, per-outlet balances, per-source harvests) AND can
// record new harvests, distributions and sales on the team's behalf.
//
// Unlike the read-only admin assistant, this agent writes - so its write
// tools go through the exact same src/lib/stock.ts validation and audit
// logging as the Stock tab forms. It can never record something the forms
// would have rejected, and every write is attributable in AuditLog.
import { ToolLoopAgent, tool } from 'ai';
import { z } from 'zod';
import { prisma } from '../prisma';
import { logActivity } from '../audit';
import { fmtKsh } from '../utils';
import {
  getStockSnapshot,
  recordHarvest,
  recordDistribution,
  recordSale,
  SOURCE_TYPES,
  type StockActor,
  type StockSnapshot
} from '../stock';

const MODEL = 'anthropic/claude-haiku-4.5';
const FALLBACK_MODELS = ['openai/gpt-5.4', 'anthropic/claude-sonnet-4.6', 'alibaba/qwen-3-14b'];

const AGENT_ACTOR: StockActor = { type: 'agent', id: 'stockist-agent', name: 'Stockist Agent' };

function buildInstructions() {
  return `You are the Ethasfish Farms stockist agent - an internal tool for staff, not customers.

You keep track of fresh fish stock. The flow: fish are harvested from a source - a numbered cage, a numbered pond, or the hatchery - counted in pieces AND weighed in kg. That becomes farm stock. Farm stock is then distributed to outlets (Kisumu, Nairobi), and sold at those outlets in pieces and/or kilograms.

Always call getStock before answering any question with numbers - never guess or estimate stock, it changes constantly. Use getRecentActivity to show what was recorded recently, and getOutletStock for one outlet's detail.

LOW-STOCK ALERTS: every outlet has a low-stock threshold (in pieces and in kg). Whenever you call getStock or getOutletStock, check lowStockAlerts / the outlet's isLow flag. If any outlet is low, LEAD your reply with the alert - even if the staff member didn't ask about it - e.g. "⚠ Low stock: Kisumu is at 12 pcs (alert set at 30)." Then answer their actual question. Use getLowStock when they ask what needs restocking. A threshold of 0 means that dimension's alert is switched off for that outlet. An outlet that has never received a distribution is simply unstocked (not flagged as low).

You CAN record stock on the team's behalf. When staff ask you to record something, call the matching tool:
- harvested fish -> recordHarvest (needs sourceType, sourceNumber, pieces, weightKg)
- sending fish to an outlet -> recordDistribution (needs outlet, pieces and/or weightKg)
- a sale at an outlet -> recordSale (needs outlet, plus pieces and/or weightKg and the cash amount)

Before writing, make sure you have the essentials: for a harvest, the source number, the piece count AND the weight in kg (both are required - a harvest is always counted and weighed). For distributions and sales you may be given only pieces or only kg; the system derives the other using average weight, but ask for both if you have them, since measured is better than derived.

If a tool returns an error (e.g. not enough stock at that outlet, or the outlet doesn't exist), relay that message plainly and do not retry with invented numbers.

After recording a distribution or a sale, if the tool result says isLow is true for that outlet, mention the alert in your reply so the team knows it needs restocking soon.

Be concise and specific: lead with the numbers, in pieces and kg, using KSh for money. If asked to do something outside stock (cancel an order, change a price, edit products), tell them to use the relevant admin page instead.`;
}

function summarize(s: StockSnapshot) {
  return {
    farmStock: { pieces: s.farm.pieces, kg: s.farm.kg },
    harvestedAllTime: { pieces: s.harvested.pieces, kg: s.harvested.kg, records: s.harvested.count },
    distributedAllTime: { pieces: s.distributed.pieces, kg: s.distributed.kg },
    soldAllTime: { pieces: s.sold.pieces, kg: s.sold.kg, revenue: fmtKsh(s.sold.amountKsh) },
    today: { harvests: s.today.harvests, pieces: s.today.pieces, kg: s.today.kg },
    avgWeightKg: s.avgWeightKg,
    bySource: Object.fromEntries(
      Object.entries(s.byType).map(([k, v]) => [k, { pieces: v.pieces, kg: v.kg, units: v.units, harvests: v.harvests }])
    ),
    outlets: s.outlets.map((o) => ({
      name: o.name,
      inStock: { pieces: o.pieces, kg: o.kg },
      received: { pieces: o.distributedPieces, kg: o.distributedKg },
      sold: { pieces: o.soldPieces, kg: o.soldKg, revenue: fmtKsh(o.revenueKsh) },
      alertAt: { pieces: o.lowStockPieces, kg: o.lowStockKg },
      isLow: o.isLow
    })),
    lowStockAlerts: s.lowStock.outlets.map((o) => ({
      outlet: o.name,
      inStock: { pieces: o.pieces, kg: o.kg },
      alertAt: { pieces: o.lowStockPieces, kg: o.lowStockKg }
    }))
  };
}

function buildTools() {
  return {
    getStock: tool({
      description: 'Get the full current stock picture: farm balance, per-outlet balances, and harvest totals by source (cage/pond/hatchery).',
      inputSchema: z.object({}),
      execute: async () => summarize(await getStockSnapshot())
    }),

    getOutletStock: tool({
      description: 'Get one outlet in detail: what it has in stock, what it received, what it sold, and its revenue.',
      inputSchema: z.object({ outlet: z.string().describe('Outlet name, e.g. "Kisumu" or "Nairobi"') }),
      execute: async ({ outlet }) => {
        const s = await getStockSnapshot();
        const match = s.outlets.find(
          (o) => o.name.toLowerCase() === outlet.trim().toLowerCase() || o.name.toLowerCase().includes(outlet.trim().toLowerCase())
        );
        if (!match) return { found: false, outlets: s.outlets.map((o) => o.name) };
        return {
          found: true,
          name: match.name,
          inStock: { pieces: match.pieces, kg: match.kg },
          received: { pieces: match.distributedPieces, kg: match.distributedKg },
          sold: { pieces: match.soldPieces, kg: match.soldKg, revenue: fmtKsh(match.revenueKsh), transactions: match.salesCount }
        };
      }
    }),

    getLowStock: tool({
      description: 'List outlets whose stock is at or below their low-stock alert threshold, worst first. Check this when asked what needs restocking.',
      inputSchema: z.object({}),
      execute: async () => {
        const s = await getStockSnapshot();
        if (s.lowStock.count === 0) return { anyLow: false, outlets: s.outlets.map((o) => o.name) };
        return {
          anyLow: true,
          outlets: s.lowStock.outlets.map((o) => ({
            name: o.name,
            inStock: { pieces: o.pieces, kg: o.kg },
            alertAt: { pieces: o.lowStockPieces, kg: o.lowStockKg }
          }))
        };
      }
    }),

    getRecentActivity: tool({
      description: 'Get recent harvests, distributions and sales, newest first.',
      inputSchema: z.object({ limit: z.number().min(1).max(25).optional().describe('How many of each to return (default 5)') }),
      execute: async ({ limit }) => {
        const n = limit ?? 5;
        const [harvests, distributions, sales] = await Promise.all([
          prisma.harvest.findMany({ orderBy: { createdAt: 'desc' }, take: n }),
          prisma.stockDistribution.findMany({ orderBy: { createdAt: 'desc' }, take: n, include: { outlet: true } }),
          prisma.outletSale.findMany({ orderBy: { createdAt: 'desc' }, take: n, include: { outlet: true } })
        ]);
        return {
          harvests: harvests.map((h) => ({
            source: h.sourceType === 'hatchery' ? 'Hatchery' : `${h.sourceType} ${h.sourceNumber}`,
            pieces: h.pieces,
            kg: h.weightKg,
            by: h.recordedBy,
            at: h.createdAt
          })),
          distributions: distributions.map((d) => ({ to: d.outlet.name, pieces: d.pieces, kg: d.weightKg, by: d.recordedBy, at: d.createdAt })),
          sales: sales.map((x) => ({
            outlet: x.outlet.name,
            pieces: x.pieces,
            kg: x.weightKg,
            amount: fmtKsh(x.amountKsh),
            channel: x.channel,
            by: x.recordedBy,
            at: x.createdAt
          }))
        };
      }
    }),

    recordHarvest: tool({
      description: 'Record a harvest from a numbered cage, numbered pond, or the hatchery. BOTH pieces and weight in kg are required.',
      inputSchema: z.object({
        sourceType: z.enum(SOURCE_TYPES).describe('cage, pond, or hatchery'),
        sourceNumber: z.string().describe('The cage/pond number, e.g. "3" or "P2". Not needed for hatchery.'),
        pieces: z.number().int().positive().describe('Number of fish counted'),
        weightKg: z.number().positive().describe('Weight on the scales, in kg'),
        note: z.string().optional()
      }),
      execute: async (args) => {
        const result = await recordHarvest(
          {
            sourceType: args.sourceType,
            sourceNumber: args.sourceNumber,
            pieces: args.pieces,
            weightKg: args.weightKg,
            note: args.note ?? null
          },
          AGENT_ACTOR
        );
        if (!result.ok) return { recorded: false, error: result.error };
        return { recorded: true, source: result.record.label, pieces: result.record.pieces, kg: result.record.weightKg };
      }
    }),

    recordDistribution: tool({
      description: 'Send fish from farm stock to an outlet. Give pieces and/or weight in kg.',
      inputSchema: z.object({
        outlet: z.string().describe('Outlet name, e.g. "Kisumu" or "Nairobi"'),
        pieces: z.number().int().min(0).describe('Pieces being sent'),
        weightKg: z.number().min(0).describe('Weight in kg being sent'),
        note: z.string().optional()
      }),
      execute: async (args) => {
        const result = await recordDistribution(
          { outlet: args.outlet, pieces: args.pieces, weightKg: args.weightKg, note: args.note ?? null },
          AGENT_ACTOR
        );
        if (!result.ok) return { recorded: false, error: result.error };
        const after = (await getStockSnapshot()).outlets.find(
          (o) => o.name.toLowerCase() === result.record.outletName.toLowerCase()
        );
        return {
          recorded: true,
          outlet: result.record.outletName,
          pieces: result.record.pieces,
          kg: result.record.weightKg,
          estimated: result.record.estimated,
          outletStockNow: after ? { pieces: after.pieces, kg: after.kg } : undefined,
          isLow: after?.isLow ?? false
        };
      }
    }),

    recordSale: tool({
      description: 'Record a sale at an outlet in pieces and/or kg, with the cash taken.',
      inputSchema: z.object({
        outlet: z.string().describe('Outlet name, e.g. "Kisumu" or "Nairobi"'),
        pieces: z.number().int().min(0).describe('Pieces sold'),
        weightKg: z.number().min(0).describe('Weight in kg sold'),
        amountKsh: z.number().min(0).describe('Cash taken, in KSh'),
        channel: z.enum(['counter', 'wholesale', 'mobile', 'market']).optional(),
        note: z.string().optional()
      }),
      execute: async (args) => {
        const result = await recordSale(
          {
            outlet: args.outlet,
            pieces: args.pieces,
            weightKg: args.weightKg,
            amountKsh: args.amountKsh,
            channel: args.channel ?? 'counter',
            note: args.note ?? null
          },
          AGENT_ACTOR
        );
        if (!result.ok) return { recorded: false, error: result.error };
        const after = (await getStockSnapshot()).outlets.find(
          (o) => o.name.toLowerCase() === result.record.outletName.toLowerCase()
        );
        return {
          recorded: true,
          outlet: result.record.outletName,
          pieces: result.record.pieces,
          kg: result.record.weightKg,
          amount: fmtKsh(result.record.amountKsh),
          estimated: result.record.estimated,
          outletStockNow: after ? { pieces: after.pieces, kg: after.kg } : undefined,
          isLow: after?.isLow ?? false
        };
      }
    })
  };
}

export interface StockistAgentResult {
  text: string;
}

export async function runStockistAgent(message: string): Promise<StockistAgentResult> {
  const agent = new ToolLoopAgent({
    model: MODEL,
    instructions: buildInstructions(),
    tools: buildTools(),
    maxOutputTokens: 700,
    providerOptions: { gateway: { models: FALLBACK_MODELS, tags: ['feature:stockist-agent'] } }
  });

  const result = await agent.generate({ messages: [{ role: 'user', content: message }] });

  const toolCalls = result.steps.flatMap((s) =>
    (s.toolCalls || []).map((tc: any) => ({ tool: tc.toolName, args: tc.input }))
  );

  await prisma.agentRun
    .create({
      data: {
        agentKey: 'stockist-agent',
        input: message,
        output: result.text,
        status: 'completed',
        toolCalls: JSON.stringify(toolCalls),
        model: MODEL,
        tokensUsed: (result.usage?.inputTokens || 0) + (result.usage?.outputTokens || 0)
      }
    })
    .catch(() => {});

  if (toolCalls.length) {
    await logActivity({
      actorType: 'agent',
      actorId: 'stockist-agent',
      actorName: 'Stockist Agent',
      action: 'agent.tool_call',
      summary: `used ${toolCalls.map((t) => t.tool).join(', ')} for a stock question`,
      metadata: { toolCalls }
    });
  }

  return { text: result.text };
}
