// Farm intelligence core: how ground readings become alerts and pump
// commands. Used by the ingest API (devices) and the admin APIs (staff).
//
// Design notes:
//   - Rules are server-side truth. Devices just report numbers; the farm
//     decides. Device firmware should still keep its own safety cutoffs
//     (never run a pump dry, max continuous runtime) - the network is not
//     a safety system.
//   - Hysteresis stops flapping: an alert only auto-resolves once the
//     value has clearly returned past the threshold by `hysteresis`, and
//     a rule cannot re-fire inside its cooldown window.
//   - Commands are queued, not pushed: the actuator picks its command up
//     on its next poll, so a dropped packet never loses an instruction.
import crypto from 'node:crypto';
import { prisma } from './prisma';
import { logActivity } from './audit';
import { metricMeta, formatValue, ACTUATOR_COMMANDS, type ActuatorCommand } from './farm-metrics';

// Re-exported so server callers keep a single import surface.
export * from './farm-metrics';

export function generateDeviceToken(): string {
  return 'efdev_' + crypto.randomBytes(18).toString('hex');
}

function conditionHolds(comparator: string, value: number, threshold: number): boolean {
  return comparator === 'lt' ? value < threshold : value > threshold;
}

function isClearlyClear(comparator: string, value: number, threshold: number, hysteresis: number): boolean {
  // gt rule clears when value drops to threshold - hysteresis; lt rule clears when it rises past threshold + hysteresis.
  return comparator === 'lt' ? value >= threshold + hysteresis : value <= threshold - hysteresis;
}

export interface IngestedReading {
  metric: string;
  value: number;
}

/**
 * Evaluate every enabled rule against the readings that just arrived,
 * opening/auto-resolving alerts and queueing actuator commands.
 * Returns the alerts + commands created, for logging and the response.
 */
export async function evaluateRules(readings: IngestedReading[], sourceDeviceId?: string) {
  if (!readings.length) return { alerts: [] as any[], commands: [] as any[] };

  const latest = new Map<string, number>();
  for (const r of readings) latest.set(r.metric, r.value); // last write wins per metric

  const rules = await prisma.sensorRule.findMany({
    where: { enabled: true },
    include: { targetDevice: true }
  });

  const createdAlerts: any[] = [];
  const createdCommands: any[] = [];

  for (const rule of rules) {
    const value = latest.get(rule.metric);
    if (value === undefined) continue;

    const holds = conditionHolds(rule.comparator, value, rule.threshold);
    const openAlert = await prisma.farmAlert.findFirst({
      where: { ruleId: rule.id, status: 'open' }
    });

    if (!holds) {
      // Auto-resolve once it is clearly back to normal (hysteresis band).
      if (openAlert && isClearlyClear(rule.comparator, value, rule.threshold, rule.hysteresis)) {
        await prisma.farmAlert.update({
          where: { id: openAlert.id },
          data: { status: 'resolved', resolvedAt: new Date() }
        });
      }
      continue;
    }

    // One open alert per rule; respect the cooldown before re-firing.
    if (openAlert) continue;
    if (rule.lastFiredAt) {
      const sinceMs = Date.now() - rule.lastFiredAt.getTime();
      if (sinceMs < rule.cooldownMinutes * 60_000) continue;
    }

    const deviceName = sourceDeviceId
      ? (await prisma.sensorDevice.findUnique({ where: { id: sourceDeviceId } }))?.name
      : null;
    const msg =
      `${metricMeta(rule.metric).label} ${formatValue(rule.metric, value)} ` +
      `${rule.comparator === 'lt' ? 'below' : 'above'} ` +
      `${formatValue(rule.metric, rule.threshold)} — rule "${rule.name}"` +
      (deviceName ? ` (reported by ${deviceName})` : '');

    const alert = await prisma.farmAlert.create({
      data: {
        deviceId: sourceDeviceId || null,
        ruleId: rule.id,
        metric: rule.metric,
        value,
        severity: rule.severity,
        message: msg
      }
    });
    await prisma.sensorRule.update({ where: { id: rule.id }, data: { lastFiredAt: new Date() } });
    createdAlerts.push(alert);

    // Queue the actuator command (dedupe: never stack identical pendings).
    if (rule.action && rule.targetDeviceId) {
      const pending = await prisma.deviceCommand.findFirst({
        where: { deviceId: rule.targetDeviceId, command: rule.action, status: 'pending' }
      });
      if (!pending) {
        const cmd = await prisma.deviceCommand.create({
          data: { deviceId: rule.targetDeviceId, command: rule.action, source: 'rule' }
        });
        createdCommands.push(cmd);
      }
    }
  }

  if (createdAlerts.length || createdCommands.length) {
    await logActivity({
      actorType: 'system',
      actorId: 'farm-rules',
      actorName: 'Farm Rules Engine',
      action: createdAlerts.length ? 'farm.alert' : 'farm.command',
      summary:
        createdAlerts.map((a) => a.message).join('; ') ||
        createdCommands.map((c) => `${c.command} queued`).join('; '),
      metadata: { alerts: createdAlerts.map((a) => a.id), commands: createdCommands.map((c) => c.id) }
    }).catch(() => {});
  }

  return { alerts: createdAlerts, commands: createdCommands };
}

/** Take pending commands for a device and mark them delivered. */
export async function takeCommands(deviceId: string) {
  const pending = await prisma.deviceCommand.findMany({
    where: { deviceId, status: 'pending' },
    orderBy: { createdAt: 'asc' },
    take: 10
  });
  if (pending.length) {
    await prisma.deviceCommand.updateMany({
      where: { id: { in: pending.map((p) => p.id) } },
      data: { status: 'delivered', deliveredAt: new Date() }
    });
  }
  return pending.map((p) => ({ id: p.id, command: p.command }));
}

/** Queue a command from the staff dashboard or the AI advisor. */
export async function queueCommand(
  deviceId: string,
  command: string,
  source: 'manual' | 'ai'
) {
  if (!ACTUATOR_COMMANDS.includes(command as ActuatorCommand)) {
    throw new Error(`command must be one of ${ACTUATOR_COMMANDS.join(', ')}`);
  }
  const device = await prisma.sensorDevice.findUnique({ where: { id: deviceId } });
  if (!device) throw new Error('Device not found');
  const pending = await prisma.deviceCommand.findFirst({
    where: { deviceId, command, status: 'pending' }
  });
  if (pending) return pending; // already on its way
  return prisma.deviceCommand.create({ data: { deviceId, command, source } });
}
