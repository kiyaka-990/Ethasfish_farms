import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { dispatchReceipt } from '@/lib/receipt';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const stk = body?.Body?.stkCallback;
    if (!stk) return NextResponse.json({ ok: true });

    const checkoutId = stk.CheckoutRequestID;
    const resultCode = stk.ResultCode;
    const order = await prisma.order.findFirst({
      where: { mpesaCheckoutId: checkoutId },
      include: { items: true }
    });
    if (!order) {
      console.warn('M-Pesa callback: order not found for', checkoutId);
      return NextResponse.json({ ok: true });
    }

    if (resultCode === 0) {
      // Success - extract M-Pesa reference
      const items = stk.CallbackMetadata?.Item || [];
      const ref = items.find((i: any) => i.Name === 'MpesaReceiptNumber')?.Value || null;
      const refStr = ref ? String(ref) : null;

      await prisma.$transaction([
        prisma.order.update({
          where: { id: order.id },
          data: { paymentStatus: 'paid', status: 'paid', mpesaRef: refStr }
        }),
        prisma.payment.updateMany({
          where: { orderId: order.id, status: 'initiated' },
          data: { status: 'success', reference: refStr, rawResponse: JSON.stringify(stk) }
        })
      ]);

      // Send receipt - via WhatsApp + SMS + Email (best-effort, non-blocking)
      dispatchReceipt({
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        orderNumber: order.orderNumber,
        status: 'paid',
        items: order.items.map((it: any) => ({
          productName: it.productName,
          variantLabel: it.variantLabel,
          quantity: it.quantity,
          lineTotal: it.lineTotal
        })),
        subtotal: order.subtotal,
        deliveryFee: order.deliveryFee,
        total: order.total,
        mpesaRef: refStr,
        servedAt: order.deliveryAddress
      }, order.customerEmail).catch(e => console.error('[receipt] dispatch failed:', e));

    } else {
      await prisma.$transaction([
        prisma.order.update({ where: { id: order.id }, data: { paymentStatus: 'failed' } }),
        prisma.payment.updateMany({
          where: { orderId: order.id, status: 'initiated' },
          data: { status: 'failed', rawResponse: JSON.stringify(stk) }
        })
      ]);
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('M-Pesa callback error:', e);
    return NextResponse.json({ ok: true });
  }
}
