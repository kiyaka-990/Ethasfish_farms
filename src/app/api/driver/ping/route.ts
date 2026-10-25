import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireDriver, identityErrorStatus } from '@/lib/identity';
import { positionCutoff } from '@/lib/delivery';

export const dynamic = 'force-dynamic';

// GPS ping from the driver's phone: { lat, lng, speedKph? }.
// Throttled server-side (ignore pings closer than 3s apart) so a chatty
// client can't flood the table, then the 30-day history is pruned lazily.
// The ping is attributed to the driver's active delivery when there is one.
export async function POST(req: NextRequest) {
  try {
    const staff = await requireDriver();
    const { lat, lng, speedKph } = await req.json();

    const nLat = Number(lat), nLng = Number(lng);
    if (!Number.isFinite(nLat) || !Number.isFinite(nLng) || Math.abs(nLat) > 90 || Math.abs(nLng) > 180) {
      return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 });
    }

    const driver = await prisma.driver.findUnique({
      where: { staffId: staff.id },
      include: { deliveries: { where: { status: { in: ['assigned', 'picked_up'] } }, select: { id: true } } }
    });
    if (!driver) return NextResponse.json({ error: 'No driver profile linked to your account' }, { status: 400 });
    if (!driver.active) return NextResponse.json({ error: 'Your driver account is deactivated' }, { status: 403 });

    // Server-side throttle: swallow pings that arrive too fast.
    if (driver.lastSeenAt && Date.now() - driver.lastSeenAt.getTime() < 3000) {
      return NextResponse.json({ ok: true, throttled: true });
    }

    const activeDeliveryId = driver.deliveries[0]?.id ?? null;
    const speed = Number.isFinite(Number(speedKph)) ? Math.max(0, Number(speedKph)) : null;

    await prisma.$transaction([
      prisma.driver.update({
        where: { id: driver.id },
        data: { lastLat: nLat, lastLng: nLng, lastSeenAt: new Date() }
      }),
      prisma.driverPosition.create({
        data: { driverId: driver.id, deliveryId: activeDeliveryId, lat: nLat, lng: nLng, speedKph: speed }
      }),
      // Lazy pruning: cheap indexed delete, runs once per ping.
      prisma.driverPosition.deleteMany({ where: { driverId: driver.id, recordedAt: { lt: positionCutoff() } } })
    ]);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: identityErrorStatus(e) });
  }
}
