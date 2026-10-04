'use client';
import { useEffect, useState } from 'react';
import { Loader2, Plus, Trash2, Megaphone } from 'lucide-react';
import toast from 'react-hot-toast';

interface Promotion {
  id: string;
  type: string;
  message: string;
  ctaLabel: string | null;
  ctaHref: string | null;
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
}

const TYPES = [
  { value: 'sale', label: 'Sale' },
  { value: 'harvest', label: 'New Harvest' },
  { value: 'restock', label: 'Restock' },
  { value: 'announcement', label: 'Announcement' }
];

const empty = { type: 'sale', message: '', ctaLabel: '', ctaHref: '', startsAt: '', endsAt: '' };

export default function AdminPromotionsPage() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState(empty);
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch('/api/admin/promotions');
    const data = await res.json();
    setPromotions(data.promotions || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function create() {
    if (!draft.message.trim()) return toast.error('Message required');
    setCreating(true);
    const res = await fetch('/api/admin/promotions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft)
    });
    setCreating(false);
    if (res.ok) { toast.success('Posted — now live on the site'); setDraft(empty); load(); }
    else toast.error('Failed to post');
  }

  async function toggleActive(p: Promotion) {
    const res = await fetch('/api/admin/promotions', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: p.id, active: !p.active })
    });
    if (res.ok) load(); else toast.error('Failed');
  }

  async function remove(id: string) {
    if (!confirm('Remove this promotion?')) return;
    const res = await fetch(`/api/admin/promotions?id=${id}`, { method: 'DELETE' });
    if (res.ok) { toast.success('Removed'); load(); } else toast.error('Failed');
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-primary flex items-center gap-2">
          <Megaphone className="w-6 h-6 text-[var(--accent)]" /> Promotions
        </h1>
        <p className="text-sm text-muted mt-1">Posts a banner on the site announcing a sale, new harvest, or restock. Visible to every visitor until you deactivate it.</p>
      </div>

      <div className="glass-strong rounded-3xl p-6 space-y-3">
        <h2 className="font-semibold text-primary">Post a new promotion</h2>
        <div className="grid md:grid-cols-[160px_1fr] gap-3">
          <select className="input-glass" value={draft.type} onChange={e => setDraft({ ...draft, type: e.target.value })}>
            {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <input className="input-glass" placeholder="e.g. 20% off all fillets this week!" value={draft.message} onChange={e => setDraft({ ...draft, message: e.target.value })} />
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <input className="input-glass" placeholder="Button text (optional, e.g. Shop Now)" value={draft.ctaLabel} onChange={e => setDraft({ ...draft, ctaLabel: e.target.value })} />
          <input className="input-glass" placeholder="Button link (optional, e.g. /shop)" value={draft.ctaHref} onChange={e => setDraft({ ...draft, ctaHref: e.target.value })} />
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted">Starts (optional)</label>
            <input type="datetime-local" className="input-glass mt-1" value={draft.startsAt} onChange={e => setDraft({ ...draft, startsAt: e.target.value })} />
          </div>
          <div>
            <label className="text-xs text-muted">Ends (optional)</label>
            <input type="datetime-local" className="input-glass mt-1" value={draft.endsAt} onChange={e => setDraft({ ...draft, endsAt: e.target.value })} />
          </div>
        </div>
        <button onClick={create} disabled={creating} className="btn-primary">
          {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Post Promotion
        </button>
      </div>

      {loading ? (
        <div className="glass rounded-3xl p-12 text-center"><Loader2 className="w-6 h-6 animate-spin text-[var(--accent)] mx-auto" /></div>
      ) : promotions.length === 0 ? (
        <p className="text-muted text-sm">No promotions yet.</p>
      ) : (
        <div className="space-y-3">
          {promotions.map(p => (
            <div key={p.id} className="glass rounded-2xl p-5 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="badge !text-[10px]">{TYPES.find(t => t.value === p.type)?.label || p.type}</span>
                  {!p.active && <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-red-500/10 text-red-500">Paused</span>}
                </div>
                <p className="text-primary">{p.message}</p>
                {p.ctaLabel && <p className="text-xs text-muted mt-1">Button: {p.ctaLabel} → {p.ctaHref}</p>}
                {(p.startsAt || p.endsAt) && (
                  <p className="text-[11px] text-muted mt-1">
                    {p.startsAt ? `From ${new Date(p.startsAt).toLocaleString('en-KE')}` : ''}
                    {p.startsAt && p.endsAt ? ' · ' : ''}
                    {p.endsAt ? `Until ${new Date(p.endsAt).toLocaleString('en-KE')}` : ''}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <label className="flex items-center gap-1.5 text-xs text-secondary">
                  <input type="checkbox" checked={p.active} onChange={() => toggleActive(p)} className="accent-sea-400" />
                  Active
                </label>
                <button onClick={() => remove(p.id)} className="text-red-500/80 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
