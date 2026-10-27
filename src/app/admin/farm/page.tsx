'use client';
// Admin > Farm Intelligence: the ground view.
//
//   - live metric cards (latest reading + rule-driven status colour)
//   - 48h trend chart with the active thresholds drawn on it
//   - alert feed (acknowledge/resolve) fed by the rules engine
//   - actuator panel: queue pump/aerator commands manually
//   - devices table (tokens for ESP32-style reporters) + threshold rules
//   - AI advisor: ToolLoopAgent over the same telemetry (read + audited writes)
//
// Polls the dashboard endpoint every 10s; devices report on their own
// cadence, so nothing here is push-based.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, AlertTriangle, Bot, CheckCircle2, Copy, Cpu, Droplets, Eye, EyeOff,
  Loader2, Plus, Send, Thermometer, Trash2, Waves, Wind, X, Power, PowerOff
} from 'lucide-react';
import toast from 'react-hot-toast';
import { ACTUATOR_COMMANDS, METRICS, metricMeta, formatValue } from '@/lib/farm-metrics';

interface Device {
  id: string; name: string; zone: string | null; kind: string; token: string;
  active: boolean; lastSeenAt: string | null; pendingCommands: number;
}
interface Rule {
  id: string; name: string; metric: string; comparator: string; threshold: number;
  hysteresis: number; severity: string; action: string | null; targetDeviceId: string | null;
  cooldownMinutes: number; enabled: boolean; lastFiredAt: string | null;
}
interface AlertT {
  id: string; metric: string; value: number; severity: string; message: string;
  status: string; createdAt: string; ruleId: string | null;
}
interface CommandT {
  id: string; deviceId: string; command: string; source: string; status: string;
  createdAt: string; device?: { name: string };
}
interface Reading { metric: string; value: number; createdAt: string; deviceId: string }
interface Dash {
  devices: Device[]; rules: Rule[]; alerts: AlertT[]; commands: CommandT[];
  series: Reading[]; seriesSince: string;
}

const SEVERITY_ORDER: Record<string, number> = { critical: 3, warning: 2, info: 1 };
const SEVERITY_CHIP: Record<string, string> = {
  critical: 'bg-red-500/15 text-red-500',
  warning: 'bg-amber-500/15 text-amber-600',
  info: 'bg-sky-500/15 text-sky-600'
};

/* ------------------------------ small bits ------------------------------ */

function ago(iso: string | null) {
  if (!iso) return 'never';
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function freshness(iso: string | null) {
  if (!iso) return { label: 'never seen', cls: 'text-muted' };
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 120) return { label: 'live', cls: 'text-emerald-500' };
  if (s < 900) return { label: 'idle', cls: 'text-amber-500' };
  return { label: 'offline', cls: 'text-red-500' };
}

function worstViolation(metric: string, value: number, rules: Rule[]): string | null {
  let worst: string | null = null;
  for (const r of rules) {
    if (!r.enabled || r.metric !== metric) continue;
    const hit = r.comparator === 'lt' ? value < r.threshold : value > r.threshold;
    if (!hit) continue;
    if (!worst || SEVERITY_ORDER[r.severity] > SEVERITY_ORDER[worst]) worst = r.severity;
  }
  return worst;
}

/* -------------------------------- chart -------------------------------- */

function MetricChart({ points, metric, rules }: { points: { t: number; v: number }[]; metric: string; rules: Rule[] }) {
  const W = 640, H = 210, L = 46, R = 14, T = 16, B = 26;

  if (points.length < 2) {
    return (
      <div className="h-[210px] flex items-center justify-center text-sm text-muted border-2 border-dashed border-[var(--border-color)] rounded-2xl">
        {points.length === 1 ? 'One reading so far — waiting for more data…' : 'No readings in this window yet.'}
      </div>
    );
  }

  const step = Math.max(1, Math.floor(points.length / 150));
  const pts = points.filter((_, i) => i % step === 0 || i === points.length - 1);
  const activeRules = rules.filter((r) => r.enabled && r.metric === metric);
  const values = pts.map((p) => p.v);
  let min = Math.min(...values, ...activeRules.map((r) => r.threshold));
  let max = Math.max(...values, ...activeRules.map((r) => r.threshold));
  if (min === max) { min -= 1; max += 1; } else { const pad = (max - min) * 0.12; min -= pad; max += pad; }

  const x = (i: number) => L + (i / (pts.length - 1)) * (W - L - R);
  const y = (v: number) => T + (1 - (v - min) / (max - min)) * (H - T - B);
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  const m = metricMeta(metric);
  const timeFmt = (t: number) => new Date(t).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[210px]" role="img" aria-label={`${m.label} trend`}>
      {[0, 0.5, 1].map((f) => {
        const v = min + f * (max - min);
        return (
          <g key={f}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="var(--border-color)" strokeWidth="1" />
            <text x={L - 6} y={y(v) + 3.5} textAnchor="end" fontSize="9" fill="var(--text-muted)">
              {v.toFixed(m.decimals)}
            </text>
          </g>
        );
      })}
      {activeRules.map((r) => (
        <g key={r.id}>
          <line
            x1={L} x2={W - R} y1={y(r.threshold)} y2={y(r.threshold)}
            stroke={r.severity === 'critical' ? '#ef4444' : r.severity === 'warning' ? '#f59e0b' : '#38bdf8'}
            strokeWidth="1" strokeDasharray="5 4" opacity="0.8"
          />
          <text x={W - R - 2} y={y(r.threshold) - 4} textAnchor="end" fontSize="9"
            fill={r.severity === 'critical' ? '#ef4444' : r.severity === 'warning' ? '#f59e0b' : '#38bdf8'}>
            {r.name} ({r.comparator === 'lt' ? '<' : '>'} {r.threshold})
          </text>
        </g>
      ))}
      <path d={d} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" />
      <circle cx={x(pts.length - 1)} cy={y(pts[pts.length - 1].v)} r="3.5" fill="var(--accent)" />
      <text x={L} y={H - 8} fontSize="9" fill="var(--text-muted)">{timeFmt(pts[0].t)}</text>
      <text x={W - R} y={H - 8} textAnchor="end" fontSize="9" fill="var(--text-muted)">{timeFmt(pts[pts.length - 1].t)}</text>
    </svg>
  );
}

/* -------------------------------- modals ------------------------------- */

function Modal({ title, icon, onClose, children, wide }: { title: string; icon: React.ReactNode; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className={`glass-strong relative rounded-3xl p-6 w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} max-h-[90vh] overflow-y-auto space-y-4`}>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold text-primary flex items-center gap-2">{icon}{title}</h2>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-[var(--surface-soft)]"><X className="w-4 h-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function DeviceForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: '', zone: '', kind: 'sensor' });
  const [saving, setSaving] = useState(false);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/admin/farm', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ op: 'device', ...form })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      onSaved();
      onClose();
      // Show the device token once, right where staff will copy it.
      await navigator.clipboard?.writeText(data.device.token).catch(() => {});
      toast.success(
        `Device added — token copied. Paste it into the device as X-Device-Token.`
      );
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal title="Add farm device" icon={<Cpu className="w-5 h-5 text-[var(--accent)]" />} onClose={onClose}>
      <form onSubmit={save} className="space-y-4">
        <label className="block text-sm">
          <span className="text-secondary">Name *</span>
          <input required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Pond 1 sensor" className="mt-1 w-full rounded-xl bg-[var(--surface-soft)] border border-[var(--border-color)] px-3 py-2" />
        </label>
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block text-sm">
            <span className="text-secondary">Zone / location</span>
            <input value={form.zone} onChange={(e) => setForm((f) => ({ ...f, zone: e.target.value }))}
              placeholder="Pond 1 / Pump house" className="mt-1 w-full rounded-xl bg-[var(--surface-soft)] border border-[var(--border-color)] px-3 py-2" />
          </label>
          <label className="block text-sm">
            <span className="text-secondary">Type</span>
            <select value={form.kind} onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value }))}
              className="mt-1 w-full rounded-xl bg-[var(--surface-soft)] border border-[var(--border-color)] px-3 py-2">
              <option value="sensor">Sensor (reports only)</option>
              <option value="combo">Combo (senses + switches)</option>
              <option value="pump">Pump (actuator)</option>
              <option value="aerator">Aerator (actuator)</option>
            </select>
          </label>
        </div>
        <p className="text-[11px] text-muted">
          The device authenticates with a generated token — it&apos;s copied to your clipboard on save and always
          visible in the devices table. POST readings to <code>/api/farm/ingest</code>.
        </p>
        <div className="flex justify-end gap-3 pt-1">
          <button type="button" onClick={onClose} className="btn-secondary text-sm">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary text-sm">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Add device
          </button>
        </div>
      </form>
    </Modal>
  );
}

const EMPTY_RULE = { name: '', metric: 'water_level_pct', comparator: 'lt', threshold: '35', hysteresis: '3', severity: 'warning', action: '', targetDeviceId: '', cooldownMinutes: '30' };

function RuleForm({ devices, onClose, onSaved }: { devices: Device[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState(EMPTY_RULE);
  const [saving, setSaving] = useState(false);
  const actuators = devices.filter((d) => d.kind !== 'sensor' && d.active);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/admin/farm', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          op: 'rule', ...form,
          threshold: Number(form.threshold),
          hysteresis: Number(form.hysteresis),
          cooldownMinutes: Number(form.cooldownMinutes),
          action: form.action || null,
          targetDeviceId: form.action ? form.targetDeviceId : null
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      toast.success('Rule created');
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Add threshold rule" icon={<AlertTriangle className="w-5 h-5 text-[var(--accent)]" />} onClose={onClose}>
      <form onSubmit={save} className="space-y-4">
        <label className="block text-sm">
          <span className="text-secondary">Rule name *</span>
          <input required value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Pond needs water"
            className="mt-1 w-full rounded-xl bg-[var(--surface-soft)] border border-[var(--border-color)] px-3 py-2" />
        </label>
        <div className="grid sm:grid-cols-3 gap-4">
          <label className="block text-sm">
            <span className="text-secondary">Metric *</span>
            <select value={form.metric} onChange={(e) => set('metric', e.target.value)}
              className="mt-1 w-full rounded-xl bg-[var(--surface-soft)] border border-[var(--border-color)] px-3 py-2">
              {Object.entries(METRICS).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-secondary">Condition *</span>
            <select value={form.comparator} onChange={(e) => set('comparator', e.target.value)}
              className="mt-1 w-full rounded-xl bg-[var(--surface-soft)] border border-[var(--border-color)] px-3 py-2">
              <option value="lt">below (&lt;)</option>
              <option value="gt">above (&gt;)</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-secondary">Threshold *</span>
            <input type="number" step="any" required value={form.threshold} onChange={(e) => set('threshold', e.target.value)}
              className="mt-1 w-full rounded-xl bg-[var(--surface-soft)] border border-[var(--border-color)] px-3 py-2" />
          </label>
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          <label className="block text-sm">
            <span className="text-secondary">Severity</span>
            <select value={form.severity} onChange={(e) => set('severity', e.target.value)}
              className="mt-1 w-full rounded-xl bg-[var(--surface-soft)] border border-[var(--border-color)] px-3 py-2">
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="critical">Critical</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-secondary">Hysteresis</span>
            <input type="number" step="any" value={form.hysteresis} onChange={(e) => set('hysteresis', e.target.value)}
              title="Value must return this far past the threshold before the alert auto-resolves"
              className="mt-1 w-full rounded-xl bg-[var(--surface-soft)] border border-[var(--border-color)] px-3 py-2" />
          </label>
          <label className="block text-sm">
            <span className="text-secondary">Cooldown (min)</span>
            <input type="number" min={1} value={form.cooldownMinutes} onChange={(e) => set('cooldownMinutes', e.target.value)}
              className="mt-1 w-full rounded-xl bg-[var(--surface-soft)] border border-[var(--border-color)] px-3 py-2" />
          </label>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block text-sm">
            <span className="text-secondary">Action (optional)</span>
            <select value={form.action} onChange={(e) => set('action', e.target.value)}
              className="mt-1 w-full rounded-xl bg-[var(--surface-soft)] border border-[var(--border-color)] px-3 py-2">
              <option value="">Alert only</option>
              {ACTUATOR_COMMANDS.map((c) => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-secondary">Target device {form.action ? '*' : ''}</span>
            <select required={!!form.action} value={form.targetDeviceId} onChange={(e) => set('targetDeviceId', e.target.value)}
              className="mt-1 w-full rounded-xl bg-[var(--surface-soft)] border border-[var(--border-color)] px-3 py-2">
              <option value="">—</option>
              {actuators.map((d) => <option key={d.id} value={d.id}>{d.name}{d.zone ? ` (${d.zone})` : ''}</option>)}
            </select>
          </label>
        </div>
        <p className="text-[11px] text-muted">
          With an action, the rule queues a command for the target device on the next time it polls. Keep device-side
          safety cutoffs in firmware (never run a pump dry) — rules are not a safety system.
        </p>
        <div className="flex justify-end gap-3 pt-1">
          <button type="button" onClick={onClose} className="btn-secondary text-sm">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary text-sm">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Create rule
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* -------------------------------- page --------------------------------- */

export default function FarmIntelligencePage() {
  const [data, setData] = useState<Dash | null>(null);
  const [loading, setLoading] = useState(true);
  const [deviceForm, setDeviceForm] = useState(false);
  const [ruleForm, setRuleForm] = useState(false);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [chartMetric, setChartMetric] = useState('temperature_c');
  const [advisorPrompt, setAdvisorPrompt] = useState('Review the last 24 hours of readings and tell me what needs attention — and what to do about it.');
  const [advisorText, setAdvisorText] = useState('');
  const [advisorBusy, setAdvisorBusy] = useState(false);
  const seenRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/farm');
      const d = await res.json();
      if (res.ok) {
        setData(d);
        if (!seenRef.current && d.series?.length) {
          seenRef.current = true;
          const metrics = new Set<string>((d.series as Reading[]).map((r) => r.metric));
          if (!metrics.has('temperature_c')) setChartMetric([...metrics][0] || 'temperature_c');
        }
      }
    } catch { /* keep last snapshot on a transient failure */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(() => { if (!document.hidden) load(); }, 10_000);
    return () => clearInterval(t);
  }, [load]);

  const latest = useMemo(() => {
    const map = new Map<string, { value: number; at: string }>();
    for (const r of data?.series || []) map.set(r.metric, { value: r.value, at: r.createdAt }); // ascending → last wins
    return map;
  }, [data]);

  const seriesByMetric = useMemo(() => {
    const map = new Map<string, { t: number; v: number }[]>();
    for (const r of data?.series || []) {
      const arr = map.get(r.metric) || [];
      arr.push({ t: new Date(r.createdAt).getTime(), v: r.value });
      map.set(r.metric, arr);
    }
    return map;
  }, [data]);

  const openAlerts = useMemo(() => (data?.alerts || []).filter((a) => a.status === 'open'), [data]);
  const rules = data?.rules || [];
  const devices = data?.devices || [];
  const chartPoints = seriesByMetric.get(chartMetric) || [];
  const presentMetrics = useMemo(() => {
    const known = Object.keys(METRICS);
    const extras = [...new Set((data?.series || []).map((r) => r.metric))].filter((m) => !known.includes(m));
    return [...known, ...extras];
  }, [data]);

  const actuatorState = (device: Device) => {
    const last = (data?.commands || []).find((c) => c.deviceId === device.id && c.status !== 'failed');
    if (!last) return null;
    return last.command.endsWith('_on');
  };

  async function apiCall(opts: { method: string; body?: any; url?: string }, okMsg: string) {
    try {
      const res = await fetch(opts.url || '/api/admin/farm', {
        method: opts.method,
        headers: opts.body ? { 'Content-Type': 'application/json' } : undefined,
        body: opts.body ? JSON.stringify(opts.body) : undefined
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Request failed');
      toast.success(okMsg);
      load();
      return d;
    } catch (e: any) {
      toast.error(e.message);
      return null;
    }
  }

  function queueManual(device: Device, command: string) {
    if (!confirm(`Queue "${command.replace('_', ' ')}" for ${device.name}? It runs on the device's next poll.`)) return;
    apiCall({ method: 'POST', body: { op: 'command', deviceId: device.id, command } }, `Queued ${command} for ${device.name}`);
  }

  async function runAdvisor(prompt?: string) {
    const message = (prompt ?? advisorPrompt).trim();
    if (!message) return;
    setAdvisorBusy(true);
    try {
      const res = await fetch('/api/admin/farm/advisor', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Advisor failed');
      setAdvisorText(d.reply);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setAdvisorBusy(false);
    }
  }

  if (loading && !data) {
    return <div className="glass rounded-3xl p-12 text-center"><Loader2 className="w-6 h-6 animate-spin text-[var(--accent)] mx-auto" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-primary flex items-center gap-2">
            <Cpu className="w-6 h-6 text-[var(--accent)]" /> Farm Intelligence
          </h1>
          <p className="text-sm text-muted mt-1 flex items-center gap-2">
            <Activity className="w-3.5 h-3.5" /> Live ground telemetry — auto-refreshes every 10s.
          </p>
        </div>
        <button onClick={() => setRuleForm(true)} className="btn-secondary text-sm"><AlertTriangle className="w-4 h-4" /> Add Rule</button>
        <button onClick={() => setDeviceForm(true)} className="btn-primary"><Plus className="w-4 h-4" /> Add Device</button>
      </div>

      {/* metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        {presentMetrics.map((metric) => {
          const latestM = latest.get(metric);
          const sev = latestM ? worstViolation(metric, latestM.value, rules) : null;
          const cardCls = sev === 'critical' ? 'border-red-500/40'
            : sev === 'warning' ? 'border-amber-500/40'
            : sev === 'info' ? 'border-sky-500/30' : 'border-[var(--border-color)]';
          const Icon = metric === 'temperature_c' ? Thermometer : metric === 'water_level_pct' ? Droplets
            : metric === 'dissolved_oxygen' ? Wind : metric === 'ph' ? Waves : Activity;
          return (
            <div key={metric} className={`glass rounded-2xl p-4 border ${cardCls}`}>
              <p className="text-[11px] uppercase tracking-wide text-muted flex items-center gap-1.5">
                <Icon className="w-3.5 h-3.5 text-[var(--accent)]" /> {metricMeta(metric).label}
              </p>
              <p className="font-display text-2xl font-bold text-primary mt-1.5">
                {latestM ? formatValue(metric, latestM.value) : <span className="text-muted text-lg">—</span>}
              </p>
              <p className="text-[11px] text-muted mt-0.5 flex items-center justify-between">
                <span>{latestM ? ago(latestM.at) : 'no data'}</span>
                {sev && <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${SEVERITY_CHIP[sev]}`}>{sev}</span>}
              </p>
            </div>
          );
        })}
      </div>

      {/* open alerts */}
      {openAlerts.length > 0 && (
        <div className="glass rounded-3xl p-4 border border-red-500/30 space-y-2">
          <p className="text-sm font-semibold text-red-500 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> {openAlerts.length} open alert{openAlerts.length > 1 ? 's' : ''}
          </p>
          {openAlerts.slice(0, 4).map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-primary truncate">{a.message}</span>
              <span className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-muted">{ago(a.createdAt)}</span>
                <button onClick={() => apiCall({ method: 'PATCH', body: { type: 'alert', id: a.id, status: 'acknowledged' } }, 'Alert acknowledged')}
                  className="text-xs rounded-lg border border-[var(--border-color)] px-2 py-1 hover:bg-[var(--surface-soft)]">Acknowledge</button>
                <button onClick={() => apiCall({ method: 'PATCH', body: { type: 'alert', id: a.id, status: 'resolved' } }, 'Alert resolved')}
                  className="text-xs rounded-lg border border-[var(--border-color)] px-2 py-1 hover:bg-[var(--surface-soft)]">Resolve</button>
              </span>
            </div>
          ))}
        </div>
      )}

      {/* chart + advisor */}
      <div className="grid lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 glass rounded-3xl p-5 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="font-display text-lg font-bold text-primary">48-hour trend</h2>
            <div className="flex flex-wrap gap-1.5">
              {presentMetrics.filter((m) => seriesByMetric.has(m)).map((m) => (
                <button key={m} onClick={() => setChartMetric(m)}
                  className={`text-xs rounded-full px-3 py-1 border transition-colors ${chartMetric === m
                    ? 'bg-[var(--accent)] text-white border-transparent'
                    : 'border-[var(--border-color)] text-secondary hover:bg-[var(--surface-soft)]'}`}>
                  {metricMeta(m).label}
                </button>
              ))}
            </div>
          </div>
          <MetricChart points={chartPoints} metric={chartMetric} rules={rules} />
          <p className="text-[11px] text-muted">Dashed lines are your active thresholds — alerts fire when a reading crosses one, and auto-resolve once it clearly returns (hysteresis).</p>
        </div>

        <div className="glass rounded-3xl p-5 space-y-3">
          <h2 className="font-display text-lg font-bold text-primary flex items-center gap-2">
            <Bot className="w-5 h-5 text-[var(--accent)]" /> AI Farm Advisor
          </h2>
          <p className="text-xs text-muted">Reads the same live telemetry, alerts and rules; can queue pump/aerator commands (audited) when you ask it to act.</p>
          <div className="flex flex-wrap gap-1.5">
            {['Should I pump now?', 'Water level & temperature report', 'Anything at risk overnight?'].map((q) => (
              <button key={q} onClick={() => { setAdvisorPrompt(q); runAdvisor(q); }} disabled={advisorBusy}
                className="text-[11px] rounded-full border border-[var(--border-color)] px-2.5 py-1 text-secondary hover:bg-[var(--surface-soft)] disabled:opacity-50">
                {q}
              </button>
            ))}
          </div>
          <textarea
            value={advisorPrompt}
            onChange={(e) => setAdvisorPrompt(e.target.value)}
            rows={3}
            placeholder="Ask about conditions, timing, what to run…"
            className="w-full rounded-xl bg-[var(--surface-soft)] border border-[var(--border-color)] px-3 py-2 text-sm text-primary outline-none focus:border-[var(--accent)]"
          />
          <button onClick={() => runAdvisor()} disabled={advisorBusy} className="btn-primary w-full text-sm">
            {advisorBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {advisorBusy ? 'Reading the farm…' : 'Ask advisor'}
          </button>
          {(advisorBusy || advisorText) && (
            <div className="rounded-xl bg-[var(--surface-soft)] border border-[var(--border-color)] p-3 text-sm text-primary whitespace-pre-wrap min-h-[48px]">
              {advisorBusy && !advisorText ? <span className="text-muted text-xs">Thinking…</span> : advisorText}
            </div>
          )}
        </div>
      </div>

      {/* alerts + actuators */}
      <div className="grid lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 glass rounded-3xl p-5 space-y-3">
          <h2 className="font-display text-lg font-bold text-primary">Alert feed</h2>
          {(data?.alerts || []).length === 0 ? (
            <p className="text-sm text-muted py-6 text-center border-2 border-dashed border-[var(--border-color)] rounded-2xl">
              Nothing has fired yet. Rules you create show up here the moment a reading crosses a threshold.
            </p>
          ) : (
            <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
              {data!.alerts.map((a) => (
                <div key={a.id} className={`rounded-xl border px-3 py-2.5 flex items-start justify-between gap-3 ${a.status === 'open' ? 'border-red-500/30 bg-red-500/5' : 'border-[var(--border-color)] opacity-70'}`}>
                  <div className="min-w-0">
                    <p className="text-sm text-primary">{a.message}</p>
                    <p className="text-[11px] text-muted mt-0.5 flex items-center gap-2">
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${SEVERITY_CHIP[a.severity] || SEVERITY_CHIP.info}`}>{a.severity}</span>
                      {ago(a.createdAt)} · {a.status}
                    </p>
                  </div>
                  {a.status !== 'resolved' && (
                    <button
                      onClick={() => apiCall({ method: 'PATCH', body: { type: 'alert', id: a.id, status: a.status === 'open' ? 'acknowledged' : 'resolved' } }, 'Alert updated')}
                      className="text-xs rounded-lg border border-[var(--border-color)] px-2 py-1 hover:bg-[var(--surface-soft)] shrink-0">
                      {a.status === 'open' ? 'Acknowledge' : 'Resolve'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="glass rounded-3xl p-5 space-y-3">
          <h2 className="font-display text-lg font-bold text-primary flex items-center gap-2">
            <Power className="w-5 h-5 text-[var(--accent)]" /> Actuators
          </h2>
          {devices.filter((d) => d.kind !== 'sensor').length === 0 ? (
            <p className="text-sm text-muted py-6 text-center border-2 border-dashed border-[var(--border-color)] rounded-2xl">
              No pumps/aerators registered. Add a device with type pump or aerator to control it from here.
            </p>
          ) : (
            devices.filter((d) => d.kind !== 'sensor').map((d) => {
              const on = actuatorState(d);
              const cmds = d.kind === 'pump' ? ['pump_on', 'pump_off'] : d.kind === 'aerator' ? ['aerator_on', 'aerator_off'] : ACTUATOR_COMMANDS;
              return (
                <div key={d.id} className="rounded-xl border border-[var(--border-color)] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-primary truncate">{d.name}</p>
                      <p className="text-[11px] text-muted">{d.zone || d.kind} · {freshness(d.lastSeenAt).label} {d.pendingCommands > 0 && `· ${d.pendingCommands} queued`}</p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-[11px] font-semibold ${on === true ? 'bg-emerald-500/15 text-emerald-600' : on === false ? 'bg-[var(--surface-soft)] text-muted' : 'bg-[var(--surface-soft)] text-muted'}`}>
                      {on === true ? 'ON' : on === false ? 'OFF' : '—'}
                    </span>
                  </div>
                  <div className="flex gap-2 mt-2.5">
                    {cmds.map((c) => (
                      <button key={c} onClick={() => queueManual(d, c)}
                        className={`flex-1 text-xs rounded-lg px-2 py-1.5 border flex items-center justify-center gap-1 ${c.endsWith('_on')
                          ? 'border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10'
                          : 'border-[var(--border-color)] text-secondary hover:bg-[var(--surface-soft)]'}`}>
                        {c.endsWith('_on') ? <Power className="w-3 h-3" /> : <PowerOff className="w-3 h-3" />}
                        {c.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })
          )}
          {(data?.commands || []).length > 0 && (
            <div className="pt-1 space-y-1">
              <p className="text-[11px] uppercase tracking-wide text-muted">Recent commands</p>
              {data!.commands.slice(0, 5).map((c) => (
                <p key={c.id} className="text-xs text-secondary flex items-center justify-between gap-2">
                  <span className="truncate">{c.device?.name || c.deviceId}: <b>{c.command.replace('_', ' ')}</b> <span className="text-muted">({c.source})</span></span>
                  <span className={`shrink-0 ${c.status === 'delivered' || c.status === 'done' ? 'text-emerald-500' : 'text-muted'}`}>{c.status} · {ago(c.createdAt)}</span>
                </p>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* devices + rules */}
      <div className="grid lg:grid-cols-2 gap-6 items-start">
        <div className="glass rounded-3xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-primary">Devices</h2>
            <button onClick={() => setDeviceForm(true)} className="btn-secondary text-xs"><Plus className="w-3.5 h-3.5" /> Add</button>
          </div>
          {devices.length === 0 ? (
            <p className="text-sm text-muted py-8 text-center border-2 border-dashed border-[var(--border-color)] rounded-2xl">
              No devices yet. Add one to get its token, then point your sensor (ESP32/Arduino) at
              <code className="mx-1">/api/farm/ingest</code>. No hardware? Run <code className="mx-1">node scripts/simulate-farm.mjs</code>.
            </p>
          ) : (
            <div className="space-y-2">
              {devices.map((d) => {
                const f = freshness(d.lastSeenAt);
                return (
                  <div key={d.id} className="rounded-xl border border-[var(--border-color)] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-primary truncate">
                          {d.name} <span className="text-[10px] uppercase text-muted ml-1">{d.kind}</span>
                          {!d.active && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--surface-soft)] text-muted">disabled</span>}
                        </p>
                        <p className="text-[11px] text-muted">{d.zone || 'no zone'} · seen <span className={f.cls}>{ago(d.lastSeenAt)} ({f.label})</span>{d.pendingCommands > 0 && ` · ${d.pendingCommands} command queued`}</p>
                      </div>
                      <span className="flex items-center gap-1 shrink-0">
                        <button onClick={() => setRevealed((r) => ({ ...r, [d.id]: !r[d.id] }))}
                          aria-label={revealed[d.id] ? 'Hide token' : 'Reveal token'}
                          className="p-1.5 rounded-lg hover:bg-[var(--surface-soft)] text-muted">
                          {revealed[d.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                        <button onClick={() => { navigator.clipboard?.writeText(d.token); toast.success('Token copied'); }}
                          aria-label="Copy token" className="p-1.5 rounded-lg hover:bg-[var(--surface-soft)] text-muted">
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => apiCall({ method: 'PATCH', body: { type: 'device', id: d.id, active: !d.active } }, d.active ? 'Device disabled' : 'Device enabled')}
                          aria-label={d.active ? 'Disable device' : 'Enable device'}
                          className="text-[11px] rounded-lg border border-[var(--border-color)] px-2 py-1 hover:bg-[var(--surface-soft)]">
                          {d.active ? 'Disable' : 'Enable'}
                        </button>
                        <button onClick={() => {
                          if (confirm(`Remove device "${d.name}"? Its readings and queued commands are deleted.`)) {
                            apiCall({ method: 'DELETE', url: `/api/admin/farm?type=device&id=${d.id}` }, 'Device removed');
                          }
                        }} aria-label="Delete device" className="p-1.5 rounded-lg hover:bg-[var(--surface-soft)] text-red-500">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    </div>
                    <p className="mt-2 font-mono text-[11px] text-muted bg-[var(--surface-soft)] rounded-lg px-2 py-1 truncate select-all">
                      {revealed[d.id] ? d.token : 'efdev_' + '•'.repeat(24)}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="glass rounded-3xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-primary">Threshold rules</h2>
            <button onClick={() => setRuleForm(true)} className="btn-secondary text-xs"><Plus className="w-3.5 h-3.5" /> Add rule</button>
          </div>
          {rules.length === 0 ? (
            <p className="text-sm text-muted py-8 text-center border-2 border-dashed border-[var(--border-color)] rounded-2xl">
              No rules yet. Add one — e.g. water level below 35% → warn + queue pump_on — and the engine watches it 24/7.
            </p>
          ) : (
            <div className="space-y-2">
              {rules.map((r) => (
                <div key={r.id} className={`rounded-xl border p-3 ${r.enabled ? 'border-[var(--border-color)]' : 'border-[var(--border-color)] opacity-55'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-primary">
                        {r.name} <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${SEVERITY_CHIP[r.severity] || SEVERITY_CHIP.info}`}>{r.severity}</span>
                      </p>
                      <p className="text-[11px] text-muted mt-0.5">
                        {metricMeta(r.metric).label} {r.comparator === 'lt' ? '<' : '>'} {formatValue(r.metric, r.threshold)}
                        {r.hysteresis > 0 && ` · clears at ${r.comparator === 'lt' ? '≥' : '≤'} ${formatValue(r.metric, r.comparator === 'lt' ? r.threshold + r.hysteresis : r.threshold - r.hysteresis)}`}
                        {r.action && ` → ${r.action.replace('_', ' ')}`}
                        {r.lastFiredAt && ` · last fired ${ago(r.lastFiredAt)}`}
                      </p>
                    </div>
                    <span className="flex items-center gap-1 shrink-0">
                      <button onClick={() => apiCall({ method: 'PATCH', body: { type: 'rule', id: r.id, enabled: !r.enabled } }, r.enabled ? 'Rule disabled' : 'Rule enabled')}
                        className="text-[11px] rounded-lg border border-[var(--border-color)] px-2 py-1 hover:bg-[var(--surface-soft)]">
                        {r.enabled ? 'On' : 'Off'}
                      </button>
                      <button onClick={() => {
                        if (confirm(`Delete rule "${r.name}"?`)) apiCall({ method: 'DELETE', url: `/api/admin/farm?type=rule&id=${r.id}` }, 'Rule deleted');
                      }} aria-label="Delete rule" className="p-1.5 rounded-lg hover:bg-[var(--surface-soft)] text-red-500">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {deviceForm && <DeviceForm onClose={() => setDeviceForm(false)} onSaved={load} />}
      {ruleForm && <RuleForm devices={devices} onClose={() => setRuleForm(false)} onSaved={load} />}
    </div>
  );
}
