import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaff, identityErrorStatus } from '@/lib/identity';
import { logActivity } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireStaff();
    const leads = await prisma.lead.findMany({ orderBy: { createdAt: 'desc' }, take: 300 });
    return NextResponse.json({ leads });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: identityErrorStatus(e) });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const staff = await requireStaff();
    const body = await req.json();
    if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const updated = await prisma.lead.update({
      where: { id: body.id },
      data: {
        status: body.status,
        notes: body.notes,
        assignedTo: body.assignedTo
      }
    });
    await logActivity({ actorType: 'staff', actorId: staff.clerkUserId, actorName: staff.name, action: 'lead.update', entityType: 'Lead', entityId: updated.id, summary: `updated lead "${updated.name}" -> ${updated.status}` });
    return NextResponse.json({ lead: updated });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: identityErrorStatus(e) });
  }
}
