import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaff, identityErrorStatus } from '@/lib/identity';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireStaff();

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [totalOrders, pendingOrders, paidOrders, monthOrders, totalRevenue, productCount] = await Promise.all([
      prisma.order.count(),
      prisma.order.count({ where: { status: 'pending' } }),
      prisma.order.count({ where: { paymentStatus: 'paid' } }),
      prisma.order.findMany({
        where: { createdAt: { gte: startOfMonth }, paymentStatus: 'paid' },
        select: { total: true }
      }),
      prisma.order.aggregate({ where: { paymentStatus: 'paid' }, _sum: { total: true } }),
      prisma.product.count({ where: { active: true } })
    ]);

    const monthRevenue = monthOrders.reduce((a, o) => a + o.total, 0);

    return NextResponse.json({
      totalOrders,
      pendingOrders,
      paidOrders,
      monthRevenue,
      totalRevenue: totalRevenue._sum.total || 0,
      productCount
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: identityErrorStatus(e) });
  }
}
