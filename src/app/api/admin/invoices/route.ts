import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaff, identityErrorStatus } from '@/lib/identity';
import { logActivity } from '@/lib/audit';
import { generateDocNumber } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await requireStaff();
    const status = req.nextUrl.searchParams.get('status');
    const invoices = await prisma.invoice.findMany({
      where: status ? { status } : undefined,
      include: { items: true },
      orderBy: { createdAt: 'desc' },
      take: 300
    });
    return NextResponse.json({ invoices });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: identityErrorStatus(e) });
  }
}

export async function POST(req: NextRequest) {
  try {
    const staff = await requireStaff();
    const body = await req.json();
    const items: Array<{ description: string; quantity: number; unitPrice: number }> = body.items || [];
    if (!body.customerName || items.length === 0) {
      return NextResponse.json({ error: 'customerName and at least one item are required' }, { status: 400 });
    }

    const subtotal = items.reduce((sum, it) => sum + Math.round(it.quantity * it.unitPrice), 0);
    const taxRate = Number(body.taxRate) || 0;
    const taxAmount = Math.round(subtotal * (taxRate / 100));
    const total = subtotal + taxAmount;

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: generateDocNumber('INV'),
        orderId: body.orderId || null,
        customerName: body.customerName,
        customerEmail: body.customerEmail || null,
        customerPhone: body.customerPhone || null,
        customerAddr: body.customerAddr || null,
        subtotal,
        taxRate,
        taxAmount,
        total,
        status: 'draft',
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        notes: body.notes || null,
        createdBy: staff.id,
        items: { create: items.map(it => ({ description: it.description, quantity: it.quantity, unitPrice: it.unitPrice, lineTotal: Math.round(it.quantity * it.unitPrice) })) }
      },
      include: { items: true }
    });

    await logActivity({ actorType: 'staff', actorId: staff.clerkUserId, actorName: staff.name, action: 'invoice.create', entityType: 'Invoice', entityId: invoice.id, summary: `created invoice ${invoice.invoiceNumber} for ${invoice.customerName}` });
    return NextResponse.json({ invoice });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: identityErrorStatus(e) });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const staff = await requireStaff();
    const body = await req.json();
    if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const data: any = {};
    if (body.status) {
      data.status = body.status;
      if (body.status === 'paid') data.paidAt = new Date();
    }
    if (body.notes !== undefined) data.notes = body.notes;
    if (body.dueDate !== undefined) data.dueDate = body.dueDate ? new Date(body.dueDate) : null;

    const invoice = await prisma.invoice.update({ where: { id: body.id }, data, include: { items: true } });
    await logActivity({ actorType: 'staff', actorId: staff.clerkUserId, actorName: staff.name, action: 'invoice.update', entityType: 'Invoice', entityId: invoice.id, summary: `updated invoice ${invoice.invoiceNumber} (${invoice.status})` });
    return NextResponse.json({ invoice });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: identityErrorStatus(e) });
  }
}
