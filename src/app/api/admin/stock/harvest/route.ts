import { NextRequest, NextResponse } from 'next/server';
import { requireStaff, identityErrorStatus } from '@/lib/identity';
import { recordHarvest } from '@/lib/stock';

export const dynamic = 'force-dynamic';

// Record a harvest: fish counted in pieces AND weighed in kg, from a
// numbered cage, a numbered pond, or the hatchery.
export async function POST(req: NextRequest) {
  try {
    const staff = await requireStaff();
    const body = await req.json();
    const result = await recordHarvest(
      {
        sourceType: body.sourceType,
        sourceNumber: body.sourceNumber,
        pieces: body.pieces,
        weightKg: body.weightKg,
        note: body.note
      },
      { type: 'staff', id: staff.clerkUserId, name: staff.name }
    );
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ harvest: result.record });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: identityErrorStatus(e) });
  }
}
