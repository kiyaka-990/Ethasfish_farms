import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, identityErrorStatus } from '@/lib/identity';
import { haversineKm } from '@/lib/delivery';

export const dynamic = 'force-dynamic';

// Delivery reports: volumes, speed and per-driver league tables.
// Aggregation happens in JS - this business processes tens of deliveries
// a day, not thousands, so a findMany beats unreadable raw SQL here.
export async function GET(req: NextRequest) {
  try {
    await requireAdmin();

    const days = Math.min(90, Math.max(1, Number(req.nextUrl.searchParams.get('days')) || 30));
    const since = new Date();
    since.setDate(since.getDate() - days);

    const deliveries = await prisma.delivery.findMany({
      where: { createdAt: { gte: since }, status: { in: ['delivered', 'cancelled', 'picked_up', 'assigned'] } },
      include: {
        order: { select: { orderNumber: true, status: true, channel: true } },
        driver: { select: { id: true, name: true, vehicle: true, plate: true } }
      },
      orderBy: { createdAt: 'asc' }
    });

    const delivered = deliveries.filter(d => d.status === 'delivered' && d.deliveredAt && d.pickedUpAt);
    const cancelled = deliveries.filter(d => d.status === 'cancelled');
    const active = deliveries.filter(d => d.status === 'assigned' || d.status === 'picked_up');

    // Speed: pickup -> drop duration, and assign -> pickup wait time.
    const rideMinutes = delivered.map(d => (new Date(d.deliveredAt!).getTime() - new Date(d.pickedUpAt!).getTime()) / 60000);
    const waitMinutes = delivered
      .filter(d => d.pickedUpAt)
      .map(d => (new Date(d.pickedUpAt!).getTime() - new Date(d.assignedAt).getTime()) / 60000);
    const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;

    // Per-day volume for the trend sparkline.
    const byDay = new Map<string, number>();
    for (const d of delivered) {
      const key = new Date(d.deliveredAt!).toISOString().slice(0, 10);
      byDay.set(key, (byDay.get(key) || 0) + 1);
    }
    const series = Array.from({ length: days }, (_, i) => {
      const dt = new Date();
      dt.setDate(dt.getDate() - (days - 1 - i));
      const key = dt.toISOString().slice(0, 10);
      return { date: key, count: byDay.get(key) || 0 };
    });

    // Distance travelled per delivered ride (GPS trail when we have one).
    const deliveredIds = delivered.map(d => d.id);
    const trails = await prisma.driverPosition.findMany({
      where: { deliveryId: { in: deliveredIds } },
      orderBy: { recordedAt: 'asc' },
      select: { deliveryId: true, lat: true, lng: true }
    });
    const trailMap = new Map<string, { lat: number; lng: number }[]>();
    for (const p of trails) {
      const arr = trailMap.get(p.deliveryId!) || [];
      arr.push({ lat: p.lat, lng: p.lng });
      trailMap.set(p.deliveryId!, arr);
    }
    const distanceKm = (id: string) => {
      const pts = trailMap.get(id);
      if (!pts || pts.length < 2) return null;
      let km = 0;
      for (let i = 1; i < pts.length; i++) km += haversineKm(pts[i - 1], pts[i]);
      return Math.round(km * 10) / 10;
    };

    // Driver league table.
    const byDriver = new Map<string, { name: string; vehicle: string; plate: string | null; delivered: number; cancelled: number; rideMin: number[]; distKm: number[] }>();
    for (const d of deliveries) {
      if (!d.driver) continue;
      const row = byDriver.get(d.driver.id) || { name: d.driver.name, vehicle: d.driver.vehicle, plate: d.driver.plate, delivered: 0, cancelled: 0, rideMin: [], distKm: [] };
      if (d.status === 'delivered' && d.deliveredAt && d.pickedUpAt) {
        row.delivered++;
        row.rideMin.push((new Date(d.deliveredAt).getTime() - new Date(d.pickedUpAt).getTime()) / 60000);
        const km = distanceKm(d.id);
        if (km != null) row.distKm.push(km);
      }
      if (d.status === 'cancelled') row.cancelled++;
      byDriver.set(d.driver.id, row);
    }
    const driverStats = Array.from(byDriver.entries())
      .map(([id, r]) => ({
        driverId: id, name: r.name, vehicle: r.vehicle, plate: r.plate,
        delivered: r.delivered, cancelled: r.cancelled,
        avgRideMin: avg(r.rideMin),
        totalKm: r.distKm.length ? Math.round(r.distKm.reduce((a, b) => a + b, 0) * 10) / 10 : null
      }))
      .sort((a, b) => b.delivered - a.delivered);

    return NextResponse.json({
      range: { days, since: since.toISOString() },
      totals: {
        delivered: delivered.length,
        cancelled: cancelled.length,
        active: active.length,
        avgRideMin: avg(rideMinutes),
        avgWaitMin: avg(waitMinutes),
        onTimePct: rideMinutes.length ? Math.round((rideMinutes.filter(m => m <= 45).length / rideMinutes.length) * 100) : null
      },
      series,
      driverStats
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: identityErrorStatus(e) });
  }
}
