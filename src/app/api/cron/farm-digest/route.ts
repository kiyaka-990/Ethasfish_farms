import { NextRequest, NextResponse } from 'next/server';
import { sendFarmDigest, yesterdayNairobi } from '@/lib/farm-digest';
import { logActivity } from '@/lib/audit';

export const dynamic = 'force-dynamic';

// Vercel cron target (vercel.json -> 04:00 UTC = 07:00 Africa/Nairobi).
// Vercel invokes crons with `Authorization: Bearer ${CRON_SECRET}`.
// Fail closed: no secret configured -> refuse; wrong/missing bearer -> 401.
async function handle(req: NextRequest) {
  try {
    const secret = process.env.CRON_SECRET;
    if (!secret) {
      return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 });
    }
    if (req.headers.get('authorization') !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const { from, to } = yesterdayNairobi();
    const result = await sendFarmDigest({ from, to }, true);

    await logActivity({
      actorType: 'system',
      actorId: 'farm-digest-cron',
      actorName: 'Farm Digest',
      action: 'farm.digest.cron',
      summary: `morning digest → ${result.sent} sent${result.skipped ? ` (${result.skipped})` : ''}`
    }).catch(() => {});

    return NextResponse.json({ ok: true, window: { from, to }, sent: result.sent, skipped: result.skipped });
  } catch (e: any) {
    console.error('[farm/digest cron]', e);
    return NextResponse.json({ error: 'digest failed' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
