'use client';
// Driver phone app: my current jobs, one-tap pickup/deliver, and a GPS
// watcher that posts a ping every ~5s while a job is active (and every
// 15s when idle so dispatch still sees the fleet). Watchers stop the
// moment the tab hides - battery matters more than a 5s-perfect trail.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Bike, MapPin, Package, Navigation, CheckCircle2, Phone, Radio, Clock, AlertTriangle, LogOut } from 'lucide-react';
import { SignOutButton } from '@clerk/nextjs';
import toast from 'react-hot-toast';
import { fmtKsh } from '@/lib/utils';

interface Job {
  id: string; status: string; assignedAt: string; pickedUpAt: string | null;
  order: {
    id: string; orderNumber: string; customerName: string; customerPhone: string;
    deliveryAddress: string; notes: string | null; total: number;
    items: { productName: string; variantLabel: string; quantity: number }[];
  };
}
interface HistoryRow { id: string; deliveredAt: string | null; order: { orderNumber: string; deliveryAddress: string; total: number }; }
interface DriverInfo { name: string; phone: string; plate: string | null; vehicle: string; lastLat: number | null; lastLng: number | null; }

const VEHICLE_EMOJI: Record<string, string> = { motorcycle: '🏍️', bicycle: '🚲', van: '🚐' };

export default function DriverApp({ role }: { role: string }) {
  const [driver, setDriver] = useState<DriverInfo | null | undefined>(undefined); // undefined = loading, null = no profile
  const [jobs, setJobs] = useState<Job[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [gpsOn, setGpsOn] = useState(false);
  const [gpsError, setGpsError] = useState('');
  const [now, setNow] = useState(Date.now());
  const watchIdRef = useRef<number | null>(null);
  const lastPostRef = useRef(0);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/driver');
      const data = await res.json();
      if (!res.ok) { if (data.error) toast.error(data.error); return; }
      setDriver(data.driver);
      setJobs(data.jobs || []);
      setHistory(data.history || []);
    } catch { toast.error('Connection issue'); }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);   // job state refresh
    const c = setInterval(() => setNow(Date.now()), 1000); // countdown ticks
    return () => { clearInterval(t); clearInterval(c); };
  }, [load]);

  // ── GPS watcher ──────────────────────────────────────────────
  const postPing = useCallback(async (lat: number, lng: number, speedKph?: number) => {
    const t = Date.now();
    if (t - lastPostRef.current < 4500) return; // client throttle ~5s
    lastPostRef.current = t;
    try {
      await fetch('/api/driver/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng, speedKph })
      });
    } catch { /* offline: next ping catches up */ }
  }, []);

  const startGps = useCallback(() => {
    if (!('geolocation' in navigator)) { setGpsError('This device has no geolocation'); return; }
    if (watchIdRef.current != null) return;
    setGpsError('');
    const id = navigator.geolocation.watchPosition(
      pos => { setGpsOn(true); postPing(pos.coords.latitude, pos.coords.longitude, pos.coords.speed != null ? pos.coords.speed * 3.6 : undefined); },
      err => { setGpsOn(false); setGpsError(err.code === 1 ? 'Location permission denied - enable it to share your position' : 'Waiting for location…'); },
      { enableHighAccuracy: true, maximumAge: 4000, timeout: 20000 }
    );
    watchIdRef.current = id;
  }, [postPing]);

  const stopGps = useCallback(() => {
    if (watchIdRef.current != null) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; }
    setGpsOn(false);
  }, []);

  // GPS runs while the tab is visible AND (a job exists OR driver signed in).
  const hasJob = jobs.length > 0;
  useEffect(() => {
    if (driver == null) return;
    if (document.visibilityState === 'visible') { if (hasJob || driver) startGps(); }
    else stopGps();
    const onVis = () => { document.visibilityState === 'visible' ? (hasJob || driver) && startGps() : stopGps(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { document.removeEventListener('visibilitychange', onVis); stopGps(); };
  }, [driver, hasJob, startGps, stopGps]);

  // ── job actions ─────────────────────────────────────────────
  async function act(deliveryId: string, action: 'picked_up' | 'delivered') {
    setBusy(true);
    try {
      const res = await fetch('/api/driver', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deliveryId, action })
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Failed'); return; }
      toast.success(action === 'picked_up' ? 'Picked up - ride safe!' : 'Delivered - nice one!');
      load();
    } catch { toast.error('Connection issue'); }
    finally { setBusy(false); }
  }

  // ── loading / no-profile states ─────────────────────────────
  if (driver === undefined) {
    return <div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="w-7 h-7 animate-spin text-[var(--accent)]" /></div>;
  }
  if (driver === null) {
    return (
      <div className="px-4 py-16 max-w-md mx-auto">
        <div className="glass-strong rounded-3xl p-8 text-center space-y-4">
          <Bike className="w-10 h-10 mx-auto text-[var(--accent)]" />
          <h1 className="font-display text-xl font-bold text-primary">No driver profile</h1>
          <p className="text-sm text-secondary">
            {role === 'admin'
              ? 'Your account has no vehicle registered. Add yourself in Admin → Deliveries → Drivers (use your own email) to test this app.'
              : 'Ask dispatch to add you as a driver with your sign-in email, then reload.'}
          </p>
          <SignOutButton><button className="btn-glass text-sm"><LogOut className="w-4 h-4" /> Sign out</button></SignOutButton>
        </div>
      </div>
    );
  }

  const active = jobs[0];
  const stage = active?.status;
  const waitedSec = active ? Math.floor((now - new Date(active.status === 'picked_up' ? active.pickedUpAt! : active.assignedAt).getTime()) / 1000) : 0;
  const mmSs = `${Math.floor(waitedSec / 60)}:${String(waitedSec % 60).padStart(2, '0')}`;
  const waLink = `https://wa.me/254${active ? active.order.customerPhone.replace(/\D/g, '').replace(/^254/, '').replace(/^0/, '') : ''}`;

  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-4">
      {/* Header: identity + GPS state */}
      <div className="glass-strong rounded-3xl p-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[var(--accent-light)] to-[var(--accent)] flex items-center justify-center text-xl shrink-0">
            {VEHICLE_EMOJI[driver.vehicle] || '🏍️'}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-primary truncate">{driver.name}</p>
            <p className="text-[11px] text-muted">{driver.vehicle}{driver.plate ? ` · ${driver.plate}` : ''} · {jobs.length} active job{jobs.length === 1 ? '' : 's'}</p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <span className={`badge !text-[10px] ${gpsOn ? '!bg-green-500/15 !border-green-500/40 !text-green-500' : '!bg-amber-500/15 !border-amber-500/40 !text-amber-500'}`}>
            <Radio className="w-3 h-3" /> {gpsOn ? 'LIVE' : 'GPS'}
          </span>
          <p className="text-[10px] text-muted mt-1">{gpsOn ? 'sharing position' : gpsError ? 'not sharing' : 'starting…'}</p>
        </div>
      </div>
      {gpsError && (
        <div className="callout warn flex items-start gap-2"><AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /><span>{gpsError}</span></div>
      )}

      {/* Current job */}
      {!active ? (
        <div className="glass-strong rounded-3xl p-10 text-center space-y-3">
          <Package className="w-9 h-9 mx-auto text-muted opacity-50" />
          <p className="font-semibold text-primary">No active job</p>
          <p className="text-sm text-muted">New assignments appear here automatically - keep this page open.</p>
        </div>
      ) : (
        <div className="glass-strong rounded-3xl p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <p className="font-mono font-bold text-primary">{active.order.orderNumber}</p>
            <span className={`badge ${stage === 'picked_up' ? '!bg-green-500/15 !border-green-500/40 !text-green-500' : '!bg-[var(--accent)]/10 !text-[var(--accent)]'}`}>
              {stage === 'picked_up' ? 'riding' : 'collect from farm'}
            </span>
          </div>

          <div className="space-y-2 text-sm">
            <p className="text-secondary flex items-start gap-2"><MapPin className="w-4 h-4 mt-0.5 shrink-0 text-[var(--accent)]" /> {active.order.deliveryAddress}</p>
            <p className="text-secondary flex items-center gap-2"><Phone className="w-4 h-4 shrink-0 text-muted" /> {active.order.customerName} · {active.order.customerPhone}</p>
            {active.order.notes && <p className="text-muted text-xs italic flex gap-2"><AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> “{active.order.notes}”</p>}
          </div>

          <div className="glass-soft rounded-2xl p-3 space-y-1">
            {active.order.items.map((it, i) => (
              <p key={i} className="text-xs text-secondary flex justify-between gap-2">
                <span>{it.productName} · {it.variantLabel}</span><span className="text-primary font-medium">× {it.quantity}</span>
              </p>
            ))}
            <p className="text-xs text-muted pt-1 border-t border-[var(--border-color)] flex justify-between">
              <span>Order value</span><span>{fmtKsh(active.order.total)}</span>
            </p>
          </div>

          <div className="flex items-center justify-between text-xs text-muted">
            <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {stage === 'picked_up' ? 'riding for' : 'waiting'} <span className="font-mono text-primary font-semibold">{mmSs}</span></span>
            <span>{new Date(active.assignedAt).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })} assigned</span>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-2">
            <a href={waLink} target="_blank" rel="noopener noreferrer" className="btn-glass !py-3 !text-sm justify-center">
              <Phone className="w-4 h-4" /> Call / WhatsApp
            </a>
            {stage === 'assigned' ? (
              <button onClick={() => act(active.id, 'picked_up')} disabled={busy} className="btn-primary !py-3 !text-sm justify-center">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />} Picked up
              </button>
            ) : (
              <button onClick={() => act(active.id, 'delivered')} disabled={busy}
                className="!py-3 !text-sm justify-center rounded-xl font-semibold text-white bg-gradient-to-br from-green-500 to-emerald-600 flex items-center gap-2 disabled:opacity-40">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Delivered
              </button>
            )}
          </div>
          <p className="text-[11px] text-muted text-center">
            {stage === 'assigned' ? 'Tap Picked up once the fish is on the bike.' : 'Tap Delivered only after handing over to the customer.'}
          </p>
        </div>
      )}

      {/* Today's completed rides */}
      <div className="glass-strong rounded-3xl p-5 space-y-3">
        <h2 className="text-sm font-semibold text-primary">Done today <span className="text-muted font-normal">({history.length})</span></h2>
        {history.length === 0 ? (
          <p className="text-xs text-muted">Nothing completed yet today.</p>
        ) : history.map(h => (
          <div key={h.id} className="flex items-center justify-between gap-3 glass-soft rounded-xl px-3 py-2.5">
            <div className="min-w-0">
              <p className="font-mono text-xs font-semibold text-primary">{h.order.orderNumber}</p>
              <p className="text-[11px] text-muted truncate">{h.order.deliveryAddress}</p>
            </div>
            <span className="text-[11px] text-green-500 font-semibold shrink-0 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {h.deliveredAt ? new Date(h.deliveredAt).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' }) : ''}
            </span>
          </div>
        ))}
      </div>

      <div className="text-center pt-1">
        <SignOutButton><button className="text-xs text-muted hover:text-primary inline-flex items-center gap-1.5"><LogOut className="w-3.5 h-3.5" /> Sign out</button></SignOutButton>
      </div>
    </div>
  );
}
