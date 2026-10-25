import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireDriver, identityErrorStatus } from '@/lib/identity';

export const dynamic = 'force-dynamic';

// Resolve the signed-in staff member to their Driver row. Admins without
// a driver row get null (the UI shows "no vehicle registered").
async function myDriver() {
  const staff = await requireDriver();
  const driver = await prisma.driver.findUnique({
    where: { staffId: staff.id },
    include: {
      deliveries: {
        where: { status: { in: ['assigned', 'picked_up'] } },
        include: {
          order: {
            select: {
              id: true, orderNumber: true, customerName: true, customerPhone: true,
              deliveryAddress: true, notes: true, total: true, status: true,
              items: { select: { productName: true, variantLabel: true, quantity: true } }
            }
          }
        },
        orderBy: { assignedAt: 'asc' }
      }
    }
  });
  return { staff, driver };
}

// Driver app state: my current jobs + today's completed rides.
export async function GET() {
  try {
    const { staff, driver } = await myDriver();
    if (!driver) {
      return NextResponse.json({ driver: null, jobs: [], history: [], role: staff.role });
    }
    if (!driver.active) return NextResponse.json({ error: 'Your driver account is deactivated - contact dispatch' }, { status: 403 });

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const history = await prisma.delivery.findMany({
      where: { driverId: driver.id, status: 'delivered', deliveredAt: { gte: startOfDay } },
      include: { order: { select: { orderNumber: true, deliveryAddress: true, total: true } } },
      orderBy: { deliveredAt: 'desc' },
      take: 20
    });

    const { deliveries, ...safeDriver } = driver;
    return NextResponse.json({ driver: safeDriver, jobs: deliveries, history });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: identityErrorStatus(e) });
  }
}

// Job transitions: { deliveryId, action: 'picked_up' | 'delivered' }.
// Driver can only touch their own active deliveries; the order status
// moves in lockstep so /track updates for the customer.
export async function PATCH(req: NextRequest) {
  try {
    const { staff, driver } = await myDriver();
    if (!driver) return NextResponse.json({ error: 'No driver profile linked to your account' }, { status: 400 });
    if (!driver.active) return NextResponse.json({ error: 'Your driver account is deactivated' }, { status: 403 });

    const { deliveryId, action } = await req.json();
    if (!deliveryId || !['picked_up', 'delivered'].includes(action)) {
      return NextResponse.json({ error: 'deliveryId and action (picked_up|delivered) required' }, { status: 400 });
    }

    const delivery = await prisma.delivery.findUnique({ where: { id: deliveryId }, include: { order: true } });
    if (!delivery || delivery.driverId !== driver.id) return NextResponse.json({ error: 'Not your delivery' }, { status: 403 });
    if (action === 'picked_up' && delivery.status !== 'assigned') {
      return NextResponse.json({ error: 'This delivery is not at the pickup stage' }, { status: 400 });
    }
    if (action === 'delivered' && delivery.status !== 'picked_up') {
      return NextResponse.json({ error: 'Pick up the order before marking it delivered' }, { status: 400 });
    }

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

    return NextResponse.json({ delivery: updated, role: staff.role });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: identityErrorStatus(e) });
  }
}
