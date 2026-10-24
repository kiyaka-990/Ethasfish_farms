'use client';
import { useEffect, useState } from 'react';
import { Loader2, HandCoins, Users, AlertTriangle, Phone, X, ChevronDown, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { fmtKsh } from '@/lib/utils';

// Per-customer credit ledger: who owes how much, since when, and overdue by
// how long. Built from the same /api/admin/orders?outstanding=1 view the
// Orders "Owed" filter uses, grouped by customer phone (falling back to the
// name for orders taken without one).

interface CreditOrder {
  id: string; orderNumber: string; total: number; createdAt: string; dueDate: string | null;
  paymentStatus: string; paymentMethod: string; channel: string; status: string;
  payments: Array<{ amount: number; status: string }>;
}

interface CustomerDebt {
  key: string;
  name: string;
  phone: string;
  owed: number;
  orders: CreditOrder[];
  oldestDue: string | null;
  overdue: boolean;
}

function paidSoFar(o: CreditOrder) {
  return o.payments.filter(p => p.status === 'success').reduce((s, p) => s + p.amount, 0);
}

export default function AdminCreditPage() {
  const [orders, setOrders] = useState<CreditOrder[] | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [paying, setPaying] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await fetch('/api/admin/orders?outstanding=1');
    const data = await res.json();
    setOrders(data.orders || []);
  }
  useEffect(() => { load(); }, []);

  const customers: CustomerDebt[] = (() => {
    if (!orders) return [];
    const map = new Map<string, CustomerDebt>();
    for (const o of orders) {
      const outstanding = o.total - paidSoFar(o);
      if (outstanding <= 0) continue;
      const phone = (o as any).customerPhone || '';
      const name = (o as any).customerName || 'Unknown';
      const key = phone || name.toLowerCase();
      const entry = map.get(key) || { key, name, phone, owed: 0, orders: [] as CreditOrder[], oldestDue: null, overdue: false };
      entry.orders.push(o);
      entry.owed += outstanding;
      // Track the earliest deadline so "overdue" reflects the worst case.
      if (o.dueDate && (!entry.oldestDue || new Date(o.dueDate) < new Date(entry.oldestDue))) entry.oldestDue = o.dueDate;
      if (o.dueDate && new Date(o.dueDate) < new Date(new Date().toDateString())) entry.overdue = true;
      if (!entry.oldestDue && !o.dueDate && o.paymentMethod !== 'credit') entry.overdue = false;
      map.set(key, entry);
    }
    return [...map.values()].sort((a, b) => Number(b.overdue) - Number(a.overdue) || b.owed - a.owed);
  })();

  const totalOwed = customers.reduce((s, c) => s + c.owed, 0);
  const overdueOwed = customers.filter(c => c.overdue).reduce((s, c) => s + c.owed, 0);

  async function submitPayment() {
    if (!paying) return;
    const amount = Math.round(Number(paying.amount));
    if (!amount || amount <= 0) return toast.error('Enter a valid amount');
    setSaving(true);
    try {
      const res = await fetch('/api/admin/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: paying.order.id,
          recordPayment: { amount, method: paying.method, reference: paying.reference || undefined }
        })
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Failed to record payment'); return; }
      toast.success(data.order?.paymentStatus === 'paid' ? 'Settled in full' : 'Payment recorded');
      setPaying(null);
      load();
    } catch {
      toast.error('Connection issue - try again');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-primary flex items-center gap-2">
          <HandCoins className="w-6 h-6 text-amber-500" /> Credit Ledger
        </h1>
        <p className="text-sm text-muted mt-1">Customers buying on credit and what they still owe.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="glass-strong rounded-2xl p-5">
          <p className="text-[11px] uppercase tracking-wider text-muted">Total owed</p>
          <p className={`font-display text-xl font-bold mt-1 ${totalOwed > 0 ? 'text-amber-500' : 'text-primary'}`}>{fmtKsh(totalOwed)}</p>
        </div>
        <div className="glass-strong rounded-2xl p-5">
          <p className="text-[11px] uppercase tracking-wider text-muted">Overdue</p>
          <p className={`font-display text-xl font-bold mt-1 ${overdueOwed > 0 ? 'text-red-500' : 'text-primary'}`}>{fmtKsh(overdueOwed)}</p>
        </div>
        <div className="glass-strong rounded-2xl p-5">
          <p className="text-[11px] uppercase tracking-wider text-muted">Customers owing</p>
          <p className="font-display text-xl font-bold text-primary mt-1">{customers.length}</p>
        </div>
      </div>

      {!orders ? (
        <div className="glass rounded-3xl p-12 text-center"><Loader2 className="w-6 h-6 animate-spin text-[var(--accent)] mx-auto" /></div>
      ) : customers.length === 0 ? (
        <div className="glass rounded-3xl p-16 text-center text-muted border-2 border-dashed border-[var(--border-color)]">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
          Nobody is owing anything right now.
        </div>
      ) : (
        <div className="space-y-3">
          {customers.map(c => (
            <div key={c.key} className={`glass-strong rounded-2xl p-5 ${c.overdue ? 'ring-2 ring-red-500/60' : ''}`}>
              <button
                onClick={() => setExpanded(expanded === c.key ? null : c.key)}
                className="w-full flex flex-wrap items-center justify-between gap-3 text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {expanded === c.key ? <ChevronDown className="w-4 h-4 text-muted shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted shrink-0" />}
                  <div className="min-w-0">
                    <p className="font-semibold text-primary truncate">{c.name}</p>
                    {c.phone && <p className="text-xs text-muted flex items-center gap-1"><Phone className="w-3 h-3" /> {c.phone}</p>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-display text-lg font-bold text-amber-500">{fmtKsh(c.owed)}</p>
                  <p className={`text-[11px] ${c.overdue ? 'text-red-500 font-semibold' : 'text-muted'}`}>
                    {c.overdue && <AlertTriangle className="w-3 h-3 inline mr-0.5" />}
                    {c.orders.length} order{c.orders.length > 1 ? 's' : ''}
                    {c.oldestDue && ` · due ${new Date(c.oldestDue).toLocaleDateString('en-KE')}`}
                  </p>
                </div>
              </button>

              {expanded === c.key && (
                <div className="mt-4 pt-4 border-t border-[var(--border-color)] space-y-2">
                  {c.orders.map(o => {
                    const outstanding = o.total - paidSoFar(o);
                    const od = o.dueDate && new Date(o.dueDate) < new Date(new Date().toDateString());
                    return (
                      <div key={o.id} className="flex flex-wrap items-center justify-between gap-3 glass-soft rounded-xl px-4 py-3">
                        <div className="min-w-0">
                          <p className="font-mono text-xs font-semibold text-primary">{o.orderNumber}</p>
                          <p className="text-[11px] text-muted">
                            {new Date(o.createdAt).toLocaleDateString('en-KE')}
                            {o.dueDate && <span className={od ? 'text-red-500 font-semibold' : 'text-amber-500'}> · due {new Date(o.dueDate).toLocaleDateString('en-KE')}</span>}
                            {od && ' · overdue'}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="text-sm font-semibold text-amber-500">{fmtKsh(outstanding)}</p>
                            <p className="text-[10px] text-muted">of {fmtKsh(o.total)}</p>
                          </div>
                          <button
                            onClick={() => setPaying({ order: o, amount: String(outstanding), method: 'cash', reference: '' })}
                            className="btn-glass !py-1.5 !px-3 !text-xs text-amber-500 !border-amber-500/50 hover:bg-amber-500/10"
                          >
                            Record Payment
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {paying && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4">
          <div className="glass-strong rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-1">
              <p className="font-display font-bold text-lg text-primary flex items-center gap-2">
                <HandCoins className="w-5 h-5 text-amber-500" /> Record Payment
              </p>
              <button onClick={() => setPaying(null)} className="text-muted hover:text-primary"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-xs text-muted mb-4">{paying.order.orderNumber} · {(paying.order as any).customerName || ''}</p>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] uppercase tracking-wider text-muted">Amount received *</label>
                <input
                  type="number"
                  value={paying.amount}
                  onChange={e => setPaying((p: any) => ({ ...p, amount: e.target.value }))}
                  className="w-full mt-1 px-3.5 py-2.5 text-sm rounded-xl border border-[var(--border-color)] bg-transparent text-primary outline-none focus:border-[var(--accent)]"
                />
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wider text-muted">Method</label>
                <div className="flex gap-1.5 mt-1">
                  {['cash', 'mpesa', 'bank', 'mobile'].map(m => (
                    <button key={m} onClick={() => setPaying((p: any) => ({ ...p, method: m }))}
                      className={`flex-1 px-2 py-2 rounded-xl text-xs font-medium border transition ${paying.method === m ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]' : 'border-[var(--border-color)] text-secondary'}`}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wider text-muted">Reference (optional)</label>
                <input
                  value={paying.reference}
                  onChange={e => setPaying((p: any) => ({ ...p, reference: e.target.value.toUpperCase() }))}
                  placeholder="M-Pesa code / receipt no."
                  className="w-full mt-1 px-3.5 py-2.5 text-sm rounded-xl border border-[var(--border-color)] bg-transparent text-primary outline-none focus:border-[var(--accent)]"
                />
              </div>
            </div>

            <button
              onClick={submitPayment}
              disabled={saving}
              className="w-full mt-5 py-3 rounded-xl font-semibold text-white bg-gradient-to-br from-amber-500 to-orange-600 disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <HandCoins className="w-4 h-4" />}
              Record {fmtKsh(Math.round(Number(paying.amount) || 0))}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
