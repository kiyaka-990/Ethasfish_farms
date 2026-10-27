// Farm Intelligence device simulator - proves the whole ground loop
// without hardware (and doubles as the reference for real firmware).
//
//   node scripts/simulate-farm.mjs seed     create 3 demo devices + rules, print tokens
//   node scripts/simulate-farm.mjs run [n]  post n scenarios (default 14) to the ingest API;
//                                           the water level drifts below the rule threshold so
//                                           you see an alert fire and pump_on get queued/delivered
//   node scripts/simulate-farm.mjs clean    remove everything the seed created
//
// Base URL: BASE_URL env var, default http://localhost:3001
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const require = createRequire(import.meta.url);

// Same env as the other scripts (equivalent to `dotenv -e .env.local --`).
try {
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
  require('dotenv').config({ path: path.join(root, '.env.local') });
} catch { /* env may already be set */ }

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const BASE = process.env.BASE_URL || 'http://localhost:3001';

const DEVICE_NAMES = {
  sensor: 'Pond 1 Sensor',
  pump: 'Pump House',
  aerator: 'Pond Aerator'
};

async function seed() {
  const devices = [];
  for (const [kind, name] of Object.entries(DEVICE_NAMES)) {
    let d = await prisma.sensorDevice.findFirst({ where: { name } });
    if (!d) {
      // token generation is trivial - keep the script dependency-free
      const token = 'efdev_' + Array.from({ length: 36 }, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('');
      d = await prisma.sensorDevice.create({ data: { name, zone: kind === 'sensor' ? 'Pond 1' : 'Pump house', kind, token } });
    }
    devices.push(d);
    console.log(`${name} [${d.kind}] token: ${d.token}`);
  }
  const byName = Object.fromEntries(devices.map((d) => [d.name, d]));

  const rules = [
    { name: 'Pond needs water', metric: 'water_level_pct', comparator: 'lt', threshold: 35, hysteresis: 3, severity: 'warning', action: 'pump_on', target: DEVICE_NAMES.pump, cooldownMinutes: 5 },
    { name: 'Water too warm', metric: 'temperature_c', comparator: 'gt', threshold: 32, hysteresis: 1, severity: 'critical', action: 'aerator_on', target: DEVICE_NAMES.aerator, cooldownMinutes: 60 },
    { name: 'Low dissolved oxygen', metric: 'dissolved_oxygen', comparator: 'lt', threshold: 4, hysteresis: 0.5, severity: 'critical', action: 'aerator_on', target: DEVICE_NAMES.aerator, cooldownMinutes: 30 },
    { name: 'pH drifting alkaline', metric: 'ph', comparator: 'gt', threshold: 8.6, hysteresis: 0.1, severity: 'info', action: null, target: null, cooldownMinutes: 120 }
  ];
  for (const r of rules) {
    const exists = await prisma.sensorRule.findFirst({ where: { name: r.name } });
    if (!exists) {
      await prisma.sensorRule.create({
        data: {
          name: r.name, metric: r.metric, comparator: r.comparator, threshold: r.threshold,
          hysteresis: r.hysteresis, severity: r.severity, action: r.action,
          targetDeviceId: r.target ? byName[r.target].id : null,
          cooldownMinutes: r.cooldownMinutes
        }
      });
      console.log(`rule: ${r.name} (${r.metric} ${r.comparator} ${r.threshold})${r.action ? ` -> ${r.action}` : ''}`);
    }
  }
  console.log('\nSeed complete. Start the server (npm run start) and run: node scripts/simulate-farm.mjs run');
}

async function post(token, readings) {
  const res = await fetch(`${BASE}/api/farm/ingest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Device-Token': token },
    body: JSON.stringify({ readings })
  });
  const text = await res.text();
  try { return { status: res.status, json: JSON.parse(text) }; } catch { return { status: res.status, text }; }
}

async function run(iterations = 14) {
  const sensor = await prisma.sensorDevice.findFirst({ where: { name: DEVICE_NAMES.sensor } });
  const pump = await prisma.sensorDevice.findFirst({ where: { name: DEVICE_NAMES.pump } });
  if (!sensor || !pump) throw new Error('Run `seed` first.');

  console.log(`Posting ${iterations} scenarios to ${BASE}/api/farm/ingest ...\n`);
  for (let i = 0; i < iterations; i++) {
    // A plausible day: temperature swells, water level drifts down (the
    // pump is not refilling), oxygen sags when the water is warmest.
    const temperature = Math.round((26.5 + 3 * Math.sin(i / 3)) * 10) / 10;
    const level = Math.round((44 - i * 1.1) * 10) / 10;
    const ph = Math.round((7.2 + 0.08 * Math.sin(i / 2)) * 100) / 100;
    const oxygen = Math.round((5.6 - Math.max(0, temperature - 27) * 0.35) * 100) / 100;

    const r = await post(sensor.token, [
      { metric: 'temperature_c', value: temperature },
      { metric: 'water_level_pct', value: level },
      { metric: 'ph', value: ph },
      { metric: 'dissolved_oxygen', value: oxygen }
    ]);
    const j = r.json || {};
    console.log(
      `#${String(i + 1).padStart(2)} temp ${temperature}°C  level ${level}%  pH ${ph}  DO ${oxygen} mg/L` +
      (j.alerts?.length ? `\n     🔔 ${j.alerts.map((a) => a.message).join('; ')}` : '') +
      (j.commands?.length ? `\n     ⚡ device told to: ${j.commands.map((c) => c.command).join(', ')}` : '')
    );

    if (i === iterations - 1) {
      // The pump polls - show what it would pick up.
      const poll = await fetch(`${BASE}/api/farm/ingest?token=${pump.token}`);
      const pj = await poll.json();
      console.log(`\nPump poll -> ${JSON.stringify(pj)}`);
    }
    await new Promise((r2) => setTimeout(r2, 400));
  }
  console.log('\nDone. Open Admin > Farm Intelligence to see the cards, chart, alerts and queued command.');
}

async function clean() {
  for (const name of Object.values(DEVICE_NAMES)) {
    const d = await prisma.sensorDevice.findFirst({ where: { name } });
    if (d) await prisma.sensorDevice.delete({ where: { id: d.id } }); // cascades readings/commands
    console.log(`removed device: ${name}`);
  }
  for (const name of ['Pond needs water', 'Water too warm', 'Low dissolved oxygen', 'pH drifting alkaline']) {
    const r = await prisma.sensorRule.findFirst({ where: { name } });
    if (r) {
      await prisma.farmAlert.deleteMany({ where: { ruleId: r.id } });
      await prisma.sensorRule.delete({ where: { id: r.id } });
      console.log(`removed rule: ${name}`);
    }
  }
  console.log('Clean complete.');
}

const mode = process.argv[2];
if (mode === 'seed') seed().finally(() => prisma.$disconnect());
else if (mode === 'run') run(Number(process.argv[3]) || 14).finally(() => prisma.$disconnect());
else if (mode === 'clean') clean().finally(() => prisma.$disconnect());
else {
  console.log('usage: node scripts/simulate-farm.mjs <seed|run [n]|clean>');
  process.exit(1);
}
