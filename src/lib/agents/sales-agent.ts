// The autonomous sales agent - the first of the agentic ERP/CRM fleet.
// It answers customer questions on the live catalog/FAQs, checks order
// status, and captures leads, via real tool calls (not a hardcoded
// price list baked into the prompt), so it's always correct the moment
// an admin edits a product or price. Every run and every tool call is
// written to AgentRun + AuditLog for the secure activity portal.
import { ToolLoopAgent, tool, type ModelMessage } from 'ai';
import { z } from 'zod';
import { prisma } from '../prisma';
import { getBotContext } from '../chatbot';
import { logActivity } from '../audit';
import { fmtKsh } from '../utils';

const MODEL = 'anthropic/claude-haiku-4.5';
// Premium models require AI Gateway credits (a payment method on the
// Vercel team). alibaba/qwen-3-14b supports tool calling and is usable
// on the free Hobby tier, so the agent keeps working as a real
// tool-calling LLM even before the team adds billing - it just
// upgrades to the smarter models automatically once credits are on.
const FALLBACK_MODELS = ['openai/gpt-5.4', 'anthropic/claude-sonnet-4.6', 'alibaba/qwen-3-14b'];

function buildInstructions() {
  return `You are Fin, the AI sales agent for Ethasfish Farms - a Nile Tilapia farm at Othany East, Seme, Kisumu County, Kenya, on Lake Victoria.

Tone: warm, concise (usually under 90 words), Kenyan English. Only answer about Ethasfish Farms and aquaculture topics relevant to it.

Always use the getCatalog tool to check current products, prices and stock before quoting a price - never guess or remember a price, it may have changed. Use checkOrderStatus when a customer gives an order number.

You cannot place an order yourself - orders happen on the website (/shop) or WhatsApp. So whenever a customer shows real buying interest (asks to order, asks about bulk/wholesale, asks for a quote, or says things like "I want to buy"), proactively ASK for their name and phone number (email optional) so the sales team can follow up - don't just wait for them to volunteer it. Once they give you a name and phone or email, call createLead immediately - don't let the conversation end without capturing it if they've shown interest.

Facts you can state without a tool call: hormone-free & chemical-free, zero plastic packaging, fish raised 7-10 months at 4-6.67 fish/m², fed 25% crude protein. Payment via M-Pesa STK push at checkout. Delivery KSh 200 across Kisumu County. Services: Hatchery & Fingerlings, Fish Feeds, Aquaculture Consultancy - details at /services. Order online at /shop. Track orders at /track.

If something is outside what your tools can answer, suggest WhatsApp for a human.`;
}

function buildTools(sessionId: string | undefined) {
  return {
    getCatalog: tool({
      description: 'Get the current live product catalog (prices, variants, stock) and the FAQ knowledge base.',
      inputSchema: z.object({}),
      execute: async () => {
        const ctx = await getBotContext();
        return {
          products: ctx.products.map(p => ({
            name: p.name,
            type: p.type,
            description: p.description,
            variants: p.variants.map(v => ({ label: v.label, weight: v.weight, price: fmtKsh(v.priceKsh), inStock: v.stock > 0, stock: v.stock }))
          })),
          faqs: ctx.faqs.map(f => ({ question: f.question, answer: f.answer, category: f.category }))
        };
      }
    }),
    checkOrderStatus: tool({
      description: 'Look up an order by its order number (format EF-XXXX-XXXX) to tell the customer its status.',
      inputSchema: z.object({ orderNumber: z.string().describe('The order number the customer gave you') }),
      execute: async ({ orderNumber }) => {
        const order = await prisma.order.findUnique({ where: { orderNumber: orderNumber.trim().toUpperCase() }, include: { items: true } });
        if (!order) return { found: false };
        return {
          found: true,
          status: order.status,
          paymentStatus: order.paymentStatus,
          total: fmtKsh(order.total),
          items: order.items.map(i => `${i.quantity}x ${i.productName} (${i.variantLabel})`)
        };
      }
    }),
    createLead: tool({
      description: 'Record a sales lead when a customer shows buying interest and shares contact info, or asks to be contacted by the team.',
      inputSchema: z.object({
        name: z.string(),
        phone: z.string().optional(),
        email: z.string().optional(),
        notes: z.string().describe('Short summary of what they want')
      }),
      execute: async ({ name, phone, email, notes }) => {
        const lead = await prisma.lead.create({ data: { name, phone, email, notes, source: 'sales_agent' } });
        await logActivity({
          actorType: 'agent',
          actorId: 'sales-agent',
          actorName: 'Fin (Sales Agent)',
          action: 'lead.create',
          entityType: 'Lead',
          entityId: lead.id,
          summary: `captured a new lead: ${name}`,
          metadata: { sessionId }
        });
        return { ok: true, leadId: lead.id };
      }
    })
  };
}

export interface SalesAgentResult {
  text: string;
  usedAgent: true;
}

export async function runSalesAgent(messages: ModelMessage[], sessionId?: string): Promise<SalesAgentResult> {
  const agent = new ToolLoopAgent({
    model: MODEL,
    instructions: buildInstructions(),
    tools: buildTools(sessionId),
    maxOutputTokens: 600,
    providerOptions: {
      gateway: {
        models: FALLBACK_MODELS,
        tags: ['feature:sales-chatbot'],
        ...(sessionId ? { user: sessionId } : {})
      }
    }
  });

  const result = await agent.generate({ messages });

  const toolCalls = result.steps.flatMap(s =>
    (s.toolCalls || []).map((tc: any) => ({ tool: tc.toolName, args: tc.input }))
  );

  await prisma.agentRun.create({
    data: {
      agentKey: 'sales-agent',
      sessionId,
      input: messages[messages.length - 1]?.content as any,
      output: result.text,
      status: 'completed',
      toolCalls: JSON.stringify(toolCalls),
      model: MODEL, // requested model - the gateway may have served a fallback if this one was unavailable
      tokensUsed: (result.usage?.inputTokens || 0) + (result.usage?.outputTokens || 0)
    }
  }).catch(() => {});

  if (toolCalls.length) {
    await logActivity({
      actorType: 'agent',
      actorId: 'sales-agent',
      actorName: 'Fin (Sales Agent)',
      action: 'agent.tool_call',
      summary: `used ${toolCalls.map(t => t.tool).join(', ')} answering a customer`,
      metadata: { sessionId, toolCalls }
    });
  }

  return { text: result.text, usedAgent: true };
}
