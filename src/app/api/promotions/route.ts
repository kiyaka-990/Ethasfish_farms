import { NextResponse } from 'next/server';
import { getActivePromotions } from '@/lib/promotions';

export const dynamic = 'force-dynamic';

// Public, unauthenticated - feeds the site-wide announcement bar.
export async function GET() {
  const promotions = await getActivePromotions();
  return NextResponse.json({ promotions });
}
