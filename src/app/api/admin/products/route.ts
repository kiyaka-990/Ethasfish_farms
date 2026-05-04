import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminFromCookies } from '@/lib/auth';
import { clearBotCache } from '@/lib/chatbot';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const admin = await getAdminFromCookies();
  if (!admin) throw new Error('Unauthorized');
  return admin;
}

export async function GET() {
  try {
    await requireAdmin();
    const products = await prisma.product.findMany({
      include: { variants: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { sortOrder: 'asc' }
    });
    return NextResponse.json({ products });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.message === 'Unauthorized' ? 401 : 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await requireAdmin();
    const body = await req.json();
    const { type, productId, variantId } = body;

    if (type === 'updateProduct' && productId) {
      const updated = await prisma.product.update({
        where: { id: productId },
        data: {
          name: body.name,
          description: body.description,
          badge: body.badge ?? null,
          active: body.active ?? true,
          imageUrl: body.imageUrl ?? null
        }
      });
      clearBotCache();
      return NextResponse.json({ product: updated });
    }

    if (type === 'updateVariant' && variantId) {
      const updated = await prisma.productVariant.update({
        where: { id: variantId },
        data: {
          label: body.label,
          weight: body.weight,
          perItem: body.perItem ?? null,
          priceKsh: parseInt(body.priceKsh, 10),
          stock: parseInt(body.stock, 10),
          active: body.active ?? true
        }
      });
      clearBotCache(); // 🔑 the bot picks up new prices instantly
      return NextResponse.json({ variant: updated });
    }

    return NextResponse.json({ error: 'Unknown operation' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.message === 'Unauthorized' ? 401 : 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const body = await req.json();
    if (body.type === 'createVariant') {
      const created = await prisma.productVariant.create({
        data: {
          productId: body.productId,
          label: body.label,
          pieces: parseInt(body.pieces, 10) || 1,
          weight: body.weight,
          perItem: body.perItem ?? null,
          priceKsh: parseInt(body.priceKsh, 10),
          stock: parseInt(body.stock, 10) || 0,
          sortOrder: parseInt(body.sortOrder, 10) || 99
        }
      });
      clearBotCache();
      return NextResponse.json({ variant: created });
    }
    return NextResponse.json({ error: 'Unknown operation' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.message === 'Unauthorized' ? 401 : 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await requireAdmin();
    const variantId = req.nextUrl.searchParams.get('variantId');
    if (!variantId) return NextResponse.json({ error: 'variantId required' }, { status: 400 });
    await prisma.productVariant.delete({ where: { id: variantId } });
    clearBotCache();
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.message === 'Unauthorized' ? 401 : 500 });
  }
}
