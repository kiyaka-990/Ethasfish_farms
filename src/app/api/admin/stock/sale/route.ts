import { NextRequest, NextResponse } from 'next/server';
import { requireStaff, identityErrorStatus } from '@/lib/identity';
import { recordSale } from '@/lib/stock';

export const dynamic = 'force-dynamic';

// Record an outlet sale in pieces and/or kg, with the cash taken.
export async function POST(req: NextRequest) {
  try {
    const staff = await requireStaff();
    const body = await req.json();
    const result = await recordSale(
      {
        outletId: body.outletId,
        outlet: body.outlet,
        pieces: body.pieces,
        weightKg: body.weightKg,
        amountKsh: body.amountKsh,
        channel: body.channel,
        note: body.note
      },
      { type: 'staff', id: staff.clerkUserId, name: staff.name }
    );
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ sale: result.record });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: identityErrorStatus(e) });
  }
}
