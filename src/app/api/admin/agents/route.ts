import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaff, identityErrorStatus } from '@/lib/identity';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireStaff();
    const [runs, totals] = await Promise.all([
      prisma.agentRun.findMany({ orderBy: { createdAt: 'desc' }, take: 100 }),
      prisma.agentRun.aggregate({ _sum: { tokensUsed: true }, _count: true })
    ]);
    return NextResponse.json({
      runs,
      summary: { totalRuns: totals._count, totalTokens: totals._sum.tokensUsed || 0 }
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: identityErrorStatus(e) });
  }
}
