import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaff, identityErrorStatus } from '@/lib/identity';
import { logActivity } from '@/lib/audit';
import { generateDocNumber } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireStaff();
    const purchaseOrders = await prisma.purchaseOrder.findMany({
      include: { items: true, supplier: true },
      orderBy: { createdAt: 'desc' },
      take: 300
    });
    return NextResponse.json({ purchaseOrders });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: identityErrorStatus(e) });
  }
}

export async function POST(req: NextRequest) {
  try {
    const staff = await requireStaff();
    const body = await req.json();
    const items: Array<{ description: string; quantity: number; unitCost: number }> = body.items || [];
    if (!body.supplierId || items.length === 0) {
      return NextResponse.json({ error: 'supplierId and at least one item are required' }, { status: 400 });
    }

    const totalCost = items.reduce((sum, it) => sum + Math.round(it.quantity * it.unitCost), 0);

    const po = await prisma.purchaseOrder.create({
      data: {
        poNumber: generateDocNumber('PO'),
        supplierId: body.supplierId,
        status: 'draft',
        totalCost,
        expectedDate: body.expectedDate ? new Date(body.expectedDate) : null,
        notes: body.notes || null,
        createdBy: staff.id,
        items: { create: items.map(it => ({ description: it.description, quantity: it.quantity, unitCost: it.unitCost, lineTotal: Math.round(it.quantity * it.unitCost) })) }
      },
      include: { items: true, supplier: true }
    });

    await logActivity({ actorType: 'staff', actorId: staff.clerkUserId, actorName: staff.name, action: 'po.create', entityType: 'PurchaseOrder', entityId: po.id, summary: `created purchase order ${po.poNumber} for ${po.supplier.name}` });
    return NextResponse.json({ purchaseOrder: po });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: identityErrorStatus(e) });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const staff = await requireStaff();
    const body = await req.json();
    if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const data: any = {};
    if (body.status) {
      data.status = body.status;
      if (body.status === 'received') data.receivedAt = new Date();
    }
    if (body.notes !== undefined) data.notes = body.notes;

    const po = await prisma.purchaseOrder.update({ where: { id: body.id }, data, include: { items: true, supplier: true } });
    await logActivity({ actorType: 'staff', actorId: staff.clerkUserId, actorName: staff.name, action: 'po.update', entityType: 'PurchaseOrder', entityId: po.id, summary: `updated PO ${po.poNumber} (${po.status})` });
    return NextResponse.json({ purchaseOrder: po });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: identityErrorStatus(e) });
  }
}
