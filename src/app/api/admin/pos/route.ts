import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaff, identityErrorStatus, Unauthorized, Forbidden } from '@/lib/identity';
import { logActivity } from '@/lib/audit';
import { generateOrderNumber, fmtKsh, normalizeKenyanPhone } from '@/lib/utils';
import { buildReceiptText } from '@/lib/receipt';
import { getTaxSettings, vatPortion } from '@/lib/settings';

export const dynamic = 'force-dynamic';

interface CartItemInput { variantId: string; quantity: number; }

// Staff-level (not admin-only) read of just the VAT rate, so the POS cart
// can show a live breakdown - editing it stays admin-only via /api/admin/settings.
export async function GET() {
  try {
    await requireStaff();
    const { vatRate } = await getTaxSettings();
    return NextResponse.json({ vatRate });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: identityErrorStatus(e) });
  }
}

// In-person counter sale: unlike the online checkout flow, payment is
// already confirmed face-to-face (cash in hand, or the customer showing
// their M-Pesa confirmation SMS) - so there's no async STK push/webhook,
// the order is created already paid, and there's no delivery fee.
export async function POST(req: NextRequest) {
  try {
    const staff = await requireStaff();
    const body = await req.json();
    const { items, paymentMethod, cashReceived, mpesaRef, customerName, customerPhone } = body;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Cart is empty' }, { status: 400 });
    }
    if (paymentMethod !== 'cash' && paymentMethod !== 'mpesa') {
      return NextResponse.json({ error: 'paymentMethod must be cash or mpesa' }, { status: 400 });
    }
    if (paymentMethod === 'mpesa' && !mpesaRef?.trim()) {
      return NextResponse.json({ error: 'M-Pesa reference is required' }, { status: 400 });
    }

    let normalPhone: string | null = null;
    if (customerPhone?.trim()) {
      try { normalPhone = normalizeKenyanPhone(customerPhone); }
      catch { return NextResponse.json({ error: 'Invalid Kenyan phone number' }, { status: 400 }); }
    }

    const variantIds = (items as CartItemInput[]).map(i => i.variantId);
    const variants = await prisma.productVariant.findMany({
      where: { id: { in: variantIds }, active: true },
      include: { product: true }
    });
    if (variants.length !== variantIds.length) {
      return NextResponse.json({ error: 'Some items are unavailable' }, { status: 400 });
    }

    let subtotal = 0;
    const orderItemData = (items as CartItemInput[]).map(i => {
      const v = variants.find(x => x.id === i.variantId);
      if (!v) throw new Error('Variant missing');
      if (v.stock < i.quantity) throw new Error(`Insufficient stock for ${v.product.name} ${v.label}`);
      const line = v.priceKsh * i.quantity;
      subtotal += line;
      return {
        productId: v.productId,
        variantId: v.id,
        productName: v.product.name,
        variantLabel: v.label,
        unitPrice: v.priceKsh,
        quantity: i.quantity,
        lineTotal: line
      };
    });

    const total = subtotal;
    if (paymentMethod === 'cash' && (typeof cashReceived !== 'number' || cashReceived < total)) {
      return NextResponse.json({ error: 'Cash received must cover the total' }, { status: 400 });
    }
    const taxSettings = await getTaxSettings();
    const { vatRate } = taxSettings;
    const vatAmount = vatPortion(subtotal, vatRate);

    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          orderNumber: generateOrderNumber(),
          customerName: customerName?.trim() || 'Walk-in Customer',
          customerPhone: normalPhone || '',
          deliveryAddress: 'In-store pickup (POS)',
          subtotal,
          deliveryFee: 0,
          total,
          vatRate,
          vatAmount,
          channel: 'pos',
          status: 'paid',
          paymentStatus: 'paid',
          paymentMethod,
          mpesaRef: paymentMethod === 'mpesa' ? mpesaRef.trim() : null,
          items: { create: orderItemData },
          payments: {
            create: {
              method: paymentMethod,
              amount: total,
              status: 'success',
              reference: paymentMethod === 'mpesa' ? mpesaRef.trim() : null
            }
          }
        },
        include: { items: true }
      });
      for (const i of items as CartItemInput[]) {
        await tx.productVariant.update({
          where: { id: i.variantId },
          data: { stock: { decrement: i.quantity } }
        });
      }
      return created;
    });

    await logActivity({
      actorType: 'staff',
      actorId: staff.clerkUserId,
      actorName: staff.name,
      action: 'pos.sale',
      entityType: 'Order',
      entityId: order.id,
      summary: `POS sale ${order.orderNumber} - ${fmtKsh(total)} (${paymentMethod}) by ${staff.name}`
    });

    const receiptText = buildReceiptText({
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      orderNumber: order.orderNumber,
      status: 'paid',
      items: order.items.map(i => ({
        productName: i.productName,
        variantLabel: i.variantLabel,
        quantity: i.quantity,
        lineTotal: i.lineTotal,
        weight: variants.find(v => v.id === i.variantId)?.weight
      })),
      subtotal: order.subtotal,
      deliveryFee: 0,
      total: order.total,
      mpesaRef: order.mpesaRef,
      servedAt: staff.name,
      vatRate: order.vatRate,
      vatAmount: order.vatAmount,
      kraPin: taxSettings.kraPin
    });

    return NextResponse.json({ order, receiptText });
  } catch (e: any) {
    if (e instanceof Unauthorized || e instanceof Forbidden) {
      return NextResponse.json({ error: e.message }, { status: identityErrorStatus(e) });
    }
    console.error('POS sale error:', e);
    return NextResponse.json({ error: e.message || 'Failed to complete sale' }, { status: 500 });
  }
}
