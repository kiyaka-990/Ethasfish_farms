import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAdminFromCookies } from '@/lib/auth';
import { clearBotCache } from '@/lib/chatbot';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const admin = await getAdminFromCookies();
  if (!admin) throw new Error('Unauthorized');
}

export async function GET() {
  try {
    await requireAdmin();
    const faqs = await prisma.faqEntry.findMany({ orderBy: { createdAt: 'desc' } });
    return NextResponse.json({ faqs });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.message === 'Unauthorized' ? 401 : 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const body = await req.json();
    const created = await prisma.faqEntry.create({
      data: {
        question: body.question,
        answer: body.answer,
        keywords: body.keywords || '',
        category: body.category || 'general',
        active: body.active ?? true
      }
    });
    clearBotCache();
    return NextResponse.json({ faq: created });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.message === 'Unauthorized' ? 401 : 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await requireAdmin();
    const body = await req.json();
    if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const updated = await prisma.faqEntry.update({
      where: { id: body.id },
      data: {
        question: body.question,
        answer: body.answer,
        keywords: body.keywords,
        category: body.category,
        active: body.active
      }
    });
    clearBotCache();
    return NextResponse.json({ faq: updated });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.message === 'Unauthorized' ? 401 : 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await requireAdmin();
    const id = req.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    await prisma.faqEntry.delete({ where: { id } });
    clearBotCache();
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: e.message === 'Unauthorized' ? 401 : 500 });
  }
}
