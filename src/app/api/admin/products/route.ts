import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaff, requireAdmin, identityErrorStatus } from '@/lib/identity';
import { logActivity } from '@/lib/audit';
import { clearBotCache } from '@/lib/chatbot';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireStaff();
    const products = await prisma.product.findMany({
      include: { variants: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { sortOrder: 'asc' }
    });
    return NextResponse.json({ products });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: identityErrorStatus(e) });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const staff = await requireAdmin();
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
          imageUrl: body.imageUrl ?? null,
          videoUrl: body.videoUrl ?? null
        }
      });
      clearBotCache();
      await logActivity({ actorType: 'staff', actorId: staff.clerkUserId, actorName: staff.name, action: 'product.update', entityType: 'Product', entityId: updated.id, summary: `updated product "${updated.name}"` });
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
      clearBotCache(); // the bot picks up new prices instantly
      await logActivity({ actorType: 'staff', actorId: staff.clerkUserId, actorName: staff.name, action: 'variant.update', entityType: 'ProductVariant', entityId: updated.id, summary: `updated variant "${updated.label}" → KSh ${updated.priceKsh}` });
      return NextResponse.json({ variant: updated });
    }

    return NextResponse.json({ error: 'Unknown operation' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: identityErrorStatus(e) });
  }
}

export async function POST(req: NextRequest) {
  try {
    const staff = await requireAdmin();
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
      await logActivity({ actorType: 'staff', actorId: staff.clerkUserId, actorName: staff.name, action: 'variant.create', entityType: 'ProductVariant', entityId: created.id, summary: `added variant "${created.label}"` });
      return NextResponse.json({ variant: created });
    }

    if (body.type === 'createProduct') {
      const created = await prisma.product.create({
        data: {
          slug: body.slug,
          name: body.name,
          type: body.type2 || body.productType || 'whole',
          description: body.description || '',
          imageUrl: body.imageUrl ?? null,
          videoUrl: body.videoUrl ?? null,
          badge: body.badge ?? null,
          sortOrder: parseInt(body.sortOrder, 10) || 99
        }
      });
      clearBotCache();
      await logActivity({ actorType: 'staff', actorId: staff.clerkUserId, actorName: staff.name, action: 'product.create', entityType: 'Product', entityId: created.id, summary: `created product "${created.name}"` });
      return NextResponse.json({ product: created });
    }

    return NextResponse.json({ error: 'Unknown operation' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: identityErrorStatus(e) });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const staff = await requireAdmin();
    const variantId = req.nextUrl.searchParams.get('variantId');
    const productId = req.nextUrl.searchParams.get('productId');

    if (variantId) {
      await prisma.productVariant.delete({ where: { id: variantId } });
      clearBotCache();
      await logActivity({ actorType: 'staff', actorId: staff.clerkUserId, actorName: staff.name, action: 'variant.delete', entityType: 'ProductVariant', entityId: variantId, summary: 'deleted a product variant' });
      return NextResponse.json({ ok: true });
    }
    if (productId) {
      await prisma.product.delete({ where: { id: productId } });
      clearBotCache();
      await logActivity({ actorType: 'staff', actorId: staff.clerkUserId, actorName: staff.name, action: 'product.delete', entityType: 'Product', entityId: productId, summary: 'deleted a product' });
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: 'variantId or productId required' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: identityErrorStatus(e) });
  }
}
