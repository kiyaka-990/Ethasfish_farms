import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { email, phone } = await req.json();
    const cleanEmail = typeof email === 'string' && email.includes('@') ? email.trim().toLowerCase() : null;
    const cleanPhone = typeof phone === 'string' && phone.trim() ? phone.trim() : null;
    if (!cleanEmail && !cleanPhone) {
      return NextResponse.json({ error: 'Enter an email or phone number' }, { status: 400 });
    }

    const subscriber = await prisma.subscriber.upsert({
      where: cleanEmail ? { email: cleanEmail } : { phone: cleanPhone! },
      update: {},
      create: { email: cleanEmail, phone: cleanPhone }
    });
    return NextResponse.json({ subscriber });
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 });
  }
}
