import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { etaMinutes, KISUMU_CENTER } from '@/lib/delivery';

export const dynamic = 'force-dynamic';

// Public live tracking for /track - keyed by order number, the same
// capability URL that already gates receipt + status pages. Returns only
// what a customer may see: stage, destination, driver first name + vehicle
// and the rider's latest position while out for delivery. Phone numbers,
// internal ids and fleet-wide data never leave this endpoint.
export async function GET(req: NextRequest) {
  try {
    const orderNumber = req.nextUrl.searchParams.get('order');
    if (!orderNumber) return NextResponse.json({ error: 'order required' }, { status: 400 });

    const order = await prisma.order.findUnique({
      where: { orderNumber },
      select: {
        status: true, deliveryAddress: true, updatedAt: true,
        delivery: {
          select: {
            status: true, pickedUpAt: true, deliveredAt: true, destLat: true, destLng: true,
            driver: { select: { name: true, vehicle: true, plate: true, lastLat: true, lastLng: true, lastSeenAt: true } }
          }
        }
      }
    });
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

    const d = order.delivery;
    const driver = d?.driver;

    // Only reveal the rider while they're actually riding (privacy + battery sanity).
    const riding = !!d && d.status === 'picked_up' && driver?.lastLat != null && driver?.lastLng != null;
    const fresh = driver?.lastSeenAt ? Date.now() - driver.lastSeenAt.getTime() < 90_000 : false;
    const pos = riding && fresh ? { lat: driver!.lastLat as number, lng: driver!.lastLng as number, seenAt: driver!.lastSeenAt } : null;

    const dest = d?.destLat != null && d?.destLng != null ? { lat: d.destLat, lng: d.destLng } : null;
    const eta = pos ? etaMinutes(pos, dest) : null;

    return NextResponse.json({
      status: order.status,
      updatedAt: order.updatedAt,
      destination: dest,
      delivery: d ? {
        stage: d.status,
        pickedUpAt: d.pickedUpAt,
        deliveredAt: d.deliveredAt,
        // First name only - full name + phone live on the receipt page.
        driverName: driver?.name ? driver.name.split(' ')[0] : null,
        driverVehicle: driver?.vehicle ?? null,
        position: pos,
        etaMin: eta,
        // Fall back to the city centre when the address never geocoded,
        // so the map still centres somewhere sensible.
        mapCenter: pos ?? dest ?? KISUMU_CENTER
      } : null
    });
  } catch {
    // Never leak internals on the public route.
    return NextResponse.json({ error: 'Tracking unavailable' }, { status: 500 });
  }
}
