import { NextRequest, NextResponse } from 'next/server';
import { requireStaff, identityErrorStatus } from '@/lib/identity';
import { recordDistribution } from '@/lib/stock';

export const dynamic = 'force-dynamic';

// Send fish from farm stock to an outlet, in pieces and/or kg.
export async function POST(req: NextRequest) {
  try {
    const staff = await requireStaff();
    const body = await req.json();
    const result = await recordDistribution(
      {
        outletId: body.outletId,
        outlet: body.outlet,
        pieces: body.pieces,
        weightKg: body.weightKg,
        note: body.note
      },
      { type: 'staff', id: staff.clerkUserId, name: staff.name }
    );
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ distribution: result.record });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: identityErrorStatus(e) });
  }
}
