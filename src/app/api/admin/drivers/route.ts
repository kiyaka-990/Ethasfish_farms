import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, identityErrorStatus } from '@/lib/identity';
import { logActivity } from '@/lib/audit';

export const dynamic = 'force-dynamic';

// Driver roster management (admin). Creating a driver also provisions a
// StaffProfile with role=driver so they can sign in through Clerk - the
// exact same pending-email flow the Staff page uses. The first sign-in
// from that email links their Clerk user id and they land on /driver.
export async function GET() {
  try {
    await requireAdmin();
    const drivers = await prisma.driver.findMany({
      include: {
        staff: { select: { id: true, email: true, active: true, clerkUserId: true } },
        _count: { select: { deliveries: true } }
      },
      orderBy: [{ active: 'desc' }, { name: 'asc' }]
    });
    return NextResponse.json({ drivers });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: identityErrorStatus(e) });
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const { name, phone, email, plate, vehicle } = await req.json();
    if (!name?.trim() || !phone?.trim()) return NextResponse.json({ error: 'name and phone are required' }, { status: 400 });
    if (vehicle && !['motorcycle', 'bicycle', 'van'].includes(vehicle)) {
      return NextResponse.json({ error: 'vehicle must be motorcycle, bicycle or van' }, { status: 400 });
    }

    const cleanEmail = (email || '').trim().toLowerCase() || null;

    const driver = await prisma.$transaction(async (tx) => {
      let staffId: string | null = null;
      if (cleanEmail) {
        const existingStaff = await tx.staffProfile.findUnique({ where: { email: cleanEmail } });
        if (existingStaff) {
          // Admins may link their own account to test the driver app;
          // sales accounts stay excluded (their portal is /admin).
          if (existingStaff.role !== 'driver' && existingStaff.role !== 'admin') {
            throw new Error('That email already belongs to a non-driver staff account');
          }
          const alreadyLinked = await tx.driver.findUnique({ where: { staffId: existingStaff.id } });
          if (alreadyLinked) throw new Error('That sign-in email is already linked to another driver');
          staffId = existingStaff.id;
        } else {
          const created = await tx.staffProfile.create({
            data: {
              email: cleanEmail,
              name: name.trim(),
              role: 'driver',
              clerkUserId: `pending:${cleanEmail}:${Date.now()}`
            }
          });
          staffId = created.id;
        }
      }
      return tx.driver.create({
        data: {
          name: name.trim(),
          phone: phone.trim(),
          plate: plate?.trim() || null,
          vehicle: vehicle || 'motorcycle',
          staffId
        }
      });
    });

    await logActivity({
      actorType: 'staff', actorId: admin.clerkUserId, actorName: admin.name,
      action: 'driver.create', entityType: 'Driver', entityId: driver.id,
      summary: `added driver ${driver.name}${driver.plate ? ` (${driver.plate})` : ''}${cleanEmail ? ` - sign-in invite for ${cleanEmail}` : ' - no sign-in email yet'}`
    });
    return NextResponse.json({ driver });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: identityErrorStatus(e) });
  }
}

// { id, name?, phone?, plate?, vehicle?, active?, email? }
export async function PATCH(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const { id, name, phone, plate, vehicle, active, email } = await req.json();
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const driver = await prisma.driver.findUnique({ where: { id }, include: { staff: true } });
    if (!driver) return NextResponse.json({ error: 'Driver not found' }, { status: 404 });

    const data: any = {};
    if (name?.trim()) data.name = name.trim();
    if (phone?.trim()) data.phone = phone.trim();
    if (plate !== undefined) data.plate = plate?.trim() || null;
    if (vehicle) data.vehicle = vehicle;
    if (typeof active === 'boolean') data.active = active;

    // Changing the sign-in email: unlinked pending rows get the new email;
    // an already-linked account keeps its Clerk id (re-provision instead).
    const newEmail = (email || '').trim().toLowerCase() || null;
    if (newEmail && newEmail !== driver.staff?.email) {
      if (driver.staff) {
        const isPending = driver.staff.clerkUserId.startsWith('pending:');
        if (!isPending) return NextResponse.json({ error: 'Driver has already signed in - create a new driver to change their login' }, { status: 400 });
        await prisma.staffProfile.update({
          where: { id: driver.staffId! },
          data: { email: newEmail, clerkUserId: `pending:${newEmail}:${Date.now()}` }
        });
      } else {
        const existing = await prisma.staffProfile.findUnique({ where: { email: newEmail } });
        if (existing && existing.role !== 'driver' && existing.role !== 'admin') {
          return NextResponse.json({ error: 'That email already belongs to a non-driver staff account' }, { status: 400 });
        }
        if (existing) {
          await prisma.driver.update({ where: { id }, data: { staffId: existing.id } });
        } else {
          const created = await prisma.staffProfile.create({
            data: { email: newEmail, name: driver.name, role: 'driver', clerkUserId: `pending:${newEmail}:${Date.now()}` }
          });
          data.staffId = created.id;
        }
      }
    }

    const updated = await prisma.driver.update({ where: { id }, data });
    await logActivity({
      actorType: 'staff', actorId: admin.clerkUserId, actorName: admin.name,
      action: 'driver.update', entityType: 'Driver', entityId: id,
      summary: `updated driver ${updated.name}${typeof active === 'boolean' ? (active ? ' - activated' : ' - deactivated') : ''}`
    });
    return NextResponse.json({ driver: updated });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: identityErrorStatus(e) });
  }
}
