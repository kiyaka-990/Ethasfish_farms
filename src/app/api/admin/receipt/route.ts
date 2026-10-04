import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaff, identityErrorStatus } from '@/lib/identity';
import { logActivity } from '@/lib/audit';
import { dispatchReceipt } from '@/lib/receipt';
import { getTaxSettings } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const staff = await requireStaff();

    const { orderId } = await req.json();
    const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    const { kraPin } = await getTaxSettings();
    const result = await dispatchReceipt({
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      orderNumber: order.orderNumber,
      status: order.status,
      items: order.items.map((it: any) => ({
        productName: it.productName,
        variantLabel: it.variantLabel,
        quantity: it.quantity,
        lineTotal: it.lineTotal
      })),
      subtotal: order.subtotal,
      deliveryFee: order.deliveryFee,
      total: order.total,
      mpesaRef: order.mpesaRef,
      servedAt: order.deliveryAddress,
      vatRate: order.vatRate,
      vatAmount: order.vatAmount,
      kraPin
    }, order.customerEmail);

    await logActivity({ actorType: 'staff', actorId: staff.clerkUserId, actorName: staff.name, action: 'order.receipt_resent', entityType: 'Order', entityId: order.id, summary: `resent receipt for order ${order.orderNumber}` });
    return NextResponse.json({ ok: true, result });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: identityErrorStatus(e) });
  }
}
