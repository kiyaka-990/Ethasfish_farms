import { NextResponse } from 'next/server';
import { clearAdminCookie } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  await clearAdminCookie();
  return NextResponse.redirect(new URL('/admin/login', process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'));
}
