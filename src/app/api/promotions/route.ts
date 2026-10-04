import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// Public, unauthenticated - feeds the site-wide announcement bar.
export async function GET() {
  const now = new Date();
  const promotions = await prisma.promotion.findMany({
    where: {
      active: true,
      AND: [
        { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
        { OR: [{ endsAt: null }, { endsAt: { gte: now } }] }
      ]
    },
    orderBy: { createdAt: 'desc' },
    select: { id: true, type: true, message: true, ctaLabel: true, ctaHref: true }
  });
  return NextResponse.json({ promotions });
}
