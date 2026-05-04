import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { stkPush } from '@/lib/mpesa';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { orderId } = await req.json();
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    if (order.paymentStatus === 'paid') return NextResponse.json({ error: 'Already paid' }, { status: 400 });

    // If M-Pesa creds not configured, return a stub response
    if (!process.env.MPESA_CONSUMER_KEY || !process.env.MPESA_PASSKEY) {
      return NextResponse.json({
        message: 'M-Pesa not configured (sandbox/dev mode). Order saved successfully.',
        configured: false,
        order
      });
    }

    const stk = await stkPush({
      phone: order.customerPhone,
      amount: order.total,
      reference: order.orderNumber,
      description: `Ethasfish ${order.orderNumber}`
    });

    if (stk.ResponseCode === '0' && stk.CheckoutRequestID) {
      await prisma.$transaction([
        prisma.order.update({
          where: { id: order.id },
          data: { paymentStatus: 'processing', mpesaCheckoutId: stk.CheckoutRequestID }
        }),
        prisma.payment.create({
          data: {
            orderId: order.id,
            method: 'mpesa',
            amount: order.total,
            status: 'initiated',
            checkoutId: stk.CheckoutRequestID,
            rawResponse: JSON.stringify(stk)
          }
        })
      ]);
    }

    return NextResponse.json({ stk, configured: true });
  } catch (e: any) {
    console.error('M-Pesa STK error:', e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
