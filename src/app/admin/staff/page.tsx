'use client';
import { useEffect, useState } from 'react';
import { Loader2, UserPlus, Trash2, Users } from 'lucide-react';
import toast from 'react-hot-toast';

interface Staff { id: string; email: string; name: string; role: string; active: boolean; clerkUserId: string; lastSeenAt: string | null }

export default function AdminStaffPage() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', email: '', role: 'sales_manager' });
  const [inviting, setInviting] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch('/api/admin/staff');
    if (res.status === 403) { setLoading(false); return; }
    const data = await res.json();
    setStaff(data.staff || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function invite() {
    if (!form.name.trim() || !form.email.trim()) return toast.error('Name and email required');
    setInviting(true);
    const res = await fetch('/api/admin/staff', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    setInviting(false);
    if (res.ok) { toast.success('Invited — they get full access when they sign in with that email'); setForm({ name: '', email: '', role: 'sales_manager' }); load(); }
    else toast.error('Failed to invite');
  }

  async function setRole(id: string, role: string) {
    const res = await fetch('/api/admin/staff', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, role }) });
    if (res.ok) load(); else toast.error('Failed');
  }

  async function saveField(s: Staff, field: 'name' | 'email', value: string) {
    if (!value.trim() || value === s[field]) return;
    const res = await fetch('/api/admin/staff', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: s.id, [field]: value }) });
    if (res.ok) { toast.success('Saved'); load(); }
    else { const d = await res.json().catch(() => ({})); toast.error(d.error || 'Failed'); load(); }
  }

  async function toggleActive(s: Staff) {
    const res = await fetch('/api/admin/staff', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: s.id, active: !s.active }) });
    if (res.ok) load(); else toast.error('Failed');
  }

  async function remove(id: string) {
    if (!confirm('Remove this staff member?')) return;
    const res = await fetch(`/api/admin/staff?id=${id}`, { method: 'DELETE' });
    if (res.ok) { toast.success('Removed'); load(); } else toast.error('Failed');
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-primary flex items-center gap-2">
          <Users className="w-6 h-6 text-[var(--accent)]" /> Staff
        </h1>
        <p className="text-sm text-muted mt-1">Invite teammates by email. They get portal access the moment they sign in with that address.</p>
      </div>

      <div className="glass-strong rounded-3xl p-6 space-y-3">
        <h2 className="font-semibold text-primary">Invite teammate</h2>
        <div className="grid md:grid-cols-[1fr_1fr_auto_auto] gap-3">
          <input className="input-glass" placeholder="Full name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <input className="input-glass" placeholder="Email address" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          <select className="input-glass" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
            <option value="sales_manager">Sales Manager</option>
            <option value="admin">Admin</option>
          </select>
          <button onClick={invite} disabled={inviting} className="btn-primary">
            {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />} Invite
          </button>
        </div>
      </div>

      {loading ? (
        <div className="glass rounded-3xl p-12 text-center"><Loader2 className="w-6 h-6 animate-spin text-[var(--accent)] mx-auto" /></div>
      ) : (
        <div className="glass rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted border-b border-[var(--border-color)]">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Last seen</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {staff.map(s => (
                <tr key={s.id} className="border-b border-[var(--border-color)] last:border-0">
                  <td className="px-4 py-3 text-primary">
                    <input
                      defaultValue={s.name}
                      onBlur={e => saveField(s, 'name', e.target.value)}
                      className="bg-transparent outline-none focus:ring-1 focus:ring-[var(--accent)] rounded px-1 -mx-1 w-full"
                    />
                  </td>
                  <td className="px-4 py-3 text-secondary">
                    <input
                      defaultValue={s.email}
                      disabled={!s.clerkUserId.startsWith('pending:')}
                      onBlur={e => saveField(s, 'email', e.target.value)}
                      title={s.clerkUserId.startsWith('pending:') ? 'Edit the invite email before they sign in' : 'Already signed in - remove and re-invite to change the email'}
                      className="bg-transparent outline-none focus:ring-1 focus:ring-[var(--accent)] rounded px-1 -mx-1 w-full disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <select className="input-glass !py-1.5 text-xs" value={s.role} onChange={e => setRole(s.id, e.target.value)}>
                      <option value="sales_manager">Sales Manager</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => toggleActive(s)} className={`badge !text-[10px] !py-0.5 ${s.active ? '' : '!bg-red-500/10 !border-red-500/30 !text-red-500'}`}>
                      {s.active ? 'Active' : 'Disabled'}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-[11px] text-muted">
                    {s.clerkUserId.startsWith('pending:') ? 'Invited — not signed in yet' : s.lastSeenAt ? new Date(s.lastSeenAt).toLocaleString('en-KE') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => remove(s.id)} className="text-red-500/80 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
