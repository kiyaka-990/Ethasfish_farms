import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaff, identityErrorStatus } from '@/lib/identity';
import { logActivity } from '@/lib/audit';
import { fmtKsh } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await requireStaff();

    const status = req.nextUrl.searchParams.get('status');
    const paymentStatus = req.nextUrl.searchParams.get('paymentStatus');
    const paymentMethod = req.nextUrl.searchParams.get('paymentMethod');
    const where: any = {};
    if (status) where.status = status;
    if (paymentStatus) where.paymentStatus = paymentStatus;
    if (paymentMethod) where.paymentMethod = paymentMethod;
    // ?outstanding=1 - orders still owed money on (credit + partially paid).
    // This is the view the Credit ledger and the overdue highlight run off.
    if (req.nextUrl.searchParams.get('outstanding') === '1') {
      where.paymentStatus = { in: ['unpaid', 'partially_paid'] };
      where.status = { not: 'cancelled' };
    }

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

    const { orderId, status, paymentStatus, recordPayment } = await req.json();
    if (!orderId) return NextResponse.json({ error: 'orderId required' }, { status: 400 });

    // Record payment: a customer settling a credit order (fully or in part).
    // Everything happens in one transaction so the Payment row and the order
    // totals can never disagree.
    if (recordPayment) {
      const amount = Math.round(Number(recordPayment.amount));
      const method = recordPayment.method || 'cash';
      if (!amount || amount <= 0) return NextResponse.json({ error: 'amount must be a positive number' }, { status: 400 });
      if (!['cash', 'mpesa', 'bank', 'mobile'].includes(method)) {
        return NextResponse.json({ error: 'method must be cash, mpesa, bank or mobile' }, { status: 400 });
      }

      const order = await prisma.order.findUnique({ where: { id: orderId }, include: { payments: true } });
      if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
      if (order.paymentStatus === 'paid') return NextResponse.json({ error: 'Order is already fully paid' }, { status: 400 });

      const alreadyPaid = order.payments
        .filter(p => p.status === 'success')
        .reduce((sum, p) => sum + p.amount, 0);
      const outstanding = order.total - alreadyPaid;
      if (amount > outstanding) {
        return NextResponse.json({ error: `Amount exceeds the outstanding balance (${fmtKsh(outstanding)})` }, { status: 400 });
      }

      const newPaid = alreadyPaid + amount;
      const newPaymentStatus = newPaid >= order.total ? 'paid' : 'partially_paid';

      const updated = await prisma.$transaction(async (tx) => {
        await tx.payment.create({
          data: {
            orderId: order.id,
            method,
            amount,
            status: 'success',
            reference: recordPayment.reference?.trim() || null
          }
        });
        return tx.order.update({
          where: { id: order.id },
          data: {
            paymentStatus: newPaymentStatus,
            // A credit order flips to 'paid' fulfilment status once settled,
            // mirroring what the M-Pesa callback does for online orders.
            ...(newPaymentStatus === 'paid' && order.status === 'pending' ? { status: 'paid' } : {}),
            ...(newPaymentStatus === 'paid' ? { paidAt: new Date() } : {})
          }
        });
      });

      await logActivity({
        actorType: 'staff',
        actorId: staff.clerkUserId,
        actorName: staff.name,
        action: 'order.record_payment',
        entityType: 'Order',
        entityId: order.id,
        summary: `recorded ${fmtKsh(amount)} ${method} payment for ${order.orderNumber} - ${newPaymentStatus === 'paid' ? 'settled in full' : `${fmtKsh(outstanding - amount)} still owed`}`
      });
      return NextResponse.json({ order: updated });
    }

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
