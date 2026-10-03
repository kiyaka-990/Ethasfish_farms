import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaff, identityErrorStatus } from '@/lib/identity';
import { logActivity } from '@/lib/audit';

export const dynamic = 'force-dynamic';

// Records a stock movement and atomically adjusts the item's running
// quantity - the two must never drift apart, hence the transaction.
export async function POST(req: NextRequest) {
  try {
    const staff = await requireStaff();
    const body = await req.json();
    const { itemId, type, quantity, reason, reference } = body;
    if (!itemId || !type || !quantity) return NextResponse.json({ error: 'itemId, type and quantity required' }, { status: 400 });
    if (!['in', 'out', 'adjustment'].includes(type)) return NextResponse.json({ error: 'invalid type' }, { status: 400 });

    const qty = Number(quantity);
    const delta = type === 'out' ? -Math.abs(qty) : Math.abs(qty);

    const [movement, item] = await prisma.$transaction([
      prisma.inventoryMovement.create({
        data: { itemId, type, quantity: qty, reason: reason || null, reference: reference || null, createdBy: staff.name }
      }),
      prisma.inventoryItem.update({ where: { id: itemId }, data: { quantity: { increment: delta } } })
    ]);

    await logActivity({ actorType: 'staff', actorId: staff.clerkUserId, actorName: staff.name, action: 'inventory.movement', entityType: 'InventoryItem', entityId: itemId, summary: `recorded ${type} of ${qty} ${item.unit} for "${item.name}"` });
    return NextResponse.json({ movement, item });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: identityErrorStatus(e) });
  }
}
