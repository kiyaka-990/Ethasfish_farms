import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, identityErrorStatus } from '@/lib/identity';
import { logActivity } from '@/lib/audit';
import { clearBotCache } from '@/lib/chatbot';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireAdmin();
    const faqs = await prisma.faqEntry.findMany({ orderBy: { createdAt: 'desc' } });
    return NextResponse.json({ faqs });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: identityErrorStatus(e) });
  }
}

export async function POST(req: NextRequest) {
  try {
    const staff = await requireAdmin();
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
    await logActivity({ actorType: 'staff', actorId: staff.clerkUserId, actorName: staff.name, action: 'faq.create', entityType: 'FaqEntry', entityId: created.id, summary: `added FAQ "${created.question}"` });
    return NextResponse.json({ faq: created });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: identityErrorStatus(e) });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const staff = await requireAdmin();
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
    await logActivity({ actorType: 'staff', actorId: staff.clerkUserId, actorName: staff.name, action: 'faq.update', entityType: 'FaqEntry', entityId: updated.id, summary: `updated FAQ "${updated.question}"` });
    return NextResponse.json({ faq: updated });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: identityErrorStatus(e) });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const staff = await requireAdmin();
    const id = req.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    await prisma.faqEntry.delete({ where: { id } });
    clearBotCache();
    await logActivity({ actorType: 'staff', actorId: staff.clerkUserId, actorName: staff.name, action: 'faq.delete', entityType: 'FaqEntry', entityId: id, summary: 'deleted an FAQ entry' });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: identityErrorStatus(e) });
  }
}
