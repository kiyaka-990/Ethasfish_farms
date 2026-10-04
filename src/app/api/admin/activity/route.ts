import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, identityErrorStatus } from '@/lib/identity';

export const dynamic = 'force-dynamic';

// Supports ?since=<ISO timestamp> so the admin Activity page can poll for
// new entries without re-fetching the whole log (a lightweight stand-in
// for a full websocket/SSE feed - see roadmap).
export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const since = req.nextUrl.searchParams.get('since');
    const logs = await prisma.auditLog.findMany({
      where: since ? { createdAt: { gt: new Date(since) } } : undefined,
      orderBy: { createdAt: 'desc' },
      take: since ? 50 : 100
    });
    return NextResponse.json({ logs });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: identityErrorStatus(e) });
  }
}
