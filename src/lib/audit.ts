// Append-only activity trail. Every admin mutation and every autonomous
// agent tool-call is recorded here so the "secure portal" has a full,
// real-time record of who (or which agent) did what.
import { prisma } from './prisma';

export type ActorType = 'staff' | 'agent' | 'system' | 'customer';

export async function logActivity(entry: {
  actorType: ActorType;
  actorId?: string | null;
  actorName: string;
  action: string;
  entityType?: string;
  entityId?: string;
  summary: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        actorType: entry.actorType,
        actorId: entry.actorId ?? null,
        actorName: entry.actorName,
        action: entry.action,
        entityType: entry.entityType ?? null,
        entityId: entry.entityId ?? null,
        summary: entry.summary,
        metadata: entry.metadata ? JSON.stringify(entry.metadata) : null
      }
    });
  } catch (e) {
    // Never let logging break the primary operation.
    console.error('[audit] failed to record activity', e);
  }
}
