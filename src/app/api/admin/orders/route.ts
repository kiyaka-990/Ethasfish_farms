import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaff, identityErrorStatus } from '@/lib/identity';
import { logActivity } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await requireStaff();

    const status = req.nextUrl.searchParams.get('status');
    const where: any = {};
    if (status) where.status = status;

    const orders = await prisma.order.findMany({
      where,
      include: { items: true, payments: true },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
    return NextResponse.json({ orders });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: identityErrorStatus(e) });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const staff = await requireStaff();

    const { orderId, status, paymentStatus } = await req.json();
    if (!orderId) return NextResponse.json({ error: 'orderId required' }, { status: 400 });

    const data: any = {};
    if (status) data.status = status;
    if (paymentStatus) data.paymentStatus = paymentStatus;

    const order = await prisma.order.update({ where: { id: orderId }, data });
    await logActivity({
      actorType: 'staff',
      actorId: staff.clerkUserId,
      actorName: staff.name,
      action: 'order.update',
      entityType: 'Order',
      entityId: order.id,
      summary: `updated order ${order.orderNumber}${status ? ` → status: ${status}` : ''}${paymentStatus ? ` → payment: ${paymentStatus}` : ''}`
    });
    return NextResponse.json({ order });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: identityErrorStatus(e) });
  }
}
