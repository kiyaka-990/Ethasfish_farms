import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaff, identityErrorStatus } from '@/lib/identity';

export const dynamic = 'force-dynamic';

function startOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

async function totals(since?: Date) {
  const [orderRevenue, invoiceRevenue, expenses] = await Promise.all([
    prisma.order.aggregate({ _sum: { total: true }, where: { paymentStatus: 'paid', ...(since ? { createdAt: { gte: since } } : {}) } }),
    prisma.invoice.aggregate({ _sum: { total: true }, where: { status: 'paid', ...(since ? { paidAt: { gte: since } } : {}) } }),
    prisma.expense.aggregate({ _sum: { amount: true }, where: since ? { date: { gte: since } } : {} })
  ]);
  const revenue = (orderRevenue._sum.total || 0) + (invoiceRevenue._sum.total || 0);
  const expenseTotal = expenses._sum.amount || 0;
  return { revenue, expenses: expenseTotal, profit: revenue - expenseTotal };
}

export async function GET() {
  try {
    await requireStaff();
    const [allTime, thisMonth] = await Promise.all([totals(), totals(startOfMonth())]);
    return NextResponse.json({ allTime, thisMonth });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: identityErrorStatus(e) });
  }
}
