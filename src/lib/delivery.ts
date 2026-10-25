// Shared helpers for live delivery tracking.
//
// Geocoding uses OpenStreetMap Nominatim (free, no key). Its usage
// policy requires a descriptive User-Agent and max 1 request/second -
// we geocode once per assignment, so that is comfortably inside limits.
//
// ETA is deliberately simple: straight-line distance x a road-factor
// (Kisumu town streets are not a grid) divided by an average boda
// speed. It is an estimate and is labelled as such in the UI - no
// paid routing API is involved.

/** Kisumu CBD - map fallback when no position/destination exists yet. */
export const KISUMU_CENTER = { lat: -0.0917, lng: 34.7680 };

const ROAD_FACTOR = 1.35; // straight-line -> road distance
const AVG_SPEED_KPH = 28; // motorcycle delivery average in town traffic

/** Great-circle distance in km. */
export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Estimated minutes from `from` to `to`; null when either end is unknown. */
export function etaMinutes(from: { lat: number; lng: number } | null, to: { lat: number; lng: number } | null): number | null {
  if (!from || !to) return null;
  const km = haversineKm(from, to) * ROAD_FACTOR;
  const min = Math.round((km / AVG_SPEED_KPH) * 60);
  return Math.max(1, min);
}

export interface GeocodeResult {
  lat: number;
  lng: number;
  displayName: string;
  confidence: number;
}

/**
 * Geocode a free-text Kenyan delivery address. Returns null when nothing
 * is found (dispatch can then drop the pin manually on the map).
 */
export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const q = `${address.trim()}, Kisumu, Kenya`;
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=ke&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'EthasfishFarms-Delivery/1.0 (ops manual contact: ops@ethasfish.co.ke)' },
      signal: AbortSignal.timeout(8000)
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as Array<{ lat: string; lon: string; display_name: string; importance: number }>;
    const hit = rows[0];
    if (!hit) return null;
    return {
      lat: parseFloat(hit.lat),
      lng: parseFloat(hit.lon),
      displayName: hit.display_name,
      confidence: Number(hit.importance) || 0
    };
  } catch {
    return null; // offline/timeout: dispatch drops the pin manually
  }
}

/** Trim the fleet GPS history - call on ping, rows older than 30 days go. */
export function positionCutoff(): Date {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d;
}
