import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaff, identityErrorStatus } from '@/lib/identity';
import { logActivity } from '@/lib/audit';
import { geocodeAddress } from '@/lib/delivery';

export const dynamic = 'force-dynamic';

// Dispatch board data: everything the live map + queue need in one poll.
// The admin board refetches this every 5s; payloads are bounded (take 100).
export async function GET() {
  try {
    await requireStaff();

    const [deliveries, queue, drivers] = await Promise.all([
      // Active deliveries only - delivered/cancelled leave the board.
      prisma.delivery.findMany({
        where: { status: { in: ['assigned', 'picked_up'] } },
        include: {
          order: { select: { id: true, orderNumber: true, customerName: true, customerPhone: true, deliveryAddress: true, total: true, status: true, items: { select: { quantity: true } } } },
          driver: true
        },
        orderBy: { assignedAt: 'asc' },
        take: 60
      }),
      // Unassigned online orders ready to ride (POS orders are counter pickups).
      prisma.order.findMany({
        where: {
          channel: 'online',
          status: { in: ['paid', 'preparing'] },
          delivery: { is: null }
        },
        select: {
          id: true, orderNumber: true, customerName: true, customerPhone: true,
          deliveryAddress: true, total: true, status: true, notes: true, createdAt: true,
          items: { select: { productName: true, variantLabel: true, quantity: true } }
        },
        orderBy: { createdAt: 'asc' },
        take: 50
      }),
      prisma.driver.findMany({ orderBy: [{ active: 'desc' }, { name: 'asc' }] })
    ]);

    return NextResponse.json({ deliveries, queue, drivers });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: identityErrorStatus(e) });
  }
}

// Assign a driver to an order. Geocodes the delivery address once (or the
// dispatcher drops the pin manually afterwards via PATCH pin).
export async function POST(req: NextRequest) {
  try {
    const staff = await requireStaff();
    const { orderId, driverId } = await req.json();
    if (!orderId || !driverId) return NextResponse.json({ error: 'orderId and driverId required' }, { status: 400 });

    const [order, driver] = await Promise.all([
      prisma.order.findUnique({ where: { id: orderId } }),
      prisma.driver.findUnique({ where: { id: driverId } })
    ]);
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    if (!driver || !driver.active) return NextResponse.json({ error: 'Driver not found or inactive' }, { status: 400 });
    const existing = await prisma.delivery.findUnique({ where: { orderId: order.id } });
    if (existing && ['assigned', 'picked_up'].includes(existing.status)) {
      return NextResponse.json({ error: 'Order already has an active delivery' }, { status: 400 });
    }

    const geo = await geocodeAddress(order.deliveryAddress);

    const delivery = await prisma.delivery.upsert({
      where: { orderId: order.id },
      create: {
        orderId: order.id,
        driverId: driver.id,
        status: 'assigned',
        destLat: geo?.lat ?? null,
        destLng: geo?.lng ?? null
      },
      update: {
        driverId: driver.id,
        status: 'assigned',
        cancelReason: null,
        assignedAt: new Date(),
        pickedUpAt: null,
        deliveredAt: null,
        ...(geo && !existing?.destLat ? { destLat: geo.lat, destLng: geo.lng } : {})
      }
    });

    // Assigning moves a paid order into preparing so the customer sees progress.
    if (order.status === 'paid') {
      await prisma.order.update({ where: { id: order.id }, data: { status: 'preparing' } });
    }

    await logActivity({
      actorType: 'staff', actorId: staff.clerkUserId, actorName: staff.name,
      action: 'delivery.assign', entityType: 'Delivery', entityId: delivery.id,
      summary: `assigned ${driver.name} to ${order.orderNumber}${geo ? '' : ' (address not geocoded - set the pin on the map)'}`
    });

    return NextResponse.json({ delivery });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: identityErrorStatus(e) });
  }
}

// Manual overrides from the dispatch board:
//   { deliveryId, action: 'picked_up' | 'delivered' }   - mirror the driver
//   { deliveryId, action: 'unassign' }                  - send back to queue
//   { deliveryId, lat, lng }                            - fix destination pin
export async function PATCH(req: NextRequest) {
  try {
    const staff = await requireStaff();
    const { deliveryId, action, lat, lng } = await req.json();
    if (!deliveryId) return NextResponse.json({ error: 'deliveryId required' }, { status: 400 });

    const delivery = await prisma.delivery.findUnique({ where: { id: deliveryId }, include: { order: true, driver: true } });
    if (!delivery) return NextResponse.json({ error: 'Delivery not found' }, { status: 404 });

    if (typeof lat === 'number' && typeof lng === 'number') {
      const updated = await prisma.delivery.update({ where: { id: deliveryId }, data: { destLat: lat, destLng: lng } });
      await logActivity({
        actorType: 'staff', actorId: staff.clerkUserId, actorName: staff.name,
        action: 'delivery.pin', entityType: 'Delivery', entityId: deliveryId,
        summary: `moved destination pin for ${delivery.order.orderNumber}`
      });
      return NextResponse.json({ delivery: updated });
    }

    if (action === 'picked_up' || action === 'delivered') {
      if (!delivery.driverId) return NextResponse.json({ error: 'No driver assigned' }, { status: 400 });
      const now = new Date();
      const updated = await prisma.$transaction(async (tx) => {
        const d = await tx.delivery.update({
          where: { id: deliveryId },
          data: action === 'picked_up'
            ? { status: 'picked_up', pickedUpAt: delivery.pickedUpAt ?? now }
            : { status: 'delivered', deliveredAt: now }
        });
        await tx.order.update({
          where: { id: delivery.orderId },
          data: { status: action === 'picked_up' ? 'out_for_delivery' : 'delivered' }
        });
        return d;
      });
      await logActivity({
        actorType: 'staff', actorId: staff.clerkUserId, actorName: staff.name,
        action: `delivery.${action}`, entityType: 'Delivery', entityId: deliveryId,
        summary: `${action === 'picked_up' ? 'picked up' : 'delivered'} ${delivery.order.orderNumber}${delivery.driver ? ` (${delivery.driver.name})` : ''}`
      });
      return NextResponse.json({ delivery: updated });
    }

    if (action === 'unassign') {
      if (delivery.status === 'picked_up') return NextResponse.json({ error: 'Cannot unassign after pickup - cancel instead' }, { status: 400 });
      const updated = await prisma.delivery.update({
        where: { id: deliveryId },
        data: { driverId: null, status: 'cancelled', cancelReason: 'unassigned by dispatch' }
      });
      await logActivity({
        actorType: 'staff', actorId: staff.clerkUserId, actorName: staff.name,
        action: 'delivery.unassign', entityType: 'Delivery', entityId: deliveryId,
        summary: `unassigned driver from ${delivery.order.orderNumber} - back to queue`
      });
      return NextResponse.json({ delivery: updated });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: identityErrorStatus(e) });
  }
}
