import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaff, identityErrorStatus } from '@/lib/identity';
import { logActivity } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireStaff();
    const suppliers = await prisma.supplier.findMany({ where: { active: true }, orderBy: { name: 'asc' } });
    return NextResponse.json({ suppliers });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: identityErrorStatus(e) });
  }
}

export async function POST(req: NextRequest) {
  try {
    const staff = await requireStaff();
    const body = await req.json();
    if (!body.name) return NextResponse.json({ error: 'name required' }, { status: 400 });

    const supplier = await prisma.supplier.create({
      data: {
        name: body.name,
        contactName: body.contactName || null,
        phone: body.phone || null,
        email: body.email || null,
        category: body.category || 'other',
        notes: body.notes || null
      }
    });
    await logActivity({ actorType: 'staff', actorId: staff.clerkUserId, actorName: staff.name, action: 'supplier.create', entityType: 'Supplier', entityId: supplier.id, summary: `added supplier "${supplier.name}"` });
    return NextResponse.json({ supplier });
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
    for (const key of ['name', 'contactName', 'phone', 'email', 'category', 'notes', 'active']) {
      if (body[key] !== undefined) data[key] = body[key];
    }
    const supplier = await prisma.supplier.update({ where: { id: body.id }, data });
    await logActivity({ actorType: 'staff', actorId: staff.clerkUserId, actorName: staff.name, action: 'supplier.update', entityType: 'Supplier', entityId: supplier.id, summary: `updated supplier "${supplier.name}"` });
    return NextResponse.json({ supplier });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: identityErrorStatus(e) });
  }
}
