'use client';
// Admin > Cameras: a live wall of the farm's CCTV feeds.
//
// Each tile plays whatever the configured URL offers:
//   hls   - .m3u8 playlist via hls.js (Safari falls back to native HLS)
//   embed - iframe for relay/NVR web viewers (go2rtc's /embed.html, etc.)
//   image - snapshot JPEG refreshed every few seconds
// Raw rtsp:// URLs are rejected by the API; the farm's always-on NVR/PC
// relays each camera to HTTPS first (see README > Farm cameras).
import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Camera as CameraIcon, Loader2, Pencil, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';

interface Camera {
  id: string;
  name: string;
  zone: string | null;
  kind: string; // hls | embed | image
  streamUrl: string;
  sortOrder: number;
  active: boolean;
}

type PlayerState = 'loading' | 'live' | 'error';

/* ------------------------------- players ------------------------------- */

function HlsPlayer({ url }: { url: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<PlayerState>('loading');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let hls: import('hls.js').default | null = null;
    setState('loading');

    (async () => {
      const video = videoRef.current;
      if (!video) return;
      try {
        const { default: Hls } = await import('hls.js');
        if (cancelled) return;
        if (Hls.isSupported()) {
          hls = new Hls({ manifestLoadingMaxRetry: 2, levelLoadingMaxRetry: 2 });
          hls.loadSource(url);
          hls.attachMedia(video);
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            if (cancelled) return;
            video.play().catch(() => {});
            setState('live');
          });
          hls.on(Hls.Events.ERROR, (_evt, data) => {
            if (data.fatal && !cancelled) {
              hls?.destroy();
              setState('error');
            }
          });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = url;
          video.addEventListener('loadedmetadata', () => {
            if (cancelled) return;
            video.play().catch(() => {});
            setState('live');
          }, { once: true });
          video.addEventListener('error', () => !cancelled && setState('error'), { once: true });
        } else {
          setState('error');
        }
      } catch {
        if (!cancelled) setState('error');
      }
    })();

    return () => { cancelled = true; hls?.destroy(); };
  }, [url, attempt]);

  if (state === 'error') return <PlayerError onRetry={() => setAttempt(a => a + 1)} />;
  return (
    <>
      <video ref={videoRef} muted playsInline autoPlay className="absolute inset-0 w-full h-full object-cover bg-black" />
      {state === 'loading' && <PlayerLoading />}
    </>
  );
}

function EmbedPlayer({ url }: { url: string }) {
  const [state, setState] = useState<PlayerState>('loading');
  return (
    <>
      <iframe
        src={url}
        title="Camera feed"
        allow="camera; microphone; fullscreen; display-capture"
        allowFullScreen
        className="absolute inset-0 w-full h-full border-0 bg-black"
        onLoad={() => setState('live')}
      />
      {state === 'loading' && <PlayerLoading />}
    </>
  );
}

function ImagePlayer({ url }: { url: string }) {
  const [tick, setTick] = useState(0);
  const [state, setState] = useState<PlayerState>('loading');
  useEffect(() => {
    const t = setInterval(() => { if (!document.hidden) setTick(v => v + 1); }, 5000);
    return () => clearInterval(t);
  }, []);
  if (state === 'error') return <PlayerError onRetry={() => { setState('loading'); setTick(v => v + 1); }} />;
  return (
    <>
      {/* eslint-disable @next/next/no-img-element */}
      <img
        src={`${url}${url.includes('?') ? '&' : '?'}t=${tick}`}
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
        onLoad={() => setState('live')}
        onError={() => setState('error')}
      />
      {state === 'loading' && <PlayerLoading />}
    </>
  );
}

function PlayerLoading() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/70">
      <Loader2 className="w-6 h-6 animate-spin text-white/80" />
    </div>
  );
}

function PlayerError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/75 px-4 text-center">
      <AlertTriangle className="w-6 h-6 text-amber-400" />
      <p className="text-xs text-white/80">Feed unavailable — is the relay/NVR reachable?</p>
      <button onClick={onRetry} className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 hover:bg-white/25 px-3 py-1.5 text-xs text-white transition-colors">
        <RefreshCw className="w-3.5 h-3.5" /> Retry
      </button>
    </div>
  );
}

/* --------------------------------- tile -------------------------------- */

function CameraTile({ cam, onEdit, onDelete }: { cam: Camera; onEdit: (c: Camera) => void; onDelete: (c: Camera) => void }) {
  return (
    <div className="glass rounded-2xl overflow-hidden group">
      <div className="relative aspect-video bg-black">
        {!cam.active ? (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-white/60 bg-black/70">Disabled</div>
        ) : cam.kind === 'embed' ? (
          <EmbedPlayer url={cam.streamUrl} />
        ) : cam.kind === 'image' ? (
          <ImagePlayer url={cam.streamUrl} />
        ) : (
          <HlsPlayer url={cam.streamUrl} />
        )}
        {/* controls */}
        <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onEdit(cam)} aria-label={`Edit ${cam.name}`} className="p-1.5 rounded-lg bg-black/60 hover:bg-black/80 text-white">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onDelete(cam)} aria-label={`Delete ${cam.name}`} className="p-1.5 rounded-lg bg-black/60 hover:bg-black/80 text-red-400">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
        {cam.active && (
          <span className="absolute bottom-2 left-2 inline-flex items-center gap-1.5 rounded-full bg-black/60 px-2 py-1 text-[10px] text-white/90">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> LIVE
          </span>
        )}
      </div>
      <div className="px-3 py-2.5 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-primary truncate">{cam.name}</p>
          {cam.zone && <p className="text-[11px] text-muted truncate">{cam.zone}</p>}
        </div>
        <span className="text-[10px] uppercase tracking-wide text-muted shrink-0">{cam.kind}</span>
      </div>
    </div>
  );
}

/* --------------------------------- form -------------------------------- */

const EMPTY = { name: '', zone: '', streamUrl: '', kind: '', sortOrder: '0', active: true };

function CameraForm({
  initial,
  onClose,
  onSaved
}: {
  initial: Camera | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState(() =>
    initial
      ? { name: initial.name, zone: initial.zone ?? '', streamUrl: initial.streamUrl, kind: initial.kind, sortOrder: String(initial.sortOrder), active: initial.active }
      : EMPTY
  );
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        streamUrl: form.streamUrl.trim(),
        zone: form.zone.trim(),
        kind: form.kind, // '' = auto-detect
        sortOrder: Number(form.sortOrder) || 0,
        active: form.active
      };
      const res = await fetch(initial ? '/api/admin/cameras' : '/api/admin/cameras', {
        method: initial ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(initial ? { ...payload, id: initial.id } : payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      toast.success(initial ? 'Camera updated' : 'Camera added');
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <form onSubmit={save} className="glass-strong relative rounded-3xl p-6 w-full max-w-lg space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-bold text-primary flex items-center gap-2">
            <CameraIcon className="w-5 h-5 text-[var(--accent)]" /> {initial ? 'Edit camera' : 'Add camera'}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-[var(--surface-soft)]"><X className="w-4 h-4" /></button>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <label className="block text-sm">
            <span className="text-secondary">Name *</span>
            <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Cage 1" className="mt-1 w-full rounded-xl bg-[var(--surface-soft)] border border-[var(--border-color)] px-3 py-2" />
          </label>
          <label className="block text-sm">
            <span className="text-secondary">Zone / location</span>
            <input value={form.zone} onChange={e => setForm(f => ({ ...f, zone: e.target.value }))}
              placeholder="Othany East cages" className="mt-1 w-full rounded-xl bg-[var(--surface-soft)] border border-[var(--border-color)] px-3 py-2" />
          </label>
        </div>

        <label className="block text-sm">
          <span className="text-secondary">Stream URL *</span>
          <input required value={form.streamUrl} onChange={e => setForm(f => ({ ...f, streamUrl: e.target.value }))}
            placeholder="https://relay.example.com/stream/cage1.m3u8"
            className="mt-1 w-full rounded-xl bg-[var(--surface-soft)] border border-[var(--border-color)] px-3 py-2 font-mono text-xs" />
          <span className="mt-1.5 block text-[11px] text-muted">
            Must be HTTPS and browser-playable: an .m3u8 playlist, an embed page (e.g. go2rtc
            <code className="mx-1">/embed.html?src=…</code>), or a snapshot .jpg. Raw rtsp:// links are refused — relay
            them on the farm&apos;s always-on device first (README → Farm cameras). HTTPS is required once the portal is live.
          </span>
        </label>

        <div className="grid sm:grid-cols-3 gap-4">
          <label className="block text-sm">
            <span className="text-secondary">Feed type</span>
            <select value={form.kind} onChange={e => setForm(f => ({ ...f, kind: e.target.value }))}
              className="mt-1 w-full rounded-xl bg-[var(--surface-soft)] border border-[var(--border-color)] px-3 py-2">
              <option value="">Auto-detect</option>
              <option value="hls">HLS stream (.m3u8)</option>
              <option value="embed">Embed page (iframe)</option>
              <option value="image">Snapshot (.jpg)</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-secondary">Order</span>
            <input type="number" value={form.sortOrder} onChange={e => setForm(f => ({ ...f, sortOrder: e.target.value }))}
              className="mt-1 w-full rounded-xl bg-[var(--surface-soft)] border border-[var(--border-color)] px-3 py-2" />
          </label>
          <label className="block text-sm flex items-end gap-2 pb-1">
            <input type="checkbox" checked={form.active} onChange={e => setForm(f => ({ ...f, active: e.target.checked }))} className="w-4 h-4" />
            <span className="text-secondary">Enabled</span>
          </label>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary text-sm">Cancel</button>
          <button type="submit" disabled={saving} className="btn-primary text-sm">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} {initial ? 'Save changes' : 'Add camera'}
          </button>
        </div>
      </form>
    </div>
  );
}

/* --------------------------------- page -------------------------------- */

export default function AdminCamerasPage() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Camera | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/cameras');
      const data = await res.json();
      setCameras(data.cameras || []);
    } catch {
      /* keep last known feeds on a transient failure */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function remove(cam: Camera) {
    if (!confirm(`Remove camera "${cam.name}"?`)) return;
    const res = await fetch(`/api/admin/cameras?id=${cam.id}`, { method: 'DELETE' });
    if (res.ok) { toast.success('Camera removed'); setCameras(c => c.filter(x => x.id !== cam.id)); }
    else toast.error('Failed to delete');
  }

  function openEdit(cam: Camera) { setEditing(cam); setFormOpen(true); }
  function openAdd() { setEditing(null); setFormOpen(true); }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-primary flex items-center gap-2">
            <CameraIcon className="w-6 h-6 text-[var(--accent)]" /> Farm Cameras
          </h1>
          <p className="text-sm text-muted mt-1">Live CCTV wall — feeds relayed from the farm&apos;s NVR over HTTPS.</p>
        </div>
        <button onClick={openAdd} className="btn-primary">
          <Plus className="w-4 h-4" /> Add Camera
        </button>
      </div>

      {loading ? (
        <div className="glass rounded-3xl p-12 text-center"><Loader2 className="w-6 h-6 animate-spin text-[var(--accent)] mx-auto" /></div>
      ) : cameras.length === 0 ? (
        <div className="glass rounded-3xl p-16 text-center text-muted border-2 border-dashed border-[var(--border-color)] space-y-3">
          <CameraIcon className="w-8 h-8 mx-auto text-[var(--accent)]" />
          <p>No cameras yet. Add your first feed to start the wall.</p>
          <p className="text-xs max-w-md mx-auto">
            Cameras speak RTSP, browsers don&apos;t — run a relay (go2rtc) on the farm&apos;s always-on NVR or PC and paste
            the HTTPS URL it prints here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {cameras.map(c => (
            <CameraTile key={c.id} cam={c} onEdit={openEdit} onDelete={remove} />
          ))}
        </div>
      )}

      {formOpen && (
        <CameraForm
          initial={editing}
          onClose={() => setFormOpen(false)}
          onSaved={load}
        />
      )}
    </div>
  );
}
