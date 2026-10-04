import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, identityErrorStatus } from '@/lib/identity';
import { logActivity } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireAdmin();
    const staff = await prisma.staffProfile.findMany({ orderBy: { createdAt: 'asc' } });
    return NextResponse.json({ staff });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: identityErrorStatus(e) });
  }
}

// Invite a teammate by email. They're linked (clerkUserId populated) the
// first time they sign in with a matching email - see lib/identity.ts.
export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const { email, name, role } = await req.json();
    if (!email || !name) return NextResponse.json({ error: 'email and name required' }, { status: 400 });

    const created = await prisma.staffProfile.create({
      data: {
        clerkUserId: `pending:${email.toLowerCase()}:${Date.now()}`,
        email: email.toLowerCase(),
        name,
        role: role === 'admin' ? 'admin' : 'sales_manager'
      }
    });
    await logActivity({ actorType: 'staff', actorId: admin.clerkUserId, actorName: admin.name, action: 'staff.invite', entityType: 'StaffProfile', entityId: created.id, summary: `invited ${created.name} (${created.email}) as ${created.role}` });
    return NextResponse.json({ staff: created });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: identityErrorStatus(e) });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const { id, role, active, name, email } = await req.json();
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const existing = await prisma.staffProfile.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Changing the email on an invite that hasn't been claimed yet also
    // needs to update the pending clerkUserId marker (it encodes the
    // email identity.ts matches against on first sign-in) - once claimed
    // (a real Clerk user id, not "pending:...") the email is locked in.
    const isPending = existing.clerkUserId.startsWith('pending:');
    const newEmail = email?.trim().toLowerCase();
    if (newEmail && !isPending && newEmail !== existing.email) {
      return NextResponse.json({ error: 'Cannot change the email of a staff member who has already signed in - remove and re-invite instead' }, { status: 400 });
    }

    const updated = await prisma.staffProfile.update({
      where: { id },
      data: {
        ...(role ? { role } : {}),
        ...(active !== undefined ? { active } : {}),
        ...(name?.trim() ? { name: name.trim() } : {}),
        ...(newEmail ? { email: newEmail, ...(isPending ? { clerkUserId: `pending:${newEmail}:${Date.now()}` } : {}) } : {})
      }
    });
    await logActivity({ actorType: 'staff', actorId: admin.clerkUserId, actorName: admin.name, action: 'staff.update', entityType: 'StaffProfile', entityId: updated.id, summary: `updated ${updated.name}${role ? ` → role: ${role}` : ''}${active !== undefined ? ` → active: ${active}` : ''}${newEmail ? ` → email: ${newEmail}` : ''}` });
    return NextResponse.json({ staff: updated });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: identityErrorStatus(e) });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const id = req.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const removed = await prisma.staffProfile.delete({ where: { id } });
    await logActivity({ actorType: 'staff', actorId: admin.clerkUserId, actorName: admin.name, action: 'staff.remove', entityType: 'StaffProfile', entityId: id, summary: `removed staff member ${removed.name}` });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: identityErrorStatus(e) });
  }
}
