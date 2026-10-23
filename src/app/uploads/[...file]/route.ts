import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const dynamic = 'force-dynamic';

// `next start` snapshots public/ at boot, so files written by the local
// upload fallback (api/admin/media with no BLOB_READ_WRITE_TOKEN) after
// startup would 404 without this handler. On Vercel this never fires -
// uploads go to Vercel Blob instead.
const CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
  '.webp': 'image/webp', '.gif': 'image/gif', '.avif': 'image/avif',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime',
  '.m4v': 'video/x-m4v', '.mkv': 'video/x-matroska',
  '.mp3': 'audio/mpeg', '.pdf': 'application/pdf'
};

export async function GET(_req: NextRequest, ctx: { params: Promise<{ file: string[] }> }) {
  const { file } = await ctx.params;
  const root = path.join(process.cwd(), 'public', 'uploads');
  const target = path.resolve(root, ...file);
  // Path-traversal guard: stay strictly inside public/uploads.
  if (target !== root && !target.startsWith(root + path.sep)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const data = await readFile(target);
    const type = CONTENT_TYPES[path.extname(target).toLowerCase()] ?? 'application/octet-stream';
    return new NextResponse(new Uint8Array(data), {
      headers: {
        'Content-Type': type,
        'Cache-Control': 'public, max-age=86400'
      }
    });
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
}
