// Daily farm digest: one WhatsApp message each morning summarising
// yesterday's ground data - per-metric readings, alerts that fired, pump
// commands executed, and any device that went silent.
//
// Used by:
//   POST /api/admin/farm/digest  (staff "send now" button, optional send)
//   GET  /api/cron/farm-digest   (Vercel cron, 07:00 Africa/Nairobi)
import { prisma } from './prisma';
import { logActivity } from './audit';
import { formatValue, metricMeta, parseRecipients } from './farm-metrics';
import { sendWhatsAppText } from './farm';

const DAY_MS = 86_400_000;
const NAIROBI_OFFSET_MS = 3 * 3_600_000; // UTC+3, no DST

/** Previous full day in Africa/Nairobi (the morning after reads "yesterday"). */
export function yesterdayNairobi(now = new Date()): { from: Date; to: Date } {
  const naiDayStart = Math.floor((now.getTime() + NAIROBI_OFFSET_MS) / DAY_MS) * DAY_MS;
  return {
    from: new Date(naiDayStart - DAY_MS - NAIROBI_OFFSET_MS),
    to: new Date(naiDayStart - NAIROBI_OFFSET_MS)
  };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface DigestWindow {
  from: Date;
  to: Date;
}

/** Build the digest text. Pure read - no sending. */
export async function buildFarmDigest({ from, to }: DigestWindow): Promise<string> {
  const [readings, alerts, commands, devices] = await Promise.all([
    prisma.sensorReading.findMany({
      where: { createdAt: { gte: from, lt: to } },
      orderBy: { createdAt: 'asc' },
      select: { metric: true, value: true, createdAt: true },
      take: 10_000
    }),
    prisma.farmAlert.findMany({
      where: { createdAt: { gte: from, lt: to } },
      orderBy: { createdAt: 'asc' },
      take: 50
    }),
    prisma.deviceCommand.findMany({
      where: { createdAt: { gte: from, lt: to } },
      orderBy: { createdAt: 'asc' },
      take: 50,
      include: { device: { select: { name: true } } }
    }),
    prisma.sensorDevice.findMany({ select: { name: true, zone: true, active: true, lastSeenAt: true } })
  ]);

  const naiFrom = new Date(from.getTime() + NAIROBI_OFFSET_MS); // render dates in Nairobi
  const dateLabel = `${naiFrom.getUTCDate()} ${MONTHS[naiFrom.getUTCMonth()]} ${naiFrom.getUTCFullYear()}`;
  const lines: string[] = ['', `📅 ${dateLabel} (Nairobi)`];

  // Readings: one compact line per metric.
  if (!readings.length) {
    lines.push('', '📭 No readings arrived in this window.');
  } else {
    const byMetric = new Map<string, number[]>();
    for (const r of readings) {
      const arr = byMetric.get(r.metric) || [];
      arr.push(r.value);
      byMetric.set(r.metric, arr);
    }
    lines.push('', '📊 Ground readings:');
    for (const [metric, values] of byMetric) {
      const min = Math.min(...values);
      const max = Math.max(...values);
      const avg = values.reduce((s, v) => s + v, 0) / values.length;
      const delta = values[values.length - 1] - values[0];
      const arrow = Math.abs(delta) < 1e-9 ? '→' : delta > 0 ? '↑' : '↓';
      lines.push(
        `• ${metricMeta(metric).label}: last ${formatValue(metric, values[values.length - 1])}` +
        ` (avg ${formatValue(metric, avg)}, min ${formatValue(metric, min)}, max ${formatValue(metric, max)})` +
        ` ${arrow} ${delta > 0 ? '+' : ''}${formatValue(metric, delta)} · ${values.length} reading${values.length === 1 ? '' : 's'}`
      );
    }
  }

  // Alerts fired in the window.
  lines.push('', `⚠️ Alerts (${alerts.length}):`);
  if (!alerts.length) lines.push('• None — quiet day.');
  for (const a of alerts.slice(0, 10)) {
    lines.push(`• ${a.severity === 'critical' ? '🚨' : a.severity === 'warning' ? '⚠️' : 'ℹ️'} ${a.message} [${a.status}]`);
  }
  if (alerts.length > 10) lines.push(`• …and ${alerts.length - 10} more`);

  // Commands executed.
  lines.push('', `⚡ Commands (${commands.length}):`);
  if (!commands.length) lines.push('• None.');
  for (const c of commands.slice(0, 10)) {
    lines.push(`• ${c.device?.name || c.deviceId}: ${c.command.replace('_', ' ')} — ${c.status}`);
  }

  // Device health: active devices that had not reported since before the window.
  const silent = devices.filter((d) => d.active && (!d.lastSeenAt || d.lastSeenAt < from));
  lines.push('', '📴 Devices silent since before the window:');
  if (!silent.length) lines.push('• All active devices reported.');
  for (const d of silent) lines.push(`• ${d.name}${d.zone ? ` (${d.zone})` : ''}`);

  const site = process.env.NEXT_PUBLIC_SITE_URL || 'https://ethasfish.co.ke';
  lines.push('', `Open the portal: ${site}/admin/farm`);
  return `🐟 Ethasfish daily digest${lines.join('\n')}`;
}

export interface DigestResult {
  digest: string;
  sent: number;
  skipped: string | null;
}

/**
 * Build the digest and (when `send`) push it to the configured recipients.
 * Same defensive contract as alerts: never throws, always returns the text
 * so the staff-facing endpoint can preview it even without WhatsApp.
 */
export async function sendFarmDigest(win: DigestWindow, send: boolean): Promise<DigestResult> {
  const digest = await buildFarmDigest(win);
  if (!send) return { digest, sent: 0, skipped: 'preview only - not sent' };

  if (!process.env.WHATSAPP_TOKEN || !process.env.WHATSAPP_PHONE_NUMBER_ID) {
    return { digest, sent: 0, skipped: 'WhatsApp not configured' };
  }
  const settings = await prisma.businessSettings.findUnique({ where: { id: 'singleton' } });
  const recipients = parseRecipients(settings?.farmAlertPhones);
  if (!recipients.length) return { digest, sent: 0, skipped: 'no recipients configured' };

  let sent = 0;
  for (const to of recipients) {
    if (await sendWhatsAppText(to, digest)) sent++;
  }
  if (sent) {
    await logActivity({
      actorType: 'system',
      actorId: 'farm-digest',
      actorName: 'Farm Digest',
      action: 'farm.digest.send',
      summary: `daily digest sent to ${sent} number(s) (${recipients.length} configured)`
    }).catch(() => {});
  }
  return { digest, sent, skipped: sent === recipients.length ? null : 'some sends failed' };
}
