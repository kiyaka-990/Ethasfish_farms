'use client';
import { useEffect, useState } from 'react';
import { Loader2, Save, Users, Phone, Mail, Bot } from 'lucide-react';
import toast from 'react-hot-toast';

interface Lead {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  source: string;
  status: string;
  notes: string | null;
  createdAt: string;
}

const statuses = ['new', 'contacted', 'qualified', 'won', 'lost'];
const statusColor: Record<string, string> = {
  new: 'text-[var(--accent)]',
  contacted: 'text-amber-500',
  qualified: 'text-violet-500',
  won: 'text-green-600',
  lost: 'text-red-500'
};

export default function AdminLeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch('/api/admin/leads');
    const data = await res.json();
    setLeads(data.leads || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function patch(id: string, key: keyof Lead, value: any) {
    setLeads(ls => ls.map(l => l.id !== id ? l : { ...l, [key]: value }));
  }

  async function save(lead: Lead) {
    setSaving(lead.id);
    const res = await fetch('/api/admin/leads', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: lead.id, status: lead.status, notes: lead.notes })
    });
    setSaving(null);
    if (res.ok) toast.success('Lead updated');
    else toast.error('Failed to save');
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-primary flex items-center gap-2">
          <Users className="w-6 h-6 text-[var(--accent)]" /> Leads
        </h1>
        <p className="text-sm text-muted mt-1 flex items-center gap-1.5">
          <Bot className="w-3.5 h-3.5 text-[var(--accent)]" />
          Contacts captured by the AI sales agent and the contact form — follow up here
        </p>
      </div>

      {loading ? (
        <div className="glass rounded-3xl p-12 text-center"><Loader2 className="w-6 h-6 animate-spin text-[var(--accent)] mx-auto" /></div>
      ) : leads.length === 0 ? (
        <div className="glass rounded-3xl p-12 text-center text-muted text-sm">No leads captured yet.</div>
      ) : (
        <div className="space-y-3">
          {leads.map(l => (
            <div key={l.id} className="glass rounded-2xl p-5 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-primary">{l.name}</p>
                  <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-secondary">
                    {l.phone && <span className="inline-flex items-center gap-1"><Phone className="w-3 h-3" /> {l.phone}</span>}
                    {l.email && <span className="inline-flex items-center gap-1"><Mail className="w-3 h-3" /> {l.email}</span>}
                    <span className="badge !text-[10px]">{l.source}</span>
                    <span className="text-muted">{new Date(l.createdAt).toLocaleString()}</span>
                  </div>
                </div>
                <select
                  value={l.status}
                  onChange={e => patch(l.id, 'status', e.target.value)}
                  className={`input-glass !w-auto !py-1.5 !px-3 text-xs font-semibold ${statusColor[l.status] || ''}`}
                >
                  {statuses.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <textarea
                rows={2}
                className="input-glass !py-2 text-sm resize-none"
                placeholder="Notes..."
                value={l.notes || ''}
                onChange={e => patch(l.id, 'notes', e.target.value)}
              />
              <button onClick={() => save(l)} disabled={saving === l.id} className="btn-primary !py-2 text-xs">
                {saving === l.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
