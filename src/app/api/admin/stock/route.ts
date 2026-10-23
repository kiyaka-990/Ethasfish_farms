import { NextResponse } from 'next/server';
import { requireStaff, identityErrorStatus } from '@/lib/identity';
import { getStockSnapshot, ensureDefaultOutlets } from '@/lib/stock';

export const dynamic = 'force-dynamic';

// Full stock picture: farm stock (harvests minus distributions) and each
// outlet's stock (distributions minus sales), in pieces and kg.
export async function GET() {
  try {
    const staff = await requireStaff();
    await ensureDefaultOutlets();
    const snapshot = await getStockSnapshot();
    return NextResponse.json({ ...snapshot, role: staff.role });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: identityErrorStatus(e) });
  }
}
