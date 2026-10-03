'use client';
import { useEffect, useState } from 'react';
import { Loader2, Package, Send, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { fmtKsh } from '@/lib/utils';

const STATUS_OPTIONS = ['pending', 'paid', 'preparing', 'out_for_delivery', 'delivered', 'cancelled'];

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [resending, setResending] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/admin/orders${filter ? `?status=${filter}` : ''}`);
    const data = await res.json();
    setOrders(data.orders || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [filter]);

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

      {loading ? (
        <div className="glass rounded-3xl p-12 text-center"><Loader2 className="w-6 h-6 animate-spin text-[var(--accent)] mx-auto" /></div>
      ) : orders.length === 0 ? (
        <div className="glass rounded-3xl p-16 text-center text-muted">
          <Package className="w-12 h-12 mx-auto mb-3 opacity-40" />
          No orders found
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map(o => (
            <div key={o.id} className="glass-strong rounded-2xl p-5">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                <div>
                  <p className="font-mono text-sm font-semibold text-primary">{o.orderNumber}</p>
                  <p className="text-xs text-muted">{new Date(o.createdAt).toLocaleString('en-KE')}</p>
                </div>
                <div className="text-right">
                  <p className="font-display text-xl font-bold gradient-text">{fmtKsh(o.total)}</p>
                  <p className={`text-xs ${o.paymentStatus === 'paid' ? 'text-green-500' : 'text-amber-500'}`}>
                    {o.paymentStatus} {o.mpesaRef && `· ${o.mpesaRef}`}
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
          ))}
        </div>
      )}
    </div>
  );
}
