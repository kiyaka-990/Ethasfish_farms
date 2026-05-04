'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, CheckCircle2, Smartphone, Receipt } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCart } from '@/lib/cart-store';
import { fmtKsh } from '@/lib/utils';

export default function OrderPage() {
  const router = useRouter();
  const { items, clear, subtotal } = useCart();
  const [step, setStep] = useState<'form' | 'paying' | 'done'>('form');
  const [orderNumber, setOrderNumber] = useState('');
  const [form, setForm] = useState({
    name: '', phone: '', email: '', address: 'Othany East, Seme', notes: ''
  });

  const sub = subtotal();
  const delivery = items.length > 0 ? 200 : 0;
  const total = sub + delivery;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (items.length === 0) { toast.error('Your cart is empty'); return; }
    setStep('paying');
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: form.name,
          customerPhone: form.phone.replace(/\D/g, '').replace(/^0/, '254').replace(/^(\+)?/, ''),
          customerEmail: form.email || null,
          deliveryAddress: form.address,
          notes: form.notes,
          items: items.map(i => ({ variantId: i.variantId, quantity: i.quantity }))
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setOrderNumber(data.order.orderNumber);

      // Trigger STK push
      const payRes = await fetch('/api/payments/mpesa/stk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: data.order.id })
      });
      const payData = await payRes.json();
      if (payData.stub) {
        toast.success('Order placed (M-Pesa stub mode — no real STK)');
      } else if (payRes.ok) {
        toast.success('STK push sent! Check your phone.');
      } else {
        toast.error(payData.error || 'Payment init failed — order saved');
      }

      clear();
      setStep('done');
    } catch (e: any) {
      toast.error(e.message);
      setStep('form');
    }
  }

  if (step === 'done') {
    return (
      <div className="px-4 py-16">
        <div className="max-w-lg mx-auto glass-strong rounded-3xl p-8 md:p-12 text-center space-y-5">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-400 to-green-600 mx-auto flex items-center justify-center">
            <CheckCircle2 className="w-10 h-10 text-white" />
          </div>
          <div>
            <h2 className="font-display text-2xl font-bold mb-1">Order placed!</h2>
            <p className="text-secondary text-sm">We've sent an STK push to your phone. Enter your M-Pesa PIN to complete payment.</p>
          </div>
          <div className="glass rounded-2xl p-4">
            <p className="text-[10px] uppercase tracking-wider text-muted mb-1">Order Number</p>
            <p className="font-mono font-bold text-primary text-lg">{orderNumber}</p>
          </div>
          <p className="text-xs text-muted">A receipt will be sent via WhatsApp/SMS once payment is confirmed.</p>
          <div className="grid grid-cols-2 gap-2">
            <Link href={`/receipt?order=${orderNumber}`} className="btn-glass text-sm">
              <Receipt className="w-4 h-4"/> View Receipt
            </Link>
            <Link href={`/track?order=${orderNumber}`} className="btn-primary text-sm">Track Order</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-16">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-10">
          <span className="section-label">Checkout</span>
          <h1 className="section-title">Almost <span className="gradient-text">there</span></h1>
        </div>

        {items.length === 0 ? (
          <div className="glass-strong rounded-3xl p-12 text-center">
            <p className="text-secondary mb-6">Your cart is empty.</p>
            <Link href="/shop" className="btn-primary">Browse Shop</Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-5">
            <form onSubmit={submit} className="glass-strong rounded-3xl p-6 space-y-4">
              <h3 className="font-display text-lg font-semibold mb-2">Delivery Details</h3>

              <div>
                <label className="text-[11px] uppercase tracking-wider text-muted mb-1.5 block">Name</label>
                <input className="input-glass" required value={form.name} onChange={e=>setForm({...form,name:e.target.value})} />
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wider text-muted mb-1.5 block">M-Pesa Phone</label>
                <input className="input-glass" required value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} placeholder="07XX XXX XXX" />
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wider text-muted mb-1.5 block">Email (optional)</label>
                <input type="email" className="input-glass" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="for emailed receipt" />
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wider text-muted mb-1.5 block">Delivery Address</label>
                <input className="input-glass" required value={form.address} onChange={e=>setForm({...form,address:e.target.value})} />
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wider text-muted mb-1.5 block">Notes (optional)</label>
                <textarea rows={2} className="input-glass resize-none" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} />
              </div>

              <button type="submit" disabled={step === 'paying'} className="btn-primary w-full">
                {step === 'paying' ? <><Loader2 className="w-4 h-4 animate-spin"/> Processing...</> : <><Smartphone className="w-4 h-4"/> Pay {fmtKsh(total)} via M-Pesa</>}
              </button>
            </form>

            <div className="glass-strong rounded-3xl p-6 space-y-4 h-fit">
              <h3 className="font-display text-lg font-semibold">Order Summary</h3>
              <div className="space-y-2 text-sm">
                {items.map(i => (
                  <div key={i.variantId} className="flex items-center justify-between text-secondary">
                    <span className="truncate pr-2">{i.productName} · {i.variantLabel} × {i.quantity}</span>
                    <span className="text-primary font-medium">{fmtKsh(i.priceKsh * i.quantity)}</span>
                  </div>
                ))}
              </div>
              <div className="pt-3 border-t border-[var(--border-color)] space-y-1.5 text-sm">
                <div className="flex justify-between text-secondary"><span>Subtotal</span><span>{fmtKsh(sub)}</span></div>
                <div className="flex justify-between text-secondary"><span>Delivery</span><span>{fmtKsh(delivery)}</span></div>
                <div className="flex justify-between font-bold text-base pt-2 border-t border-[var(--border-color)]">
                  <span>Total</span><span className="gradient-text">{fmtKsh(total)}</span>
                </div>
              </div>
              <p className="text-[11px] text-muted text-center">Secure payment via M-Pesa STK push</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
