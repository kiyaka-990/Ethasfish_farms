import { NextRequest, NextResponse } from 'next/server';
import { put, del } from '@vercel/blob';
import { prisma } from '@/lib/prisma';
import { requireStaff, identityErrorStatus } from '@/lib/identity';
import { logActivity } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireStaff();
    const media = await prisma.media.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
    return NextResponse.json({ media });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: identityErrorStatus(e) });
  }
}

export async function POST(req: NextRequest) {
  try {
    const staff = await requireStaff();
    const form = await req.formData();
    const file = form.get('file') as File | null;
    const alt = (form.get('alt') as string) || null;
    const tags = (form.get('tags') as string) || null;
    if (!file) return NextResponse.json({ error: 'file required' }, { status: 400 });

    const kind = file.type.startsWith('video/') ? 'video' : 'image';
    const pathname = `${kind}s/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;

    const blob = await put(pathname, file, { access: 'public', addRandomSuffix: true });

    const media = await prisma.media.create({
      data: { url: blob.url, pathname: blob.pathname, kind, alt, tags, uploadedBy: staff.name }
    });

    await logActivity({ actorType: 'staff', actorId: staff.clerkUserId, actorName: staff.name, action: 'media.upload', entityType: 'Media', entityId: media.id, summary: `uploaded ${kind} "${file.name}"` });
    return NextResponse.json({ media });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: identityErrorStatus(e) });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const staff = await requireStaff();
    const id = req.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const media = await prisma.media.findUnique({ where: { id } });
    if (!media) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await del(media.url).catch(() => {}); // best-effort - don't block DB cleanup on Blob errors
    await prisma.media.delete({ where: { id } });

    await logActivity({ actorType: 'staff', actorId: staff.clerkUserId, actorName: staff.name, action: 'media.delete', entityType: 'Media', entityId: id, summary: `deleted media "${media.pathname}"` });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: identityErrorStatus(e) });
  }
}
