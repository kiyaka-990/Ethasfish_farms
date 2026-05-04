'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Search, Package, CheckCircle2, Clock, Truck, MapPin, Phone, Receipt as ReceiptIcon } from 'lucide-react';
import { fmtKsh } from '@/lib/utils';

const STAGES = [
  { key: 'pending',          label: 'Order Received',   subtitle: 'Awaiting payment',                         Icon: Clock },
  { key: 'paid',             label: 'Payment Confirmed', subtitle: 'M-Pesa received, receipt sent',           Icon: CheckCircle2 },
  { key: 'preparing',        label: 'Being Prepared',    subtitle: 'Fish selected, gutted & packed',          Icon: Package },
  { key: 'out_for_delivery', label: 'Out for Delivery',  subtitle: 'On the way to you',                       Icon: Truck },
  { key: 'delivered',        label: 'Delivered',          subtitle: 'Enjoy your fresh tilapia!',              Icon: CheckCircle2 }
];

function TrackInner() {
  const params = useSearchParams();
  const [orderNumber, setOrderNumber] = useState(params.get('order') || '');
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function lookup(num?: string) {
    const target = (num ?? orderNumber).trim();
    if (!target) return;
    setLoading(true); setError(''); setOrder(null);
    try {
      const res = await fetch(`/api/orders?orderNumber=${encodeURIComponent(target)}`);
      const data = await res.json();
      if (!res.ok || !data.order) { setError(data.error || 'Order not found'); return; }
      setOrder(data.order);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    if (params.get('order')) lookup(params.get('order')!);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentStageIdx = order ? STAGES.findIndex(s => s.key === order.status) : -1;
  const cancelled = order?.status === 'cancelled';

  return (
    <div className="px-4 py-16">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-10">
          <span className="section-label">Order Status</span>
          <h1 className="section-title">Track your <span className="gradient-text">order</span></h1>
          <p className="text-secondary mt-3 max-w-md mx-auto">See the full journey — from payment to your doorstep.</p>
        </div>

        <form onSubmit={e => { e.preventDefault(); lookup(); }} className="glass-strong rounded-3xl p-6 mb-6 flex gap-3">
          <input
            value={orderNumber}
            onChange={e => setOrderNumber(e.target.value)}
            placeholder="Enter order number (EF-XXXX-XXXX)"
            className="input-glass flex-1"
          />
          <button type="submit" disabled={loading} className="btn-primary !px-5">
            <Search className="w-4 h-4" /> {loading ? 'Searching...' : 'Track'}
          </button>
        </form>

        {error && <div className="glass rounded-2xl p-6 text-center text-red-500">{error}</div>}

        {order && (
          <div className="glass-strong rounded-3xl p-6 md:p-8 space-y-8">
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted">Order Number</p>
                <p className="font-mono font-bold text-primary">{order.orderNumber}</p>
                <p className="text-xs text-muted mt-1">{new Date(order.createdAt).toLocaleString('en-KE')}</p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-wider text-muted">Total</p>
                <p className="font-display text-xl font-bold gradient-text">{fmtKsh(order.total)}</p>
                <p className={`text-xs ${order.paymentStatus === 'paid' ? 'text-green-500' : 'text-amber-500'}`}>
                  {order.paymentStatus === 'paid' ? '✓ Paid' : order.paymentStatus}
                </p>
              </div>
            </div>

            {/* Stage progress - desktop horizontal */}
            {!cancelled ? (
              <div className="hidden md:block relative pt-2">
                <div className="absolute top-7 left-5 right-5 h-1 rounded-full bg-[var(--surface)]" />
                <div className="absolute top-7 left-5 h-1 rounded-full bg-gradient-to-r from-[#4dd1c4] via-[#1eb5a6] to-[#0e8c7f] transition-all duration-1000" style={{ width: `calc(${Math.max(0, (currentStageIdx / (STAGES.length - 1)) * 100)}% - 10px)` }} />
                <div className="grid grid-cols-5 relative">
                  {STAGES.map((stage, i) => {
                    const Icon = stage.Icon;
                    const done = i <= currentStageIdx;
                    const current = i === currentStageIdx;
                    return (
                      <div key={stage.key} className="flex flex-col items-center gap-2 px-1">
                        <div className={`relative w-12 h-12 rounded-full flex items-center justify-center transition-all ${done ? 'bg-gradient-to-br from-[#4dd1c4] to-[#0e8c7f] shadow-lg' : 'glass-soft'} ${current ? 'ring-4 ring-[var(--accent)]/30' : ''}`}>
                          <Icon className={`w-5 h-5 ${done ? 'text-white' : 'text-muted'}`} />
                          {current && <span className="absolute inset-0 rounded-full bg-[var(--accent)] animate-ping opacity-30" />}
                        </div>
                        <p className={`text-xs font-semibold text-center ${done ? 'text-primary' : 'text-muted'}`}>{stage.label}</p>
                        <p className="text-[10px] text-muted text-center leading-tight max-w-[110px]">{stage.subtitle}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="glass rounded-2xl p-5 border border-red-500/30 text-center">
                <p className="text-red-500 font-semibold">This order has been cancelled.</p>
              </div>
            )}

            {/* Mobile vertical timeline */}
            {!cancelled && (
              <div className="md:hidden space-y-3">
                {STAGES.map((stage, i) => {
                  const Icon = stage.Icon;
                  const done = i <= currentStageIdx;
                  const current = i === currentStageIdx;
                  return (
                    <div key={stage.key} className={`flex items-start gap-3 p-3 rounded-2xl transition ${current ? 'glass-strong' : 'glass-soft'}`}>
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${done ? 'bg-gradient-to-br from-[#4dd1c4] to-[#0e8c7f]' : 'glass'}`}>
                        <Icon className={`w-4 h-4 ${done ? 'text-white' : 'text-muted'}`} />
                      </div>
                      <div className="min-w-0">
                        <p className={`text-sm font-semibold ${done ? 'text-primary' : 'text-muted'}`}>{stage.label}</p>
                        <p className="text-xs text-muted leading-tight">{stage.subtitle}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Order details */}
            <div className="grid sm:grid-cols-2 gap-4 pt-4 border-t border-[var(--border-color)]">
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-muted flex items-center gap-1.5"><MapPin className="w-3 h-3"/> Delivery to</p>
                <p className="text-sm text-secondary">{order.deliveryAddress}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-muted flex items-center gap-1.5"><Phone className="w-3 h-3"/> Contact</p>
                <p className="text-sm text-secondary">{order.customerName} · +{order.customerPhone}</p>
              </div>
            </div>

            <div className="space-y-1 text-sm pt-4 border-t border-[var(--border-color)]">
              <p className="text-[10px] uppercase tracking-wider text-muted mb-2">Order items</p>
              {order.items.map((it: any) => (
                <div key={it.id} className="flex items-center justify-between text-secondary">
                  <span>{it.productName} · {it.variantLabel} × {it.quantity}</span>
                  <span className="text-primary font-medium">{fmtKsh(it.lineTotal)}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-2 pt-4 border-t border-[var(--border-color)]">
              <Link href={`/receipt?order=${order.orderNumber}`} className="btn-glass text-sm">
                <ReceiptIcon className="w-4 h-4"/> View Receipt
              </Link>
              <a href={`https://wa.me/${process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '254700000000'}?text=Hi%20Ethasfish%2C%20I'm%20checking%20on%20order%20${order.orderNumber}`}
                target="_blank" rel="noopener noreferrer"
                className="btn-primary text-sm">
                Need help? WhatsApp
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function TrackPage() {
  return <Suspense fallback={null}><TrackInner /></Suspense>;
}
