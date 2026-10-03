import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaff, identityErrorStatus } from '@/lib/identity';
import { logActivity } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await requireStaff();
    const key = req.nextUrl.searchParams.get('key');
    if (key) {
      const row = await prisma.siteContent.findUnique({ where: { key } });
      return NextResponse.json({ content: row });
    }
    const rows = await prisma.siteContent.findMany({ orderBy: { key: 'asc' } });
    return NextResponse.json({ content: rows });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: identityErrorStatus(e) });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const staff = await requireStaff();
    const { key, label, data } = await req.json();
    if (!key || data === undefined) return NextResponse.json({ error: 'key and data required' }, { status: 400 });

    const row = await prisma.siteContent.upsert({
      where: { key },
      create: { key, label: label || key, data: JSON.stringify(data), updatedBy: staff.name },
      update: { data: JSON.stringify(data), updatedBy: staff.name, ...(label ? { label } : {}) }
    });

    await logActivity({ actorType: 'staff', actorId: staff.clerkUserId, actorName: staff.name, action: 'content.update', entityType: 'SiteContent', entityId: row.id, summary: `updated site content "${row.label}"` });
    return NextResponse.json({ content: row });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: identityErrorStatus(e) });
  }
}
