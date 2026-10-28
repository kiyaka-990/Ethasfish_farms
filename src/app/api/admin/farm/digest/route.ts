import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, identityErrorStatus } from '@/lib/identity';
import { logActivity } from '@/lib/audit';
import { sendFarmDigest, yesterdayNairobi } from '@/lib/farm-digest';

export const dynamic = 'force-dynamic';

// Staff-triggered digest: previews (and optionally sends) the daily farm
// digest. Defaults to the previous Nairobi day - the same window the cron
// uses - but accepts explicit from/to for backfills.
//   POST { from?, to?, send?: boolean }
export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body = await req.json().catch(() => ({}));

    let { from, to } = yesterdayNairobi();
    if (body.from || body.to) {
      const f = body.from ? new Date(body.from) : from;
      const t = body.to ? new Date(body.to) : to;
      if (isNaN(f.getTime()) || isNaN(t.getTime()) || f >= t) {
        return NextResponse.json({ error: 'from/to must be valid dates with from < to' }, { status: 400 });
      }
      if (t.getTime() - f.getTime() > 31 * 86_400_000) {
        return NextResponse.json({ error: 'window too large (max 31 days)' }, { status: 400 });
      }
      from = f;
      to = t;
    }

    const result = await sendFarmDigest({ from, to }, body.send === true);
    if (body.send === true) {
      await logActivity({
        actorType: 'staff',
        actorId: admin.clerkUserId,
        actorName: admin.name,
        action: 'farm.digest.manual',
        summary: `digest for ${from.toISOString().slice(0, 10)} → ${result.sent} sent${result.skipped ? ` (${result.skipped})` : ''}`
      });
    }
    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: identityErrorStatus(e) });
  }
}
