'use client';
// Live tracking block inside /track: polls the public live endpoint every
// 5s while the order is on the road, draws the rider + destination on a
// Leaflet map, and shows an ETA chip. Before pickup it shows the assigned
// stage without a position (nothing has moved yet); after delivery the
// block retires and the normal stage timeline takes over.
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Bike, MapPin, Navigation, Radio, Clock } from 'lucide-react';

const LiveMap = dynamic(() => import('@/components/delivery/LiveMap'), {
  ssr: false,
  loading: () => <div className="glass" style={{ height: 300, borderRadius: 14 }} />
});

interface LiveState {
  status: string;
  destination: { lat: number; lng: number } | null;
  delivery: {
    stage: string;
    pickedUpAt: string | null;
    deliveredAt: string | null;
    driverName: string | null;
    driverVehicle: string | null;
    position: { lat: number; lng: number; seenAt: string | null } | null;
    etaMin: number | null;
    mapCenter: { lat: number; lng: number };
  } | null;
}

export default function LiveDelivery({ orderNumber }: { orderNumber: string }) {
  const [live, setLive] = useState<LiveState | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    async function poll() {
      try {
        const res = await fetch(`/api/orders/live?order=${encodeURIComponent(orderNumber)}`);
        if (!res.ok) return;
        const data: LiveState = await res.json();
        if (alive) { setLive(data); setFailed(false); }
      } catch { if (alive) setFailed(true); }
    }
    poll();
    const t = setInterval(() => { if (!document.hidden) poll(); }, 5000);
    return () => { alive = false; clearInterval(t); };
  }, [orderNumber]);

  // No delivery created, finished, or endpoint trouble -> render nothing;
  // the existing stage timeline already covers those cases.
  if (!live?.delivery || live.delivery.stage === 'delivered' || live.delivery.stage === 'cancelled') return null;
  if (failed && !live) return null;

  const d = live.delivery;
  const riding = d.stage === 'picked_up';
  const pos = d.position;
  const dest = live.destination;
  const markers = [
    ...(pos ? [{ id: 'rider', lat: pos.lat, lng: pos.lng, kind: 'driver' as const, label: d.driverName ? `${d.driverName}` : 'Your rider', sub: d.driverVehicle || undefined, stale: pos.seenAt ? Date.now() - new Date(pos.seenAt).getTime() > 90_000 : false }] : []),
    ...(dest ? [{ id: 'dest', lat: dest.lat, lng: dest.lng, kind: 'destination' as const, label: 'Delivery address' }] : [])
  ];

  return (
    <div className="glass-strong rounded-3xl p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-primary flex items-center gap-2">
          <Bike className="w-4 h-4 text-[var(--accent)]" />
          {riding ? `${d.driverName ?? 'Your rider'} is on the way` : 'Rider assigned - collecting your order'}
        </h2>
        {riding && (
          <span className={`badge ${pos ? '!bg-green-500/15 !border-green-500/40 !text-green-500' : '!bg-amber-500/15 !border-amber-500/40 !text-amber-500'}`}>
            <Radio className="w-3 h-3" /> {pos ? 'Live' : 'Connecting'}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        {d.etaMin != null && (
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-br from-[var(--accent-light)] to-[var(--accent)] text-white font-semibold">
            <Navigation className="w-3.5 h-3.5" /> ~{d.etaMin} min away
          </span>
        )}
        {d.pickedUpAt && (
          <span className="text-muted text-xs flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" /> picked up {new Date(d.pickedUpAt).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
        {d.driverVehicle && <span className="text-muted text-xs capitalize flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> by {d.driverVehicle}</span>}
      </div>

      <LiveMap
        markers={markers}
        center={d.mapCenter}
        height="300px"
        fitMarkers={riding ? 'always' : true}
      />

      {!riding && (
        <p className="text-xs text-muted text-center">
          The map turns on the moment {d.driverName ?? 'your rider'} picks up your order.
        </p>
      )}
      {riding && !pos && (
        <p className="text-xs text-muted text-center">Waiting for the first live position…</p>
      )}
      {riding && pos && (
        <p className="text-[11px] text-muted text-center">Last position {pos.seenAt ? `${Math.max(1, Math.round((Date.now() - new Date(pos.seenAt).getTime()) / 1000))}s ago` : 'just now'} · estimates update every few seconds</p>
      )}
    </div>
  );
}
