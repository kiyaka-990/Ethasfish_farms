import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, identityErrorStatus } from '@/lib/identity';
import { logActivity } from '@/lib/audit';

export const dynamic = 'force-dynamic';

// Camera feeds for Admin > Cameras. The stream URL must be something a
// browser can actually load: an HLS playlist, an embeddable relay page
// (go2rtc / mediamtx / NVR web viewer) or a snapshot image. Raw rtsp://
// URLs are rejected with a message that explains why - the farm's
// always-on NVR/PC has to relay them to HTTP(S) first.
const KINDS = ['hls', 'embed', 'image'];

function validateUrl(raw: unknown): { ok: true; url: string } | { ok: false; error: string } {
  if (typeof raw !== 'string' || !raw.trim()) return { ok: false, error: 'streamUrl is required' };
  const url = raw.trim();
  if (/^(rtsp|rtsps|onvif|mms):/i.test(url)) {
    return { ok: false, error: 'Browsers cannot play rtsp:// directly - relay it to HTTPS on the farm\u2019s always-on device (e.g. go2rtc), then paste that URL' };
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, error: 'streamUrl must be a full URL (https://...)' };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, error: 'streamUrl must be http(s)' };
  }
  return { ok: true, url };
}

// Default the player type from the URL shape when the client doesn't say.
function inferKind(url: string): string {
  if (/\.m3u8(\?|$)/i.test(url)) return 'hls';
  if (/\.(jpe?g|png|webp|gif)(\?|$)/i.test(url)) return 'image';
  return 'embed';
}

export async function GET() {
  try {
    await requireAdmin();
    const cameras = await prisma.camera.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] });
    return NextResponse.json({ cameras });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: identityErrorStatus(e) });
  }
}

// { name, streamUrl, zone?, kind?, sortOrder?, active? }
export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body = await req.json();
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });

    const checked = validateUrl(body.streamUrl);
    if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 });

    // `kind: ""` means auto-detect from the URL shape.
    const kind = body.kind || inferKind(checked.url);
    if (!KINDS.includes(kind)) return NextResponse.json({ error: 'kind must be hls, embed or image' }, { status: 400 });

    const camera = await prisma.camera.create({
      data: {
        name,
        zone: typeof body.zone === 'string' && body.zone.trim() ? body.zone.trim() : null,
        kind,
        streamUrl: checked.url,
        sortOrder: Number.isFinite(Number(body.sortOrder)) ? Math.trunc(Number(body.sortOrder)) : 0,
        active: typeof body.active === 'boolean' ? body.active : true,
        createdBy: admin.id
      }
    });

    await logActivity({
      actorType: 'staff', actorId: admin.clerkUserId, actorName: admin.name,
      action: 'camera.create', entityType: 'Camera', entityId: camera.id,
      summary: `added camera "${camera.name}"${camera.zone ? ` (${camera.zone})` : ''} [${camera.kind}]`
    });
    return NextResponse.json({ camera });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: identityErrorStatus(e) });
  }
}

// { id, name?, zone?, streamUrl?, kind?, sortOrder?, active? }
export async function PATCH(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body = await req.json();
    if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const existing = await prisma.camera.findUnique({ where: { id: body.id } });
    if (!existing) return NextResponse.json({ error: 'Camera not found' }, { status: 404 });

    const data: any = {};
    if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim();
    if (body.zone !== undefined) data.zone = body.zone?.trim() || null;
    if (body.active !== undefined) data.active = Boolean(body.active);
    if (body.sortOrder !== undefined && Number.isFinite(Number(body.sortOrder))) data.sortOrder = Math.trunc(Number(body.sortOrder));

    if (body.streamUrl !== undefined) {
      const checked = validateUrl(body.streamUrl);
      if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 });
      data.streamUrl = checked.url;
      if (body.kind === undefined) data.kind = inferKind(checked.url);
    }
    if (body.kind === '' && data.streamUrl) {
      data.kind = inferKind(data.streamUrl); // auto-detect
    } else if (body.kind !== undefined) {
      if (!KINDS.includes(body.kind)) return NextResponse.json({ error: 'kind must be hls, embed or image' }, { status: 400 });
      data.kind = body.kind;
    }

    const camera = await prisma.camera.update({ where: { id: body.id }, data });

    await logActivity({
      actorType: 'staff', actorId: admin.clerkUserId, actorName: admin.name,
      action: 'camera.update', entityType: 'Camera', entityId: camera.id,
      summary: `updated camera "${camera.name}"`
    });
    return NextResponse.json({ camera });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: identityErrorStatus(e) });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const id = req.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const existing = await prisma.camera.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Camera not found' }, { status: 404 });

    await prisma.camera.delete({ where: { id } });
    await logActivity({
      actorType: 'staff', actorId: admin.clerkUserId, actorName: admin.name,
      action: 'camera.delete', entityType: 'Camera', entityId: id,
      summary: `removed camera "${existing.name}"`
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: identityErrorStatus(e) });
  }
}
