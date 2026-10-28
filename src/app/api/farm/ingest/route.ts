import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { evaluateRules, takeCommands } from '@/lib/farm';

export const dynamic = 'force-dynamic';

// Device-facing telemetry endpoint. Authenticated by the device's own
// token (X-Device-Token header or `token` in the body) - microcontrollers
// have no staff session. No Clerk/identity imports here on purpose.
//
//   POST { token, readings: [{ metric, value }, ...] }
//     -> stores readings, runs the rules engine, replies with any commands
//        queued for this device (pump_on etc).
//   GET  ?token=... (or X-Device-Token)
//     -> pure command poll for actuators that have nothing to report.

const MAX_READINGS = 40;

async function auth(req: NextRequest, bodyToken?: unknown) {
  const raw =
    req.headers.get('x-device-token') ||
    (typeof bodyToken === 'string' ? bodyToken : '') ||
    req.nextUrl.searchParams.get('token') ||
    '';
  const token = raw.trim();
  if (!token) return { error: 'device token required' } as const;
  const device = await prisma.sensorDevice.findUnique({ where: { token } });
  if (!device) return { error: 'invalid device token' } as const;
  if (!device.active) return { error: 'device is disabled' } as const;
  return { device } as const;
}

export async function POST(req: NextRequest) {
  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      /* empty body -> auth error below */
    }

    const a = await auth(req, body.token);
    if ('error' in a) return NextResponse.json({ error: a.error }, { status: 401 });
    const { device } = a;

    const input = Array.isArray(body.readings) ? body.readings : body.metric !== undefined ? [{ metric: body.metric, value: body.value }] : [];
    const readings: { metric: string; value: number }[] = [];
    for (const r of input.slice(0, MAX_READINGS)) {
      if (!r || typeof r.metric !== 'string' || !r.metric.trim()) continue;
      const v = Number(r.value);
      if (!Number.isFinite(v)) continue;
      readings.push({ metric: r.metric.trim().slice(0, 48), value: v });
    }
    if (!readings.length) {
      return NextResponse.json({ error: 'readings[] with metric/value required' }, { status: 400 });
    }

    await prisma.sensorDevice.update({
      where: { id: device.id },
      data: { lastSeenAt: new Date() }
    });
    await prisma.sensorReading.createMany({
      data: readings.map((r) => ({ deviceId: device.id, metric: r.metric, value: r.value }))
    });

    const fired = await evaluateRules(readings, device.id);
    const commands = await takeCommands(device.id);

    return NextResponse.json({
      ok: true,
      stored: readings.length,
      alerts: fired.alerts.map((x) => ({ id: x.id, severity: x.severity, message: x.message })),
      commands // what this device should do next
    });
  } catch (e: any) {
    console.error('[farm/ingest]', e);
    return NextResponse.json({ error: 'ingest failed' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const a = await auth(req);
    if ('error' in a) return NextResponse.json({ error: a.error }, { status: 401 });
    // A poll is proof of life even with nothing to report (actuators
    // usually never POST) - without this every pump would read "never seen".
    await prisma.sensorDevice.update({
      where: { id: a.device.id },
      data: { lastSeenAt: new Date() }
    });
    const commands = await takeCommands(a.device.id);
    return NextResponse.json({ ok: true, commands });
  } catch (e: any) {
    console.error('[farm/ingest]', e);
    return NextResponse.json({ error: 'poll failed' }, { status: 500 });
  }
}
