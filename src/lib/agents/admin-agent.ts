// The admin/ops assistant - a second agent, separate from the
// customer-facing sales agent (Fin). This one answers STAFF questions
// about the real business: orders, revenue, inventory, leads, products.
// Read-only by design: it can look up anything but cannot create, edit,
// or delete records - staff still do that through the normal admin
// pages, where every change is already audit-logged. If/when write
// actions are wanted here, they need their own explicit tools and the
// same audit trail the rest of the admin API already has.
import { ToolLoopAgent, tool } from 'ai';
import { z } from 'zod';
import { prisma } from '../prisma';
import { fmtKsh } from '../utils';

const MODEL = 'anthropic/claude-haiku-4.5';
const FALLBACK_MODELS = ['openai/gpt-5.4', 'anthropic/claude-sonnet-4.6', 'alibaba/qwen-3-14b'];

const INSTRUCTIONS = `You are the Ethasfish Farms admin assistant - an internal tool for staff, not customers.

Answer questions about the real business using your tools: orders, revenue, inventory, leads, products, expenses. Always call a tool to check current data before answering with numbers - never guess or estimate. Be concise and use KSh for money. If asked to do something you don't have a tool for (e.g. "cancel this order", "change this price"), tell them to do it on the relevant admin page instead - you are read-only.`;

const tools = {
  getOrdersSummary: tool({
    description: 'Get order counts and revenue, optionally filtered to a number of recent days.',
    inputSchema: z.object({ days: z.number().optional().describe('Look back this many days; omit for all-time') }),
    execute: async ({ days }) => {
      const since = days ? new Date(Date.now() - days * 86400000) : undefined;
      const where = since ? { createdAt: { gte: since } } : {};
      const [total, pending, paid, revenue] = await Promise.all([
        prisma.order.count({ where }),
        prisma.order.count({ where: { ...where, status: 'pending' } }),
        prisma.order.count({ where: { ...where, paymentStatus: 'paid' } }),
        prisma.order.aggregate({ where: { ...where, paymentStatus: 'paid' }, _sum: { total: true } })
      ]);
      return { totalOrders: total, pendingOrders: pending, paidOrders: paid, revenue: fmtKsh(revenue._sum.total || 0), periodDays: days || 'all-time' };
    }
  }),
  searchOrder: tool({
    description: 'Look up a specific order by its order number.',
    inputSchema: z.object({ orderNumber: z.string() }),
    execute: async ({ orderNumber }) => {
      const order = await prisma.order.findUnique({ where: { orderNumber: orderNumber.trim().toUpperCase() }, include: { items: true } });
      if (!order) return { found: false };
      return {
        found: true, status: order.status, paymentStatus: order.paymentStatus, customer: order.customerName,
        phone: order.customerPhone, total: fmtKsh(order.total), items: order.items.map(i => `${i.quantity}x ${i.productName} (${i.variantLabel})`)
      };
    }
  }),
  getInventoryStatus: tool({
    description: 'Get inventory items, flagging any at or below their reorder level.',
    inputSchema: z.object({}),
    execute: async () => {
      const items = await prisma.inventoryItem.findMany({ where: { active: true } });
      return {
        items: items.map(i => ({ name: i.name, category: i.category, quantity: `${i.quantity} ${i.unit}`, lowStock: i.quantity <= i.reorderLevel })),
        lowStockCount: items.filter(i => i.quantity <= i.reorderLevel).length
      };
    }
  }),
  getProductStock: tool({
    description: 'Get shop product stock levels (fish/feed variants, not raw inventory).',
    inputSchema: z.object({}),
    execute: async () => {
      const products = await prisma.product.findMany({ where: { active: true }, include: { variants: true } });
      return products.map(p => ({ name: p.name, variants: p.variants.map(v => ({ label: v.label, stock: v.stock, price: fmtKsh(v.priceKsh) })) }));
    }
  }),
  getLeadsSummary: tool({
    description: 'Get recent sales leads, optionally filtered by status.',
    inputSchema: z.object({ status: z.enum(['new', 'contacted', 'qualified', 'won', 'lost']).optional() }),
    execute: async ({ status }) => {
      const leads = await prisma.lead.findMany({ where: status ? { status } : {}, orderBy: { createdAt: 'desc' }, take: 20 });
      return { count: leads.length, leads: leads.map(l => ({ name: l.name, phone: l.phone, status: l.status, notes: l.notes, source: l.source })) };
    }
  }),
  getFinancialSummary: tool({
    description: 'Get revenue, expenses, and profit for this month and all-time.',
    inputSchema: z.object({}),
    execute: async () => {
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      async function totals(since?: Date) {
        const [orderRev, invoiceRev, expenses] = await Promise.all([
          prisma.order.aggregate({ _sum: { total: true }, where: { paymentStatus: 'paid', ...(since ? { createdAt: { gte: since } } : {}) } }),
          prisma.invoice.aggregate({ _sum: { total: true }, where: { status: 'paid', ...(since ? { paidAt: { gte: since } } : {}) } }),
          prisma.expense.aggregate({ _sum: { amount: true }, where: since ? { date: { gte: since } } : {} })
        ]);
        const revenue = (orderRev._sum.total || 0) + (invoiceRev._sum.total || 0);
        const expenseTotal = expenses._sum.amount || 0;
        return { revenue: fmtKsh(revenue), expenses: fmtKsh(expenseTotal), profit: fmtKsh(revenue - expenseTotal) };
      }
      const [thisMonth, allTime] = await Promise.all([totals(startOfMonth), totals()]);
      return { thisMonth, allTime };
    }
  })
};

export interface AdminAgentResult { text: string; }

export async function runAdminAgent(message: string): Promise<AdminAgentResult> {
  const agent = new ToolLoopAgent({
    model: MODEL,
    instructions: INSTRUCTIONS,
    tools,
    maxOutputTokens: 500,
    providerOptions: { gateway: { models: FALLBACK_MODELS, tags: ['feature:admin-assistant'] } }
  });
  const result = await agent.generate({ messages: [{ role: 'user', content: message }] });

  const toolCalls = result.steps.flatMap(s => (s.toolCalls || []).map((tc: any) => ({ tool: tc.toolName, args: tc.input })));
  await prisma.agentRun.create({
    data: {
      agentKey: 'admin-agent',
      input: message,
      output: result.text,
      status: 'completed',
      toolCalls: JSON.stringify(toolCalls),
      model: MODEL,
      tokensUsed: (result.usage?.inputTokens || 0) + (result.usage?.outputTokens || 0)
    }
  }).catch(() => {});

  return { text: result.text };
}
