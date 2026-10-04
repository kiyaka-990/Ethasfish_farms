import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaff, identityErrorStatus } from '@/lib/identity';
import { logActivity } from '@/lib/audit';

export const dynamic = 'force-dynamic';

// Staff-level (not requireAdmin) on purpose - branch sales managers should
// be able to post their own "New harvest!" / sale banners without an admin.
export async function GET() {
  try {
    await requireStaff();
    const promotions = await prisma.promotion.findMany({ orderBy: { createdAt: 'desc' } });
    return NextResponse.json({ promotions });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: identityErrorStatus(e) });
  }
}

export async function POST(req: NextRequest) {
  try {
    const staff = await requireStaff();
    const body = await req.json();
    if (!body.message?.trim()) return NextResponse.json({ error: 'message required' }, { status: 400 });

    const created = await prisma.promotion.create({
      data: {
        type: body.type || 'announcement',
        message: body.message.trim(),
        ctaLabel: body.ctaLabel?.trim() || null,
        ctaHref: body.ctaHref?.trim() || null,
        startsAt: body.startsAt ? new Date(body.startsAt) : null,
        endsAt: body.endsAt ? new Date(body.endsAt) : null,
        createdBy: staff.id
      }
    });
    await logActivity({ actorType: 'staff', actorId: staff.clerkUserId, actorName: staff.name, action: 'promotion.create', entityType: 'Promotion', entityId: created.id, summary: `posted promotion: "${created.message}"` });
    return NextResponse.json({ promotion: created });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: identityErrorStatus(e) });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const staff = await requireStaff();
    const { id, active } = await req.json();
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const updated = await prisma.promotion.update({ where: { id }, data: { ...(active !== undefined ? { active } : {}) } });
    await logActivity({ actorType: 'staff', actorId: staff.clerkUserId, actorName: staff.name, action: 'promotion.update', entityType: 'Promotion', entityId: updated.id, summary: `${active ? 'activated' : 'paused'} promotion: "${updated.message}"` });
    return NextResponse.json({ promotion: updated });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: identityErrorStatus(e) });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const staff = await requireStaff();
    const id = req.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const removed = await prisma.promotion.delete({ where: { id } });
    await logActivity({ actorType: 'staff', actorId: staff.clerkUserId, actorName: staff.name, action: 'promotion.delete', entityType: 'Promotion', entityId: id, summary: `removed promotion: "${removed.message}"` });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: identityErrorStatus(e) });
  }
}
