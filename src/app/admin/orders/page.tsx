'use client';
import { useEffect, useState } from 'react';
import { Loader2, Package, Send, ExternalLink, HandCoins, AlertTriangle, X } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { fmtKsh } from '@/lib/utils';

const STATUS_OPTIONS = ['pending', 'paid', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'];
const PAYMENT_FILTERS = [
  { key: '', label: 'All' },
  { key: 'outstanding', label: 'Owed' },
  { key: 'credit', label: 'Credit' },
  { key: 'paid', label: 'Paid' }
];

// Outstanding = total minus everything actually received (success payments).
function paidSoFar(o: any) {
  return (o.payments || []).filter((p: any) => p.status === 'success').reduce((s: number, p: any) => s + p.amount, 0);
}

function isOverdue(o: any) {
  return Boolean(
    o.dueDate &&
    o.paymentStatus !== 'paid' &&
    o.status !== 'cancelled' &&
    new Date(o.dueDate) < new Date(new Date().toDateString())
  );
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [payFilter, setPayFilter] = useState('');
  const [resending, setResending] = useState<string | null>(null);
  const [paying, setPaying] = useState<any | null>(null);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (filter) params.set('status', filter);
    if (payFilter === 'outstanding') params.set('outstanding', '1');
    if (payFilter === 'credit') params.set('paymentMethod', 'credit');
    if (payFilter === 'paid') params.set('paymentStatus', 'paid');
    const qs = params.toString();
    const res = await fetch(`/api/admin/orders${qs ? `?${qs}` : ''}`);
    const data = await res.json();
    setOrders(data.orders || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [filter, payFilter]);

  async function updateStatus(orderId: string, status: string) {
    const res = await fetch('/api/admin/orders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, status })
    });
    if (res.ok) { toast.success('Updated'); load(); }
    else toast.error('Failed to update');
  }

  async function resendReceipt(orderId: string) {
    setResending(orderId);
    try {
      const res = await fetch('/api/admin/receipt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId })
      });
      const data = await res.json();
      if (res.ok) {
        const channels = [];
        if (data.result?.whatsapp) channels.push('WhatsApp');
        if (data.result?.sms) channels.push('SMS');
        if (data.result?.email) channels.push('Email');
        toast.success(channels.length ? `Receipt sent via ${channels.join(', ')}` : 'No channels configured (set WHATSAPP_TOKEN / AT_API_KEY / RESEND_API_KEY)');
      } else {
        toast.error(data.error || 'Failed to send');
      }
    } catch {
      toast.error('Failed to send');
    } finally {
      setResending(null);
    }
  }

  async function submitPayment() {
    if (!paying) return;
    const amount = Math.round(Number(paying.amount));
    if (!amount || amount <= 0) return toast.error('Enter a valid amount');
    setResending(paying.order.id);
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
      const settled = data.order?.paymentStatus === 'paid';
      toast.success(settled ? 'Payment recorded - order settled in full' : 'Payment recorded');
      setPaying(null);
      load();
    } catch {
      toast.error('Connection issue - try again');
    } finally {
      setResending(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-primary">Orders</h1>
          <p className="text-sm text-muted mt-1">Manage customer orders, update statuses, and resend receipts</p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setFilter('')} className={`px-3 py-1.5 rounded-xl text-xs font-medium transition ${!filter ? 'bg-gradient-to-br from-[#3B93CE] to-[#1C6EA8] text-white' : 'glass-soft text-secondary'}`}>All</button>
          {STATUS_OPTIONS.map(s => (
            <button key={s} onClick={() => setFilter(s)} className={`px-3 py-1.5 rounded-xl text-xs font-medium transition ${filter === s ? 'bg-gradient-to-br from-[#3B93CE] to-[#1C6EA8] text-white' : 'glass-soft text-secondary'}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] uppercase tracking-wider text-muted mr-1">Payment:</span>
        {PAYMENT_FILTERS.map(f => (
          <button key={f.key} onClick={() => setPayFilter(f.key)} className={`px-3 py-1.5 rounded-xl text-xs font-medium transition ${payFilter === f.key ? 'bg-gradient-to-br from-amber-500 to-orange-600 text-white' : 'glass-soft text-secondary hover:text-primary'}`}>
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="glass rounded-3xl p-12 text-center"><Loader2 className="w-6 h-6 animate-spin text-[var(--accent)] mx-auto" /></div>
      ) : orders.length === 0 ? (
        <div className="glass rounded-3xl p-16 text-center text-muted">
          <Package className="w-12 h-12 mx-auto mb-3 opacity-40" />
          No orders found
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map(o => {
            const paid = paidSoFar(o);
            const outstanding = Math.max(0, o.total - paid);
            const overdue = isOverdue(o);
            const owing = o.paymentStatus !== 'paid' && o.status !== 'cancelled' && outstanding > 0;
            return (
            <div key={o.id} className={`glass-strong rounded-2xl p-5 ${overdue ? 'ring-2 ring-red-500/60' : ''}`}>
              <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-mono text-sm font-semibold text-primary">{o.orderNumber}</p>
                    {o.channel === 'pos' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-[var(--accent)]/10 text-[var(--accent)] font-medium">POS</span>
                    )}
                    {o.paymentMethod === 'credit' && o.paymentStatus !== 'paid' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-500 font-semibold uppercase">Credit</span>
                    )}
                    {overdue && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-red-500/15 text-red-500 font-semibold uppercase flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Overdue
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted mt-0.5">{new Date(o.createdAt).toLocaleString('en-KE')}</p>
                  {o.dueDate && owing && (
                    <p className={`text-[11px] mt-1 ${overdue ? 'text-red-500 font-semibold' : 'text-amber-500'}`}>
                      Due by {new Date(o.dueDate).toLocaleDateString('en-KE')}
                      {overdue && ` · ${Math.ceil((Date.now() - new Date(o.dueDate).getTime()) / 86400000)} day(s) late`}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="font-display text-xl font-bold gradient-text">{fmtKsh(o.total)}</p>
                  <p className={`text-xs ${o.paymentStatus === 'paid' ? 'text-green-500' : o.paymentStatus === 'partially_paid' ? 'text-amber-500' : 'text-amber-500'}`}>
                    {o.paymentStatus === 'paid' ? 'Paid' : o.paymentStatus === 'partially_paid' ? `${fmtKsh(paid)} paid · ${fmtKsh(outstanding)} owed` : o.paymentStatus}
                    {o.mpesaRef && ` · ${o.mpesaRef}`}
                  </p>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4 mb-4 text-sm">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted">Customer</p>
                  <p className="text-primary">{o.customerName}</p>
                  <p className="text-secondary text-xs">{o.customerPhone}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted">Delivery</p>
                  <p className="text-secondary text-xs">{o.deliveryAddress}</p>
                  {o.notes && <p className="text-muted text-xs italic">"{o.notes}"</p>}
                </div>
              </div>

              <div className="space-y-1 mb-4 text-xs">
                {o.items.map((it: any) => (
                  <div key={it.id} className="flex items-center justify-between text-secondary">
                    <span>{it.productName} · {it.variantLabel} × {it.quantity}</span>
                    <span>{fmtKsh(it.lineTotal)}</span>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-1.5 pt-3 border-t border-[var(--border-color)]">
                <span className="text-[11px] text-muted uppercase tracking-wider mr-2">Status:</span>
                {STATUS_OPTIONS.map(s => (
                  <button key={s} onClick={() => updateStatus(o.id, s)}
                    className={`px-3 py-1 rounded-lg text-[11px] transition ${o.status === s ? 'bg-gradient-to-br from-[#3B93CE] to-[#1C6EA8] text-white' : 'glass-soft text-secondary hover:text-primary'}`}>
                    {s}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-3 mt-3 border-t border-[var(--border-color)]">
                {owing && (
                  <button onClick={() => setPaying({ order: o, amount: String(outstanding), method: 'cash', reference: '' })}
                    className="btn-glass !py-1.5 !px-3 !text-xs flex items-center gap-1.5 !border-amber-500/50 text-amber-500 hover:bg-amber-500/10">
                    <HandCoins className="w-3.5 h-3.5" /> Record Payment ({fmtKsh(outstanding)} owed)
                  </button>
                )}
                <button onClick={() => resendReceipt(o.id)} disabled={resending === o.id}
                  className="btn-glass !py-1.5 !px-3 !text-xs disabled:opacity-50">
                  {resending === o.id ? <Loader2 className="w-3 h-3 animate-spin"/> : <Send className="w-3 h-3"/>}
                  Resend Receipt
                </button>
                <Link href={`/receipt?order=${o.orderNumber}`} target="_blank" className="btn-glass !py-1.5 !px-3 !text-xs">
                  <ExternalLink className="w-3 h-3"/> View Receipt
                </Link>
              </div>
            </div>
            );
          })}
        </div>
      )}

      {paying && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4">
          <div className="glass-strong rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-1">
              <p className="font-display font-bold text-lg text-primary flex items-center gap-2">
                <HandCoins className="w-5 h-5 text-amber-500" /> Record Payment
              </p>
              <button onClick={() => setPaying(null)} className="text-muted hover:text-primary"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-xs text-muted mb-4">
              {paying.order.orderNumber} · {fmtKsh(paying.order.total)} total · customer {paying.order.customerName}
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] uppercase tracking-wider text-muted">Amount received *</label>
                <input
                  type="number"
                  value={paying.amount}
                  onChange={e => setPaying((p: any) => ({ ...p, amount: e.target.value }))}
                  className="w-full mt-1 px-3.5 py-2.5 text-sm rounded-xl border border-[var(--border-color)] bg-transparent text-primary outline-none focus:border-[var(--accent)]"
                />
                <p className="text-[11px] text-muted mt-1">Partial payments are allowed - the balance stays owed and shows on this list until settled.</p>
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
              disabled={resending === paying.order.id}
              className="w-full mt-5 py-3 rounded-xl font-semibold text-white bg-gradient-to-br from-amber-500 to-orange-600 disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {resending === paying.order.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <HandCoins className="w-4 h-4" />}
              Record {fmtKsh(Math.round(Number(paying.amount) || 0))}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
