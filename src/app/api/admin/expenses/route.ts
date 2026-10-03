import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaff, identityErrorStatus } from '@/lib/identity';
import { logActivity } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireStaff();
    const expenses = await prisma.expense.findMany({ orderBy: { date: 'desc' }, take: 300 });
    return NextResponse.json({ expenses });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: identityErrorStatus(e) });
  }
}

export async function POST(req: NextRequest) {
  try {
    const staff = await requireStaff();
    const body = await req.json();
    if (!body.description || !body.amount) return NextResponse.json({ error: 'description and amount required' }, { status: 400 });

    const expense = await prisma.expense.create({
      data: {
        category: body.category || 'other',
        description: body.description,
        amount: Math.round(Number(body.amount)),
        paidTo: body.paidTo || null,
        date: body.date ? new Date(body.date) : new Date(),
        recordedBy: staff.name
      }
    });
    await logActivity({ actorType: 'staff', actorId: staff.clerkUserId, actorName: staff.name, action: 'expense.create', entityType: 'Expense', entityId: expense.id, summary: `recorded expense "${expense.description}" (KSh ${expense.amount})` });
    return NextResponse.json({ expense });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: identityErrorStatus(e) });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const staff = await requireStaff();
    const id = req.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    await prisma.expense.delete({ where: { id } });
    await logActivity({ actorType: 'staff', actorId: staff.clerkUserId, actorName: staff.name, action: 'expense.delete', entityType: 'Expense', entityId: id, summary: 'deleted an expense entry' });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: identityErrorStatus(e) });
  }
}
