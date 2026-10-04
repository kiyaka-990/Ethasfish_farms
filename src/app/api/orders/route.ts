import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateOrderNumber, normalizeKenyanPhone } from '@/lib/utils';
import { getTaxSettings, vatPortion } from '@/lib/settings';

export const dynamic = 'force-dynamic';

interface CartItemInput { variantId: string; quantity: number; }

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { customerName, customerPhone, customerEmail, deliveryAddress, notes, items } = body;
    if (!customerName || !customerPhone || !deliveryAddress) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Cart is empty' }, { status: 400 });
    }

    let normalPhone: string;
    try { normalPhone = normalizeKenyanPhone(customerPhone); }
    catch { return NextResponse.json({ error: 'Invalid Kenyan phone number' }, { status: 400 }); }

    // Load variants and validate
    const variantIds = items.map((i: CartItemInput) => i.variantId);
    const variants = await prisma.productVariant.findMany({
      where: { id: { in: variantIds }, active: true },
      include: { product: true }
    });
    if (variants.length !== variantIds.length) {
      return NextResponse.json({ error: 'Some items are unavailable' }, { status: 400 });
    }

    let subtotal = 0;
    const orderItemData = items.map((i: CartItemInput) => {
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

    const deliveryFee = 200;
    const total = subtotal + deliveryFee;
    const { vatRate } = await getTaxSettings();
    const vatAmount = vatPortion(subtotal, vatRate);

    // Create order with items, decrement stock atomically
    const order = await prisma.$transaction(async (tx) => {
      const created = await tx.order.create({
        data: {
          orderNumber: generateOrderNumber(),
          customerName,
          customerPhone: normalPhone,
          customerEmail: customerEmail || null,
          deliveryAddress,
          notes: notes || null,
          subtotal,
          deliveryFee,
          total,
          vatRate,
          vatAmount,
          items: { create: orderItemData }
        },
        include: { items: true }
      });
      // Decrement stock
      for (const i of items as CartItemInput[]) {
        await tx.productVariant.update({
          where: { id: i.variantId },
          data: { stock: { decrement: i.quantity } }
        });
      }
      return created;
    });

    return NextResponse.json({ order });
  } catch (e: any) {
    console.error('Order create error:', e);
    return NextResponse.json({ error: e.message || 'Failed to create order' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const orderNumber = req.nextUrl.searchParams.get('orderNumber');
    if (!orderNumber) return NextResponse.json({ error: 'orderNumber required' }, { status: 400 });
    const order = await prisma.order.findUnique({
      where: { orderNumber },
      include: { items: true, payments: true }
    });
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    return NextResponse.json({ order });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
