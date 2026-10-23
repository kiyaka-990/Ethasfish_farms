import { NextRequest, NextResponse } from 'next/server';
import { put, del } from '@vercel/blob';
import { writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '@/lib/prisma';
import { requireAdmin, identityErrorStatus } from '@/lib/identity';
import { logActivity } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireAdmin();
    const media = await prisma.media.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
    return NextResponse.json({ media });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: identityErrorStatus(e) });
  }
}

export async function POST(req: NextRequest) {
  try {
    const staff = await requireAdmin();
    const form = await req.formData();
    const file = form.get('file') as File | null;
    const alt = (form.get('alt') as string) || null;
    const tags = (form.get('tags') as string) || null;
    if (!file) return NextResponse.json({ error: 'file required' }, { status: 400 });

    const kind = file.type.startsWith('video/') ? 'video' : 'image';
    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const pathname = `${kind}s/${Date.now()}-${safeName}`;

    let url: string;
    let storedPath: string;
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const blob = await put(pathname, file, { access: 'public', addRandomSuffix: true });
      url = blob.url;
      storedPath = blob.pathname;
    } else {
      // No Blob token locally (it only exists on Vercel) - store under
      // public/uploads so uploads still work in dev. `next start` serves
      // public/ from disk at request time, so no rebuild is needed.
      const dir = path.join(process.cwd(), 'public', 'uploads', kind);
      const filename = `${Date.now()}-${safeName}`;
      await writeFile(path.join(dir, filename), Buffer.from(await file.arrayBuffer()));
      url = `/uploads/${kind}/${filename}`;
      storedPath = `uploads/${kind}/${filename}`;
    }

    const media = await prisma.media.create({
      data: { url, pathname: storedPath, kind, alt, tags, uploadedBy: staff.name }
    });

    await logActivity({ actorType: 'staff', actorId: staff.clerkUserId, actorName: staff.name, action: 'media.upload', entityType: 'Media', entityId: media.id, summary: `uploaded ${kind} "${file.name}"` });
    return NextResponse.json({ media });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: identityErrorStatus(e) });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const staff = await requireAdmin();
    const id = req.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const media = await prisma.media.findUnique({ where: { id } });
    if (!media) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // best-effort - don't block DB cleanup on storage errors
    if (media.url.startsWith('/uploads/')) {
      await unlink(path.join(process.cwd(), 'public', media.url)).catch(() => {});
    } else {
      await del(media.url).catch(() => {});
    }
    await prisma.media.delete({ where: { id } });

    await logActivity({ actorType: 'staff', actorId: staff.clerkUserId, actorName: staff.name, action: 'media.delete', entityType: 'Media', entityId: id, summary: `deleted media "${media.pathname}"` });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: identityErrorStatus(e) });
  }
}
