import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, identityErrorStatus } from '@/lib/identity';
import { getTaxSettings } from '@/lib/settings';
import { prisma } from '@/lib/prisma';
import { logActivity } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireAdmin();
    const settings = await getTaxSettings();
    return NextResponse.json({ settings });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: identityErrorStatus(e) });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const { vatRate, kraPin } = await req.json();
    if (vatRate !== undefined && (typeof vatRate !== 'number' || vatRate < 0 || vatRate > 100)) {
      return NextResponse.json({ error: 'vatRate must be between 0 and 100' }, { status: 400 });
    }

    await getTaxSettings(); // ensures the row exists before updating
    const updated = await prisma.businessSettings.update({
      where: { id: 'singleton' },
      data: {
        ...(vatRate !== undefined ? { vatRate } : {}),
        ...(kraPin !== undefined ? { kraPin: kraPin?.trim() || null } : {})
      }
    });
    await logActivity({
      actorType: 'staff', actorId: admin.clerkUserId, actorName: admin.name,
      action: 'settings.update', entityType: 'BusinessSettings', entityId: 'singleton',
      summary: `updated tax settings${vatRate !== undefined ? ` → VAT ${vatRate}%` : ''}${kraPin !== undefined ? ` → KRA PIN ${kraPin ? 'set' : 'cleared'}` : ''}`
    });
    return NextResponse.json({ settings: updated });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: identityErrorStatus(e) });
  }
}
