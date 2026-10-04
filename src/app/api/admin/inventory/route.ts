import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, identityErrorStatus } from '@/lib/identity';
import { logActivity } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireAdmin();
    const items = await prisma.inventoryItem.findMany({
      where: { active: true },
      include: { movements: { orderBy: { createdAt: 'desc' }, take: 10 } },
      orderBy: { name: 'asc' }
    });
    return NextResponse.json({ items });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: identityErrorStatus(e) });
  }
}

export async function POST(req: NextRequest) {
  try {
    const staff = await requireAdmin();
    const body = await req.json();
    if (!body.name || !body.unit) return NextResponse.json({ error: 'name and unit required' }, { status: 400 });

    const item = await prisma.inventoryItem.create({
      data: {
        name: body.name,
        category: body.category || 'other',
        unit: body.unit,
        quantity: Number(body.quantity) || 0,
        reorderLevel: Number(body.reorderLevel) || 0,
        costPerUnit: Number(body.costPerUnit) || 0,
        notes: body.notes || null
      }
    });
    await logActivity({ actorType: 'staff', actorId: staff.clerkUserId, actorName: staff.name, action: 'inventory.create', entityType: 'InventoryItem', entityId: item.id, summary: `added inventory item "${item.name}"` });
    return NextResponse.json({ item });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: identityErrorStatus(e) });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const staff = await requireAdmin();
    const body = await req.json();
    if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const data: any = {};
    for (const key of ['name', 'category', 'unit', 'reorderLevel', 'costPerUnit', 'notes', 'active']) {
      if (body[key] !== undefined) data[key] = body[key];
    }
    const item = await prisma.inventoryItem.update({ where: { id: body.id }, data });
    await logActivity({ actorType: 'staff', actorId: staff.clerkUserId, actorName: staff.name, action: 'inventory.update', entityType: 'InventoryItem', entityId: item.id, summary: `updated inventory item "${item.name}"` });
    return NextResponse.json({ item });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: identityErrorStatus(e) });
  }
}
