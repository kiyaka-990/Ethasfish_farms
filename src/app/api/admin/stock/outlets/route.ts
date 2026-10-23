import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaff, requireAdmin, identityErrorStatus } from '@/lib/identity';
import { createOutlet, ensureDefaultOutlets, updateOutletThresholds } from '@/lib/stock';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireStaff();
    await ensureDefaultOutlets();
    const outlets = await prisma.outlet.findMany({ where: { active: true }, orderBy: { name: 'asc' } });
    return NextResponse.json({ outlets });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: identityErrorStatus(e) });
  }
}

// Adding an outlet is a business-wide change (it shows up in every
// staff member's forms), so it stays admin-only.
export async function POST(req: NextRequest) {
  try {
    const staff = await requireAdmin();
    const body = await req.json();
    const result = await createOutlet(body.name, { type: 'staff', id: staff.clerkUserId, name: staff.name });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ outlet: result.record });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: identityErrorStatus(e) });
  }
}

// Tuning alert thresholds changes what every staff member gets warned
// about, so it is admin-only like outlet creation.
export async function PATCH(req: NextRequest) {
  try {
    const staff = await requireAdmin();
    const body = await req.json();
    const result = await updateOutletThresholds(
      { outletId: body.outletId, lowStockPieces: body.lowStockPieces, lowStockKg: body.lowStockKg },
      { type: 'staff', id: staff.clerkUserId, name: staff.name }
    );
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ outlet: result.record });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: identityErrorStatus(e) });
  }
}
