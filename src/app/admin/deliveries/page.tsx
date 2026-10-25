'use client';
// Dispatch board: live map of every bike, the unassigned order queue,
// driver assignment, and manual status overrides. Refetches every 5s
// while the tab is visible; the map only refits on first load so it
// never yanks around under the dispatcher's cursor.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Bike, MapPin, Package, Phone, Navigation, AlertTriangle, Users, BarChart3, Radio, CheckCircle2, ChevronDown, ChevronRight, Plus, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import { fmtKsh } from '@/lib/utils';
import dynamic from 'next/dynamic';

const LiveMap = dynamic(() => import('@/components/delivery/LiveMap'), { ssr: false, loading: () => <div className="glass rounded-2xl" style={{ height: 420 }} /> });

type Tab = 'dispatch' | 'drivers' | 'reports';

interface Driver {
  id: string; name: string; phone: string; plate: string | null; vehicle: string; active: boolean;
  lastLat: number | null; lastLng: number | null; lastSeenAt: string | null;
  staff?: { email: string; active: boolean } | null;
  _count?: { deliveries: number };
}
interface Delivery {
  id: string; status: string; destLat: number | null; destLng: number | null; assignedAt: string;
  order: { id: string; orderNumber: string; customerName: string; customerPhone: string; deliveryAddress: string; total: number; status: string; items: { quantity: number }[] };
  driver: Driver | null;
}
interface QueueOrder {
  id: string; orderNumber: string; customerName: string; customerPhone: string; deliveryAddress: string;
  total: number; status: string; notes: string | null; createdAt: string;
  items: { productName: string; variantLabel: string; quantity: number }[];
}
interface Reports {
  range: { days: number };
  totals: { delivered: number; cancelled: number; active: number; avgRideMin: number; avgWaitMin: number; onTimePct: number | null };
  series: { date: string; count: number }[];
  driverStats: { driverId: string; name: string; vehicle: string; plate: string | null; delivered: number; cancelled: number; avgRideMin: number; totalKm: number | null }[];
}

const VEHICLES = ['motorcycle', 'bicycle', 'van'] as const;
const VEHICLE_EMOJI: Record<string, string> = { motorcycle: '🏍️', bicycle: '🚲', van: '🚐' };

function timeAgo(iso: string | null): string {
  if (!iso) return 'never';
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

export default function AdminDeliveriesPage() {
  const [tab, setTab] = useState<Tab>('dispatch');
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [queue, setQueue] = useState<QueueOrder[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [assignFor, setAssignFor] = useState<string | null>(null); // orderId open in assign popover
  const [pinMode, setPinMode] = useState<string | null>(null);    // deliveryId awaiting a map click
  const [expanded, setExpanded] = useState<string | null>(null);
  const pausedRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/deliveries');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDeliveries(data.deliveries); setQueue(data.queue); setDrivers(data.drivers);
    } catch (e: any) { toast.error(e.message || 'Could not load dispatch board'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    const onVis = () => { pausedRef.current = document.hidden; };
    document.addEventListener('visibilitychange', onVis);
    const t = setInterval(() => { if (!pausedRef.current && document.visibilityState === 'visible') load(); }, 5000);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVis); };
  }, [load]);

  async function post(path: string, body: Record<string, unknown>, method = 'POST') {
    setBusy(true);
    try {
      const res = await fetch(path, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Failed'); return false; }
      return true;
    } catch { toast.error('Connection issue'); return false; }
    finally { setBusy(false); load(); }
  }

  const assign = (orderId: string, driverId: string) => {
    setAssignFor(null);
    post('/api/admin/deliveries', { orderId, driverId }).then(ok => ok && toast.success('Driver assigned'));
  };
  const action = async (deliveryId: string, a: string) => {
    const labels: Record<string, string> = { picked_up: 'Marked picked up', delivered: 'Marked delivered', unassign: 'Back to queue' };
    const ok = await post('/api/admin/deliveries', { deliveryId, action: a }, 'PATCH');
    if (ok) toast.success(labels[a]);
  };
  const onMapClick = async (lat: number, lng: number) => {
    if (!pinMode) return;
    const ok = await post('/api/admin/deliveries', { deliveryId: pinMode, lat, lng }, 'PATCH');
    setPinMode(null);
    if (ok) toast.success('Destination pin updated');
  };

  // Map markers: drivers (stale dimmed), active destinations.
  const markers = [
    ...deliveries.filter(d => d.driver?.lastLat != null).map(d => ({
      id: `drv-${d.driver!.id}`, lat: d.driver!.lastLat!, lng: d.driver!.lastLng!,
      kind: 'driver' as const, label: d.driver!.name,
      sub: `${d.order.orderNumber} · ${d.status === 'picked_up' ? 'riding' : 'assigned'}`,
      plate: d.driver!.plate,
      stale: d.driver!.lastSeenAt ? Date.now() - new Date(d.driver!.lastSeenAt).getTime() > 90_000 : true
    })),
    ...deliveries.filter(d => d.destLat != null && d.destLng != null).map(d => ({
      id: `dst-${d.id}`, lat: d.destLat!, lng: d.destLng!, kind: 'destination' as const,
      label: d.order.orderNumber, sub: d.order.customerName
    })),
    // Idle drivers with a stale-but-known position still show faintly.
    ...drivers.filter(dr => dr.active && dr.lastLat != null && !deliveries.some(d => d.driver?.id === dr.id)).map(dr => ({
      id: `idle-${dr.id}`, lat: dr.lastLat!, lng: dr.lastLng!, kind: 'driver' as const,
      label: dr.name, sub: 'idle', plate: dr.plate,
      stale: true
    }))
  ];

  const TABS: { id: Tab; label: string; Icon: typeof Bike }[] = [
    { id: 'dispatch', label: 'Dispatch', Icon: Navigation },
    { id: 'drivers', label: 'Drivers', Icon: Users },
    { id: 'reports', label: 'Reports', Icon: BarChart3 }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-primary flex items-center gap-2">
            <Bike className="w-6 h-6 text-[var(--accent)]" /> Deliveries
          </h1>
          <p className="text-sm text-muted mt-1">Live rider map, order queue, drivers and delivery reports. Refreshes every 5 seconds.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2 ${tab === t.id ? 'bg-gradient-to-br from-[var(--accent-light)] to-[var(--accent)] text-white' : 'text-secondary hover:text-primary hover:bg-[var(--surface)]'}`}>
              <t.Icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="glass rounded-3xl p-16 text-center"><Loader2 className="w-6 h-6 animate-spin text-[var(--accent)] mx-auto" /></div>
      ) : tab === 'dispatch' ? (
        <DispatchTab
          deliveries={deliveries} queue={queue} drivers={drivers} markers={markers}
          assignFor={assignFor} setAssignFor={setAssignFor} pinMode={pinMode} setPinMode={setPinMode}
          expanded={expanded} setExpanded={setExpanded}
          busy={busy} assign={assign} action={action} onMapClick={onMapClick}
        />
      ) : tab === 'drivers' ? (
        <DriversTab drivers={drivers} post={post} busy={busy} />
      ) : (
        <ReportsTab />
      )}
    </div>
  );
}

/* ─────────────────────────── DISPATCH ─────────────────────────── */

function DispatchTab(props: {
  deliveries: Delivery[]; queue: QueueOrder[]; drivers: Driver[];
  markers: any[]; assignFor: string | null; setAssignFor: (v: string | null) => void;
  pinMode: string | null; setPinMode: (v: string | null) => void;
  expanded: string | null; setExpanded: (v: string | null) => void;
  busy: boolean; assign: (o: string, d: string) => void; action: (d: string, a: string) => void;
  onMapClick: (lat: number, lng: number) => void;
}) {
  const { deliveries, queue, drivers, markers, assignFor, setAssignFor, pinMode, setPinMode, expanded, setExpanded, busy, assign, action, onMapClick } = props;
  const idleDrivers = drivers.filter(d => d.active);

  return (
    <div className="grid lg:grid-cols-5 gap-6 items-start">
      <div className="lg:col-span-3 space-y-4">
        <div className="glass-strong rounded-3xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-primary flex items-center gap-2">
              <Radio className="w-4 h-4 text-green-500" /> Live map
            </h2>
            {pinMode && <span className="badge !bg-amber-500/15 !border-amber-500/40 !text-amber-500 animate-pulse">Tap the map to set the drop pin…</span>}
          </div>
          <LiveMap markers={markers} height="440px" onMapClick={onMapClick} />
          <p className="text-[11px] text-muted mt-2 flex items-center gap-3">
            <span>🏍️ rider</span><span>📍 destination</span>
            <span className="opacity-60">faded = no signal &gt; 90s</span>
            {pinMode && <span className="text-amber-500">click map to fix destination</span>}
          </p>
        </div>

        {/* Active deliveries */}
        <div className="glass-strong rounded-3xl p-5 space-y-3">
          <h2 className="font-semibold text-primary">On the road <span className="text-muted text-sm font-normal">({deliveries.length})</span></h2>
          {deliveries.length === 0 ? (
            <p className="text-sm text-muted py-3">No active deliveries - assign one from the queue below.</p>
          ) : deliveries.map(d => (
            <div key={d.id} className="glass rounded-2xl p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-mono text-sm font-semibold text-primary">{d.order.orderNumber}</p>
                  <span className={`badge ${d.status === 'picked_up' ? '!bg-green-500/15 !border-green-500/40 !text-green-500' : '!bg-[var(--accent)]/10 !text-[var(--accent)]'}`}>
                    {d.status === 'picked_up' ? 'riding' : 'assigned'}
                  </span>
                  <span className="text-xs text-muted">{d.order.items.reduce((s, i) => s + i.quantity, 0)} pcs · {fmtKsh(d.order.total)}</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  {d.driver ? (
                    <span className="flex items-center gap-1.5 text-secondary">
                      <Bike className="w-3.5 h-3.5 text-[var(--accent)]" />
                      {d.driver.name}{d.driver.plate ? ` · ${d.driver.plate}` : ''}
                      <span className="text-muted">· {timeAgo(d.driver.lastSeenAt)}</span>
                    </span>
                  ) : <span className="text-amber-500">no driver</span>}
                </div>
              </div>
              <p className="text-xs text-secondary flex items-start gap-1.5"><MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-muted" /> {d.order.deliveryAddress}</p>
              <div className="flex flex-wrap gap-2">
                {d.status === 'assigned' && (
                  <button onClick={() => action(d.id, 'picked_up')} disabled={busy} className="btn-glass !py-1.5 !px-3 !text-xs">
                    <Send className="w-3.5 h-3.5" /> Confirm pickup
                  </button>
                )}
                {d.status === 'picked_up' && (
                  <button onClick={() => action(d.id, 'delivered')} disabled={busy} className="btn-glass !py-1.5 !px-3 !text-xs !text-green-600 !border-green-500/40 hover:bg-green-500/10">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Mark delivered
                  </button>
                )}
                <button onClick={() => setPinMode(pinMode === d.id ? null : d.id)} disabled={busy}
                  className={`btn-glass !py-1.5 !px-3 !text-xs ${pinMode === d.id ? '!text-amber-500 !border-amber-500/50 bg-amber-500/10' : ''}`}>
                  <MapPin className="w-3.5 h-3.5" /> {d.destLat != null ? 'Move pin' : 'Set pin'}
                </button>
                {d.status === 'assigned' && (
                  <button onClick={() => action(d.id, 'unassign')} disabled={busy} className="btn-glass !py-1.5 !px-3 !text-xs text-red-500 !border-red-500/40 hover:bg-red-500/10">
                    Unassign
                  </button>
                )}
                <a href={`https://wa.me/254${d.order.customerPhone.replace(/\D/g, '').replace(/^254/, '').replace(/^0/, '')}`}
                  target="_blank" rel="noopener noreferrer" className="btn-glass !py-1.5 !px-3 !text-xs">
                  <Phone className="w-3.5 h-3.5" /> Customer
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Queue */}
      <div className="lg:col-span-2 space-y-4">
        <div className="glass-strong rounded-3xl p-5 space-y-3">
          <h2 className="font-semibold text-primary flex items-center gap-2">
            <Package className="w-4 h-4 text-[var(--accent)]" /> Unassigned orders <span className="text-muted text-sm font-normal">({queue.length})</span>
          </h2>
          {queue.length === 0 && <p className="text-sm text-muted">Nothing waiting - every paid online order has a rider.</p>}
          {queue.map(o => (
            <div key={o.id} className="glass rounded-2xl p-4 space-y-2">
              <button onClick={() => setExpanded(expanded === o.id ? null : o.id)} className="w-full text-left">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {expanded === o.id ? <ChevronDown className="w-3.5 h-3.5 text-muted shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-muted shrink-0" />}
                    <p className="font-mono text-xs font-semibold text-primary truncate">{o.orderNumber}</p>
                  </div>
                  <span className="text-xs font-semibold text-primary shrink-0">{fmtKsh(o.total)}</span>
                </div>
                <p className="text-xs text-secondary mt-1 line-clamp-1">{o.customerName} · {o.deliveryAddress}</p>
              </button>
              {expanded === o.id && (
                <div className="space-y-2 pt-2 border-t border-[var(--border-color)] text-xs text-secondary">
                  {o.items.map((it, i) => <p key={i}>{it.productName} · {it.variantLabel} × {it.quantity}</p>)}
                  {o.notes && <p className="text-muted italic">“{o.notes}”</p>}
                </div>
              )}
              <div className="relative">
                <button onClick={() => setAssignFor(assignFor === o.id ? null : o.id)} disabled={busy}
                  className="w-full btn-primary !py-2 !text-xs">
                  <Bike className="w-3.5 h-3.5" /> Assign rider
                </button>
                {assignFor === o.id && (
                  <div className="absolute z-30 left-0 right-0 mt-1 glass-strong rounded-xl p-2 shadow-2xl max-h-56 overflow-y-auto">
                    {idleDrivers.length === 0 && <p className="text-xs text-muted p-2">No active drivers - add one in the Drivers tab.</p>}
                    {idleDrivers.map(d => (
                      <button key={d.id} onClick={() => assign(o.id, d.id)}
                        className="w-full text-left px-3 py-2 rounded-lg hover:bg-[var(--surface)] text-xs text-primary flex items-center justify-between gap-2">
                        <span>{VEHICLE_EMOJI[d.vehicle] || '🏍️'} {d.name}{d.plate ? ` · ${d.plate}` : ''}</span>
                        <span className="text-muted">{d.lastSeenAt ? timeAgo(d.lastSeenAt) : 'no signal'}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="glass rounded-3xl p-5">
          <h3 className="text-sm font-semibold text-primary mb-2 flex items-center gap-2"><Users className="w-4 h-4 text-muted" /> Fleet status</h3>
          <div className="space-y-1.5 text-xs">
            {drivers.map(d => {
              const job = deliveries.find(x => x.driver?.id === d.id);
              return (
                <div key={d.id} className="flex items-center justify-between gap-2">
                  <span className={d.active ? 'text-secondary' : 'text-muted line-through'}>{VEHICLE_EMOJI[d.vehicle]} {d.name}</span>
                  <span className={`badge !text-[10px] ${job ? '!bg-green-500/15 !border-green-500/40 !text-green-500' : d.active ? '' : '!bg-red-500/15 !border-red-500/40 !text-red-500'}`}>
                    {job ? job.order.orderNumber : d.active ? 'idle' : 'off'}
                  </span>
                </div>
              );
            })}
            {drivers.length === 0 && <p className="text-muted">No drivers yet.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── DRIVERS ─────────────────────────── */

function DriversTab({ drivers, post, busy }: { drivers: Driver[]; post: (p: string, b: any, m?: string) => Promise<boolean>; busy: boolean }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '', plate: '', vehicle: 'motorcycle' });

  async function create() {
    if (!form.name.trim() || !form.phone.trim()) return toast.error('Name and phone are required');
    const ok = await post('/api/admin/drivers', form);
    if (ok) { toast.success(`Driver ${form.name} added`); setForm({ name: '', phone: '', email: '', plate: '', vehicle: 'motorcycle' }); setOpen(false); }
  }

  return (
    <div className="space-y-4">
      <div className="glass-strong rounded-3xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="font-semibold text-primary">Driver roster</h2>
            <p className="text-xs text-muted mt-0.5">With an email they can sign in at /driver using their own Clerk account.</p>
          </div>
          <button onClick={() => setOpen(!open)} className="btn-primary !py-2 !px-4 !text-sm">
            <Plus className="w-4 h-4" /> Add driver
          </button>
        </div>

        {open && (
          <div className="glass rounded-2xl p-4 mb-4 grid sm:grid-cols-2 gap-3">
            <input className="input-glass" placeholder="Full name *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            <input className="input-glass" placeholder="Phone (07XX…) *" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            <input className="input-glass" placeholder="Sign-in email (optional)" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            <input className="input-glass" placeholder="Plate number" value={form.plate} onChange={e => setForm(f => ({ ...f, plate: e.target.value }))} />
            <select className="input-glass" value={form.vehicle} onChange={e => setForm(f => ({ ...f, vehicle: e.target.value }))}>
              {VEHICLES.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
            <button onClick={create} disabled={busy} className="btn-primary !text-sm">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Create driver
            </button>
          </div>
        )}

        <div className="space-y-2">
          {drivers.map(d => (
            <div key={d.id} className="glass rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-primary">{VEHICLE_EMOJI[d.vehicle]} {d.name} {d.plate && <span className="font-mono text-xs text-muted ml-1">{d.plate}</span>}</p>
                <p className="text-xs text-muted">
                  {d.phone} · {d.vehicle}
                  {d.staff?.email && <> · <span className={d.staff.active ? '' : 'text-red-500'}>{d.staff.email}{d.staff.active ? '' : ' (blocked)'}</span></>}
                  {!d.staff?.email && <> · <span className="text-amber-500">no sign-in yet</span></>}
                </p>
                <p className="text-[11px] text-muted mt-0.5">
                  {d._count?.deliveries ?? 0} deliveries · last signal {timeAgo(d.lastSeenAt)}
                  {d.lastLat != null && ` · ${d.lastLat.toFixed(4)}, ${d.lastLng?.toFixed(4)}`}
                </p>
              </div>
              <button onClick={() => post('/api/admin/drivers', { id: d.id, active: !d.active }, 'PATCH')}
                disabled={busy}
                className={`badge !py-1.5 !px-3 !text-xs ${d.active ? '!bg-green-500/15 !border-green-500/40 !text-green-500' : '!bg-red-500/15 !border-red-500/40 !text-red-500'}`}>
                {d.active ? 'Active' : 'Deactivated'}
              </button>
            </div>
          ))}
          {drivers.length === 0 && (
            <div className="border-2 border-dashed border-[var(--border-color)] rounded-2xl p-10 text-center text-muted text-sm">
              No drivers yet - add your first rider above.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── REPORTS ─────────────────────────── */

function ReportsTab() {
  const [range, setRange] = useState(30);
  const [data, setData] = useState<Reports | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetch(`/api/admin/deliveries/reports?days=${range}`)
      .then(r => r.json())
      .then(d => { if (alive) { setData(d.error ? null : d); if (d.error) toast.error(d.error); } })
      .catch(() => alive && toast.error('Could not load reports'))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [range]);

  const maxCount = data ? Math.max(1, ...data.series.map(s => s.count)) : 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {[7, 30, 90].map(d => (
          <button key={d} onClick={() => setRange(d)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${range === d ? 'bg-gradient-to-br from-[var(--accent-light)] to-[var(--accent)] text-white' : 'text-secondary hover:text-primary hover:bg-[var(--surface)]'}`}>
            Last {d} days
          </button>
        ))}
      </div>

      {loading || !data ? (
        <div className="glass rounded-3xl p-16 text-center"><Loader2 className="w-6 h-6 animate-spin text-[var(--accent)] mx-auto" /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {[
              { label: 'Delivered', value: data.totals.delivered, color: 'text-green-500' },
              { label: 'Avg ride', value: `${data.totals.avgRideMin}m`, color: 'text-primary' },
              { label: 'Avg wait', value: `${data.totals.avgWaitMin}m`, color: 'text-primary' },
              { label: 'On time (≤45m)', value: data.totals.onTimePct == null ? '—' : `${data.totals.onTimePct}%`, color: 'text-[var(--accent)]' },
              { label: 'Cancelled', value: data.totals.cancelled, color: 'text-red-500' }
            ].map(s => (
              <div key={s.label} className="glass-strong rounded-2xl p-5">
                <p className="text-[11px] uppercase tracking-wider text-muted">{s.label}</p>
                <p className={`font-display text-xl font-bold mt-1 ${s.color}`}>{s.value}</p>
              </div>
            ))}
          </div>

          <div className="glass-strong rounded-3xl p-5">
            <h2 className="font-semibold text-primary mb-3">Deliveries per day</h2>
            <div className="flex items-end gap-[3px]" style={{ height: 120 }}>
              {data.series.map(s => (
                <div key={s.date} className="flex-1 group relative">
                  <div style={{ height: Math.max(3, (s.count / maxCount) * 110) }}
                    className="w-full rounded-t bg-gradient-to-t from-[var(--accent)] to-[var(--accent-light)] min-h-[3px]" />
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block glass rounded-lg px-2 py-1 text-[10px] text-primary whitespace-nowrap z-10">
                    {s.date.slice(5)}: {s.count}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-between text-[10px] text-muted mt-1">
              <span>{data.series[0]?.date.slice(5)}</span>
              <span>{data.series[data.series.length - 1]?.date.slice(5)}</span>
            </div>
          </div>

          <div className="glass-strong rounded-3xl p-5">
            <h2 className="font-semibold text-primary mb-3">Driver league table</h2>
            {data.driverStats.length === 0 ? (
              <p className="text-sm text-muted py-3">No deliveries with drivers in this period.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wider text-muted border-b border-[var(--border-color)]">
                      <th className="py-2 pr-3">Driver</th>
                      <th className="py-2 pr-3">Vehicle</th>
                      <th className="py-2 pr-3 text-right">Delivered</th>
                      <th className="py-2 pr-3 text-right">Avg ride</th>
                      <th className="py-2 pr-3 text-right">Distance</th>
                      <th className="py-2 text-right">Cancelled</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.driverStats.map(s => (
                      <tr key={s.driverId} className="border-b border-[var(--border-color)]/60">
                        <td className="py-2.5 pr-3 font-medium text-primary">{VEHICLE_EMOJI[s.vehicle]} {s.name} {s.plate && <span className="font-mono text-xs text-muted ml-1">{s.plate}</span>}</td>
                        <td className="py-2.5 pr-3 text-secondary">{s.vehicle}</td>
                        <td className="py-2.5 pr-3 text-right text-green-500 font-semibold">{s.delivered}</td>
                        <td className="py-2.5 pr-3 text-right text-secondary">{s.avgRideMin}m</td>
                        <td className="py-2.5 pr-3 text-right text-secondary">{s.totalKm != null ? `${s.totalKm} km` : '—'}</td>
                        <td className="py-2.5 text-right text-red-500">{s.cancelled}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {data.totals.active > 0 && (
            <div className="callout"><AlertTriangle className="w-4 h-4 inline -mt-0.5 mr-1 text-amber-500" />
              <b>{data.totals.active}</b> deliveries are still assigned or riding right now.
            </div>
          )}
        </>
      )}
    </div>
  );
}
