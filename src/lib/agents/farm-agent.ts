// The farm advisor agent - the "ground intelligence" member of the
// agentic fleet. Staff ask it things like "should I pump now?" and it
// answers from REAL telemetry: recent readings per metric, open alerts,
// device health, active rules.
//
// It can queue actuator commands (pump/aerator) through its queueCommand
// tool - the same queue the rules engine and dashboard use - so its
// advice can become action in one step. Every call lands in AgentRun and
// the audit trail, exactly like the stockist agent's writes.
import { ToolLoopAgent, tool } from 'ai';
import { z } from 'zod';
import { prisma } from '../prisma';
import { logActivity } from '../audit';
import { ACTUATOR_COMMANDS, formatValue, metricMeta, queueCommand } from '../farm';

const MODEL = 'anthropic/claude-haiku-4.5';
const FALLBACK_MODELS = ['openai/gpt-5.4', 'anthropic/claude-sonnet-4.6', 'alibaba/qwen-3-14b'];

function buildInstructions() {
  return `You are the Ethasfish Farms farm advisor - an internal tool for farm staff, not customers.

You watch the ground: water temperature, water level, pH, dissolved oxygen, humidity - whatever the farm's sensors report. Staff ask you when to pump, aerate, or check on a pond. You answer from REAL numbers only: always call getReadings before making a claim about conditions, and getAlerts for anything currently firing.

Ground rules for a tilapia farm (use as reasoning guide, always state the actual readings):
- Water temperature: ideal 25-30°C. Below 20°C fish stop feeding and grow poorly; above 32°C is stressful, and warm water holds less oxygen.
- Dissolved oxygen: below ~4 mg/L is dangerous - aerate. Hot + still water is the risk combination.
- pH: keep 6.5-8.5.
- Water level (%): refill when low (pump_on), stop well before full (pump_off with margin) - never chase the last percent.
- The rules engine already fires threshold alerts and queues commands automatically (see getRules). Do not repeat what the rules already do; your job is INTERPRETATION - trends, combinations, timing ("level dropped 8 points in 6h, refill tonight") - and action when staff ask.

Acting: queueCommand queues pump_on/pump_off/aerator_on/aerator_off for a named device; it does not switch anything instantly - the device picks it up on its next poll. Queue a command only when the readings clearly justify it AND staff asked you to act (or the situation is obviously urgent, e.g. oxygen collapsing). Otherwise RECOMMEND the command and let staff press the button. Always say WHY, quoting numbers, and say what you queued if you queued anything. After acting on an alert, resolveAlert it.

Unknown metrics or empty history: say plainly that no data came back for that window instead of guessing. Be concise: lead with the verdict, then the numbers.`;
}

function buildTools() {
  return {
    getReadings: tool({
      description:
        'Get sensor history: per metric the latest value, min/max/avg over the window, and a downsampled series. Default window 24h.',
      inputSchema: z.object({
        metric: z.string().optional().describe('Restrict to one metric, e.g. "water_level_pct"'),
        hours: z.number().min(1).max(168).default(24).describe('Window in hours')
      }),
      execute: async ({ metric, hours }) => {
        const since = new Date(Date.now() - hours * 3600_000);
        const rows = await prisma.sensorReading.findMany({
          where: {
            createdAt: { gte: since },
            ...(metric ? { metric } : {})
          },
          orderBy: { createdAt: 'asc' },
          take: 4000,
          select: { metric: true, value: true, createdAt: true }
        });
        if (!rows.length) return { windowHours: hours, metrics: {}, note: 'no readings in this window' };

        const byMetric = new Map<string, { values: number[]; first: Date; last: Date }>();
        for (const r of rows) {
          const e = byMetric.get(r.metric) || { values: [], first: r.createdAt, last: r.createdAt };
          e.values.push(r.value);
          e.last = r.createdAt;
          byMetric.set(r.metric, e);
        }
        const out: Record<string, any> = {};
        for (const [m, e] of byMetric) {
          const min = Math.min(...e.values);
          const max = Math.max(...e.values);
          const avg = e.values.reduce((s, v) => s + v, 0) / e.values.length;
          const step = Math.max(1, Math.floor(e.values.length / 12));
          out[m] = {
            label: metricMeta(m).label,
            latest: formatValue(m, e.values[e.values.length - 1]),
            min: formatValue(m, min),
            max: formatValue(m, max),
            avg: formatValue(m, avg),
            readings: e.values.length,
            from: e.first.toISOString(),
            to: e.last.toISOString(),
            trend: e.values.length > 1
              ? formatValue(m, e.values[e.values.length - 1] - e.values[0]) + ' over window'
              : 'single reading',
            sampled: e.values.filter((_, i) => i % step === 0).map((v) => Math.round(v * 100) / 100)
          };
        }
        return { windowHours: hours, metrics: out };
      }
    }),

    getAlerts: tool({
      description: 'Get farm alerts. Default: open ones only.',
      inputSchema: z.object({
        status: z.enum(['open', 'acknowledged', 'resolved']).default('open')
      }),
      execute: async ({ status }) => {
        const alerts = await prisma.farmAlert.findMany({
          where: { status },
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: { rule: { select: { name: true, action: true } } }
        });
        return alerts.map((a) => ({
          id: a.id,
          severity: a.severity,
          message: a.message,
          value: a.value,
          metric: a.metric,
          rule: a.rule?.name,
          action: a.rule?.action,
          at: a.createdAt.toISOString()
        }));
      }
    }),

    getDevices: tool({
      description: 'List farm devices: sensors and actuators, their zone, last-seen time and pending command count.',
      inputSchema: z.object({}),
      execute: async () => {
        const devices = await prisma.sensorDevice.findMany({
          orderBy: [{ zone: 'asc' }, { name: 'asc' }],
          include: { commands: { where: { status: 'pending' }, select: { command: true } } }
        });
        return devices.map((d) => ({
          id: d.id,
          name: d.name,
          zone: d.zone,
          kind: d.kind,
          active: d.active,
          lastSeen: d.lastSeenAt?.toISOString() || null,
          pendingCommands: d.commands.map((c) => c.command)
        }));
      }
    }),

    getRules: tool({
      description: 'List the automatic threshold rules (what the rules engine already does on its own).',
      inputSchema: z.object({}),
      execute: async () => {
        const rules = await prisma.sensorRule.findMany({ orderBy: { createdAt: 'asc' } });
        return rules.map((r) => ({
          name: r.name,
          condition: `${r.metric} ${r.comparator} ${r.threshold}`,
          severity: r.severity,
          action: r.action,
          enabled: r.enabled,
          cooldownMinutes: r.cooldownMinutes,
          lastFiredAt: r.lastFiredAt?.toISOString() || null
        }));
      }
    }),

    queueCommand: tool({
      description:
        'Queue an actuator command (pump_on / pump_off / aerator_on / aerator_off) for a device by name or id. The device runs it on its next poll.',
      inputSchema: z.object({
        device: z.string().describe('Device name or id, e.g. "Pump House"'),
        command: z.enum(ACTUATOR_COMMANDS),
        reason: z.string().describe('Why this action is warranted (quotes readings)')
      }),
      execute: async ({ device, command, reason }) => {
        const target = await prisma.sensorDevice.findFirst({
          where: {
            OR: [
              { id: device },
              { name: { equals: device, mode: 'insensitive' } },
              { name: { contains: device, mode: 'insensitive' } }
            ]
          }
        });
        if (!target) {
          return { queued: false, error: `No device matching "${device}" - call getDevices to see the names` };
        }
        if (target.kind === 'sensor') {
          return { queued: false, error: `"${target.name}" is a sensor, not an actuator - it cannot run ${command}` };
        }
        const cmd = await queueCommand(target.id, command, 'ai');
        await logActivity({
          actorType: 'agent',
          actorId: 'farm-advisor',
          actorName: 'Farm Advisor',
          action: 'farm.command.ai',
          entityType: 'DeviceCommand',
          entityId: cmd.id,
          summary: `queued ${command} for "${target.name}": ${reason.slice(0, 140)}`
        });
        return { queued: true, device: target.name, command, note: 'picked up on the device next poll' };
      }
    }),

    resolveAlert: tool({
      description: 'Mark an alert as acknowledged (you are dealing with it) after acting on it.',
      inputSchema: z.object({
        alertId: z.string(),
        note: z.string()
      }),
      execute: async ({ alertId, note }) => {
        const alert = await prisma.farmAlert.findUnique({ where: { id: alertId } });
        if (!alert) return { ok: false, error: 'alert not found' };
        await prisma.farmAlert.update({ where: { id: alertId }, data: { status: 'acknowledged' } });
        await logActivity({
          actorType: 'agent',
          actorId: 'farm-advisor',
          actorName: 'Farm Advisor',
          action: 'farm.alert.ack',
          entityType: 'FarmAlert',
          entityId: alertId,
          summary: `acknowledged alert: ${note.slice(0, 140)}`
        });
        return { ok: true, alert: alert.message };
      }
    })
  };
}

export interface FarmAdvisorResult {
  text: string;
}

export async function runFarmAdvisor(message: string): Promise<FarmAdvisorResult> {
  const agent = new ToolLoopAgent({
    model: MODEL,
    instructions: buildInstructions(),
    tools: buildTools(),
    maxOutputTokens: 900,
    providerOptions: { gateway: { models: FALLBACK_MODELS, tags: ['feature:farm-advisor'] } }
  });

  const result = await agent.generate({ messages: [{ role: 'user', content: message }] });

  const toolCalls = result.steps.flatMap((s) =>
    (s.toolCalls || []).map((tc: any) => ({ tool: tc.toolName, args: tc.input }))
  );

  await prisma.agentRun
    .create({
      data: {
        agentKey: 'farm-advisor',
        input: message,
        output: result.text,
        status: 'completed',
        toolCalls: JSON.stringify(toolCalls),
        model: MODEL,
        tokensUsed: (result.usage?.inputTokens || 0) + (result.usage?.outputTokens || 0)
      }
    })
    .catch(() => {});

  if (toolCalls.length) {
    await logActivity({
      actorType: 'agent',
      actorId: 'farm-advisor',
      actorName: 'Farm Advisor',
      action: 'agent.tool_call',
      summary: `used ${toolCalls.map((t) => t.tool).join(', ')} for a farm question`,
      metadata: { toolCalls }
    });
  }

  return { text: result.text };
}
