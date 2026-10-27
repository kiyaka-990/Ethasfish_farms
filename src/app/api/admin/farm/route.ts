import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin, identityErrorStatus } from '@/lib/identity';
import { logActivity } from '@/lib/audit';
import {
  ACTUATOR_COMMANDS,
  generateDeviceToken,
  queueCommand
} from '@/lib/farm';

export const dynamic = 'force-dynamic';

const KINDS = ['sensor', 'combo', 'pump', 'aerator'];
const SEVERITIES = ['info', 'warning', 'critical'];
const COMPARATORS = ['gt', 'lt'];
const ALERT_STATUSES = ['open', 'acknowledged', 'resolved'];

const SERIES_SINCE_HOURS = 48;
const SERIES_MAX = 3000;

// One payload for the whole Farm Intelligence dashboard - this business
// has tens of readings a day, not millions, so a single bounded query
// beats inventing a query language. The client polls it every 10s.
export async function GET() {
  try {
    await requireAdmin();
    const since = new Date(Date.now() - SERIES_SINCE_HOURS * 3600_000);

    const [devices, rules, alerts, commands, series, pendingByDevice, settings] = await Promise.all([
      prisma.sensorDevice.findMany({ orderBy: [{ zone: 'asc' }, { name: 'asc' }] }),
      prisma.sensorRule.findMany({ orderBy: [{ enabled: 'desc' }, { createdAt: 'asc' }] }),
      prisma.farmAlert.findMany({ orderBy: { createdAt: 'desc' }, take: 40 }),
      prisma.deviceCommand.findMany({ orderBy: { createdAt: 'desc' }, take: 30, include: { device: { select: { name: true } } } }),
      prisma.sensorReading.findMany({
        where: { createdAt: { gte: since } },
        orderBy: { createdAt: 'asc' },
        select: { metric: true, value: true, createdAt: true, deviceId: true },
        take: SERIES_MAX
      }),
      prisma.deviceCommand.groupBy({
        by: ['deviceId'],
        where: { status: 'pending' },
        _count: { _all: true }
      }),
      prisma.businessSettings.findUnique({ where: { id: 'singleton' } })
    ]);

    const pending = Object.fromEntries(pendingByDevice.map((p) => [p.deviceId, p._count._all]));

    return NextResponse.json({
      devices: devices.map((d) => ({ ...d, pendingCommands: pending[d.id] || 0 })),
      rules,
      alerts,
      commands,
      series,
      seriesSince: since,
      settings: { farmAlertPhones: settings?.farmAlertPhones || '' }
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: identityErrorStatus(e) });
  }
}

function audit(actor: any, action: string, summary: string, entityType: string, entityId: string) {
  return logActivity({
    actorType: 'staff', actorId: actor.clerkUserId, actorName: actor.name,
    action, entityType, entityId, summary
  });
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body = await req.json();
    const op = body.op;

    if (op === 'device') {
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });
      const kind = KINDS.includes(body.kind) ? body.kind : 'sensor';
      const device = await prisma.sensorDevice.create({
        data: {
          name,
          zone: typeof body.zone === 'string' && body.zone.trim() ? body.zone.trim() : null,
          kind,
          token: generateDeviceToken(),
          createdBy: admin.id
        }
      });
      await audit(admin, 'farm.device.create', `added farm device "${device.name}" [${device.kind}]`, 'SensorDevice', device.id);
      return NextResponse.json({ device }); // token returned here (also readable later via GET)
    }

    if (op === 'rule') {
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      const metric = typeof body.metric === 'string' ? body.metric.trim() : '';
      const threshold = Number(body.threshold);
      if (!name || !metric) return NextResponse.json({ error: 'name and metric are required' }, { status: 400 });
      if (!COMPARATORS.includes(body.comparator)) return NextResponse.json({ error: 'comparator must be gt or lt' }, { status: 400 });
      if (!Number.isFinite(threshold)) return NextResponse.json({ error: 'threshold must be a number' }, { status: 400 });
      const action = body.action ?? null;
      if (action !== null && !(ACTUATOR_COMMANDS as readonly string[]).includes(action)) {
        return NextResponse.json({ error: `action must be one of ${ACTUATOR_COMMANDS.join(', ')}` }, { status: 400 });
      }
      if (action && !body.targetDeviceId) {
        return NextResponse.json({ error: 'targetDeviceId is required when the rule has an action' }, { status: 400 });
      }
      const rule = await prisma.sensorRule.create({
        data: {
          name,
          metric,
          comparator: body.comparator,
          threshold,
          hysteresis: Math.max(0, Number(body.hysteresis) || 0),
          severity: SEVERITIES.includes(body.severity) ? body.severity : 'warning',
          action,
          targetDeviceId: action ? body.targetDeviceId : null,
          cooldownMinutes: Math.max(1, Math.trunc(Number(body.cooldownMinutes) || 30)),
          enabled: body.enabled !== false
        }
      });
      await audit(admin, 'farm.rule.create', `added rule "${rule.name}" (${rule.metric} ${rule.comparator} ${rule.threshold})`, 'SensorRule', rule.id);
      return NextResponse.json({ rule });
    }

    if (op === 'settings') {
      const csv = typeof body.farmAlertPhones === 'string' ? body.farmAlertPhones.trim() : '';
      // Store only normalized digits - reject junk so the notifier can't be
      // pointed at garbage, and normalizePhone()'d recipients are stable.
      const parts = csv ? csv.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
      for (const part of parts) {
        if (!/^[\d+\s()-]{6,20}$/.test(part)) {
          return NextResponse.json({ error: `"${part}" doesn't look like a phone number` }, { status: 400 });
        }
      }
      const existing = await prisma.businessSettings.findUnique({ where: { id: 'singleton' } });
      const settings = existing
        ? await prisma.businessSettings.update({ where: { id: 'singleton' }, data: { farmAlertPhones: parts.join(', ') || null } })
        : await prisma.businessSettings.create({ data: { farmAlertPhones: parts.join(', ') || null } });
      await audit(admin, 'farm.settings.update', `updated farm alert recipients (${parts.length} number${parts.length === 1 ? '' : 's'})`, 'BusinessSettings', settings.id);
      return NextResponse.json({ settings: { farmAlertPhones: settings.farmAlertPhones || '' } });
    }

    if (op === 'command') {
      if (typeof body.deviceId !== 'string' || !body.deviceId) return NextResponse.json({ error: 'deviceId required' }, { status: 400 });
      try {
        const cmd = await queueCommand(body.deviceId, String(body.command || ''), 'manual');
        await audit(admin, 'farm.command.manual', `queued ${cmd.command} for device`, 'DeviceCommand', cmd.id);
        return NextResponse.json({ command: cmd });
      } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
    }

    return NextResponse.json({ error: 'unknown op' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: identityErrorStatus(e) });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const body = await req.json();
    const type = body.type;
    if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    if (type === 'device') {
      const existing = await prisma.sensorDevice.findUnique({ where: { id: body.id } });
      if (!existing) return NextResponse.json({ error: 'Device not found' }, { status: 404 });
      const data: any = {};
      if (typeof body.name === 'string' && body.name.trim()) data.name = body.name.trim();
      if (body.zone !== undefined) data.zone = body.zone?.trim() || null;
      if (body.active !== undefined) data.active = Boolean(body.active);
      if (body.kind !== undefined) {
        if (!KINDS.includes(body.kind)) return NextResponse.json({ error: `kind must be one of ${KINDS.join(', ')}` }, { status: 400 });
        data.kind = body.kind;
      }
      const device = await prisma.sensorDevice.update({ where: { id: body.id }, data });
      await audit(admin, 'farm.device.update', `updated farm device "${device.name}"`, 'SensorDevice', device.id);
      return NextResponse.json({ device });
    }

    if (type === 'rule') {
      const existing = await prisma.sensorRule.findUnique({ where: { id: body.id } });
      if (!existing) return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
      const data: any = {};
      if (body.enabled !== undefined) data.enabled = Boolean(body.enabled);
      if (body.threshold !== undefined && Number.isFinite(Number(body.threshold))) data.threshold = Number(body.threshold);
      if (body.hysteresis !== undefined && Number.isFinite(Number(body.hysteresis))) data.hysteresis = Math.max(0, Number(body.hysteresis));
      if (body.cooldownMinutes !== undefined) data.cooldownMinutes = Math.max(1, Math.trunc(Number(body.cooldownMinutes) || existing.cooldownMinutes));
      if (body.severity !== undefined) {
        if (!SEVERITIES.includes(body.severity)) return NextResponse.json({ error: 'bad severity' }, { status: 400 });
        data.severity = body.severity;
      }
      if (body.action !== undefined) {
        const action = body.action || null;
        if (action !== null && !(ACTUATOR_COMMANDS as readonly string[]).includes(action)) {
          return NextResponse.json({ error: 'bad action' }, { status: 400 });
        }
        data.action = action;
        data.targetDeviceId = action ? body.targetDeviceId ?? existing.targetDeviceId : null;
        if (action && !data.targetDeviceId) return NextResponse.json({ error: 'targetDeviceId required with an action' }, { status: 400 });
      }
      const rule = await prisma.sensorRule.update({ where: { id: body.id }, data });
      await audit(admin, 'farm.rule.update', `updated rule "${rule.name}"${data.enabled === false ? ' (disabled)' : ''}`, 'SensorRule', rule.id);
      return NextResponse.json({ rule });
    }

    if (type === 'alert') {
      const existing = await prisma.farmAlert.findUnique({ where: { id: body.id } });
      if (!existing) return NextResponse.json({ error: 'Alert not found' }, { status: 404 });
      if (!ALERT_STATUSES.includes(body.status)) return NextResponse.json({ error: 'bad status' }, { status: 400 });
      const alert = await prisma.farmAlert.update({
        where: { id: body.id },
        data: { status: body.status, resolvedAt: body.status === 'resolved' ? new Date() : null }
      });
      await audit(admin, 'farm.alert.status', `marked alert ${body.status}: ${existing.message.slice(0, 80)}`, 'FarmAlert', alert.id);
      return NextResponse.json({ alert });
    }

    return NextResponse.json({ error: 'unknown type' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: identityErrorStatus(e) });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const type = req.nextUrl.searchParams.get('type');
    const id = req.nextUrl.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    if (type === 'device') {
      const existing = await prisma.sensorDevice.findUnique({ where: { id } });
      if (!existing) return NextResponse.json({ error: 'Device not found' }, { status: 404 });
      await prisma.sensorDevice.delete({ where: { id } }); // cascades readings + commands
      await audit(admin, 'farm.device.delete', `removed farm device "${existing.name}"`, 'SensorDevice', id);
      return NextResponse.json({ ok: true });
    }

    if (type === 'rule') {
      const existing = await prisma.sensorRule.findUnique({ where: { id } });
      if (!existing) return NextResponse.json({ error: 'Rule not found' }, { status: 404 });
      await prisma.sensorRule.delete({ where: { id } });
      await audit(admin, 'farm.rule.delete', `removed rule "${existing.name}"`, 'SensorRule', id);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'unknown type' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: identityErrorStatus(e) });
  }
}
