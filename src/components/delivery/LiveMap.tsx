'use client';
// Shared Leaflet live map for dispatch (admin) and driver views.
// Markers are L.divIcon (emoji + styled chips) instead of PNG sprites so
// the default-Leaflet-icon bundler path problem never applies, and the
// whole module is loaded client-only by the pages that use it.
import { useEffect, useRef } from 'react';
import type { Map as LeafletMap, Marker, Polyline } from 'leaflet';
import { KISUMU_CENTER } from '@/lib/delivery';

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  kind: 'driver' | 'destination' | 'me';
  label: string;      // main line (driver name / order number)
  sub?: string;       // second line (vehicle / status)
  plate?: string | null;
  stale?: boolean;    // position older than 90s -> dimmed
}

export interface MapTrail {
  id: string;
  points: Array<{ lat: number; lng: number }>;
}

interface Props {
  markers: MapMarker[];
  trails?: MapTrail[];
  center?: { lat: number; lng: number };
  /** true = fit on first data only; 'always' = refit every sync */
  fitMarkers?: boolean | 'always';
  height?: string;
  onMapClick?: (lat: number, lng: number) => void;
  className?: string;
}

const ICONS: Record<MapMarker['kind'], { bg: string; emoji: string; ring: string }> = {
  driver: { bg: '#1C6EA8', emoji: '🏍️', ring: 'rgba(28,110,168,.35)' },
  destination: { bg: '#D97706', emoji: '📍', ring: 'rgba(217,119,6,.3)' },
  me: { bg: '#16A34A', emoji: '🔵', ring: 'rgba(22,163,74,.35)' }
};

type LeafletNS = typeof import('leaflet');

// Leaflet ships CJS: dynamic import returns the namespace under `.default`
// in the bundler (with the named exports alongside as fallback).
async function loadLeaflet(): Promise<LeafletNS> {
  const mod = (await import('leaflet')) as LeafletNS & { default?: LeafletNS };
  return mod.default ?? mod;
}

function makeIcon(L: LeafletNS, m: MapMarker) {
  const meta = ICONS[m.kind];
  return L.divIcon({
    className: '',
    iconSize: [36, 44],
    iconAnchor: [18, 40],
    html: `
      <div style="position:relative;display:flex;flex-direction:column;align-items:center;opacity:${m.stale ? 0.45 : 1}">
        <div style="position:absolute;top:-8px;width:36px;height:36px;border-radius:50%;background:${meta.ring};animation:none"></div>
        <div style="position:relative;width:34px;height:34px;border-radius:50% 50% 50% 4px;transform:rotate(-45deg);background:${meta.bg};border:2.5px solid #fff;box-shadow:0 3px 8px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center">
          <span style="transform:rotate(45deg);font-size:15px;line-height:1">${meta.emoji}</span>
        </div>
        <div style="margin-top:3px;background:rgba(14,27,38,.88);color:#fff;font:600 10px/1.25 system-ui,sans-serif;padding:2px 6px;border-radius:6px;white-space:nowrap;text-align:center;max-width:150px">
          ${m.label}${m.sub ? `<div style="font-weight:400;opacity:.75;font-size:9px">${m.sub}</div>` : ''}
        </div>
      </div>`
  });
}

export default function LiveMap({ markers, trails = [], center, fitMarkers = true, height = '420px', onMapClick, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<Map<string, Marker>>(new Map());
  const trailsRef = useRef<Map<string, Polyline>>(new Map());
  const firstFitRef = useRef(false);

  // Init once. Leaflet is imported lazily because it touches `window`.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;
    (async () => {
      const L = await loadLeaflet();
      await import('leaflet/dist/leaflet.css');
      if (cancelled || !containerRef.current) return;
      const map = L.map(containerRef.current, {
        zoomControl: true,
        attributionControl: true
      }).setView([center?.lat ?? KISUMU_CENTER.lat, center?.lng ?? KISUMU_CENTER.lng], 13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      }).addTo(map);
      if (onMapClick) map.on('click', (e: any) => onMapClick(e.latlng.lat, e.latlng.lng));
      mapRef.current = map;
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markersRef.current.clear();
      trailsRef.current.clear();
      firstFitRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync markers/trails whenever data changes (every 5s poll).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    let alive = true;
    (async () => {
      const L = await loadLeaflet();
      if (!alive || mapRef.current !== map) return;

      const seen = new Set<string>();
      for (const m of markers) {
        seen.add(m.id);
        const existing = markersRef.current.get(m.id);
        const pos: [number, number] = [m.lat, m.lng];
        if (existing) {
          existing.setLatLng(pos);
          existing.setIcon(makeIcon(L, m));
        }        else {
          const mk = L.marker(pos, { icon: makeIcon(L, m) }).addTo(map);
          mk.bindTooltip(`${m.label}${m.plate ? ` · ${m.plate}` : ''}`, { direction: 'top', offset: [0, -34] });
          markersRef.current.set(m.id, mk);
        }
      }
      for (const [id, mk] of markersRef.current) {
        if (!seen.has(id)) { map.removeLayer(mk); markersRef.current.delete(id); }
      }

      const seenTrails = new Set<string>();
      for (const t of trails) {
        if (t.points.length < 2) continue;
        seenTrails.add(t.id);
        const latlngs = t.points.map(p => [p.lat, p.lng]) as [number, number][];
        const line = trailsRef.current.get(t.id);
        if (line) line.setLatLngs(latlngs);
        else {
          const pl = L.polyline(latlngs, { color: '#1C6EA8', weight: 3, opacity: 0.55, dashArray: '6 8' }).addTo(map);
          trailsRef.current.set(t.id, pl);
        }
      }
      for (const [id, pl] of trailsRef.current) {
        if (!seenTrails.has(id)) { map.removeLayer(pl); trailsRef.current.delete(id); }
      }

      // Fit once on first data, then only when explicitly asked (avoids the
      // map yanking around every poll while the dispatcher reads it).
      if (fitMarkers && (!firstFitRef.current || fitMarkers === 'always') && markersRef.current.size > 0) {
        const bounds = L.latLngBounds(markers.map(m => [m.lat, m.lng] as [number, number]));
        map.fitBounds(bounds.pad(0.25), { maxZoom: 15 });
        firstFitRef.current = true;
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markers, trails, fitMarkers]);

  return <div ref={containerRef} className={className} style={{ height, width: '100%', borderRadius: 14, zIndex: 0 }} />;
}
