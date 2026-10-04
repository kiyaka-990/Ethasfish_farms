'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Plus, Minus, X, Loader2, Banknote, Smartphone, Printer, ReceiptText, ShoppingCart } from 'lucide-react';
import toast from 'react-hot-toast';
import { fmtKsh } from '@/lib/utils';
import PosAssistant from './PosAssistant';
import InstallPosButton from './InstallPosButton';

interface Variant { id: string; label: string; weight: string; priceKsh: number; stock: number; active: boolean; }
interface Product { id: string; name: string; type: string; imageUrl?: string | null; active: boolean; variants: Variant[]; }
interface CartLine { variantId: string; productId: string; productName: string; variantLabel: string; unitPrice: number; quantity: number; maxStock: number; }

const QUICK_CASH = [500, 1000, 2000, 5000];

export default function PosClient() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [method, setMethod] = useState<'cash' | 'mpesa'>('cash');
  const [cashReceived, setCashReceived] = useState('');
  const [mpesaRef, setMpesaRef] = useState('');
  const [showCustomer, setShowCustomer] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<{ text: string; orderNumber: string } | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/admin/products')
      .then(r => r.json())
      .then(d => setProducts((d.products || []).filter((p: Product) => p.active)))
      .finally(() => setLoading(false));

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/pos-sw.js', { scope: '/admin/pos/' }).catch(() => {});
    }
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    // Quote-based items (priceKsh 0, e.g. consultancy) aren't ring-up-able
    // at a till - they're handled as a follow-up, not a cash sale.
    const sellable = products
      .map(p => ({ ...p, variants: p.variants.filter(v => v.priceKsh > 0) }))
      .filter(p => p.variants.length > 0);
    if (!q) return sellable;
    return sellable.filter(p => p.name.toLowerCase().includes(q));
  }, [products, query]);

  const total = useMemo(() => cart.reduce((s, l) => s + l.unitPrice * l.quantity, 0), [cart]);
  const change = method === 'cash' ? Math.max(0, (Number(cashReceived) || 0) - total) : 0;
  const cashShort = method === 'cash' && (Number(cashReceived) || 0) < total;

  function addToCart(product: Product, variant: Variant) {
    if (variant.stock <= 0) return toast.error('Out of stock');
    setCart(prev => {
      const existing = prev.find(l => l.variantId === variant.id);
      if (existing) {
        if (existing.quantity >= variant.stock) { toast.error('No more stock available'); return prev; }
        return prev.map(l => l.variantId === variant.id ? { ...l, quantity: l.quantity + 1 } : l);
      }
      return [...prev, { variantId: variant.id, productId: product.id, productName: product.name, variantLabel: `${variant.label} (${variant.weight})`, unitPrice: variant.priceKsh, quantity: 1, maxStock: variant.stock }];
    });
  }

  function changeQty(variantId: string, delta: number) {
    setCart(prev => prev
      .map(l => {
        if (l.variantId !== variantId) return l;
        const q = l.quantity + delta;
        if (q > l.maxStock) { toast.error('No more stock available'); return l; }
        return { ...l, quantity: q };
      })
      .filter(l => l.quantity > 0));
  }

  function removeLine(variantId: string) {
    setCart(prev => prev.filter(l => l.variantId !== variantId));
  }

  function resetSale() {
    setCart([]);
    setCheckoutOpen(false);
    setMethod('cash');
    setCashReceived('');
    setMpesaRef('');
    setShowCustomer(false);
    setCustomerName('');
    setCustomerPhone('');
    setReceipt(null);
  }

  async function completeSale() {
    if (cart.length === 0) return;
    if (method === 'mpesa' && !mpesaRef.trim()) return toast.error('Enter the M-Pesa reference code');
    if (cashShort) return toast.error('Cash received is less than the total');

    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/pos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: cart.map(l => ({ variantId: l.variantId, quantity: l.quantity })),
          paymentMethod: method,
          cashReceived: method === 'cash' ? Number(cashReceived) : undefined,
          mpesaRef: method === 'mpesa' ? mpesaRef.trim() : undefined,
          customerName: customerName.trim() || undefined,
          customerPhone: customerPhone.trim() || undefined
        })
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Sale failed'); return; }
      setReceipt({ text: data.receiptText, orderNumber: data.order.orderNumber });
      toast.success('Sale complete');
      fetch('/api/admin/products').then(r => r.json()).then(d => setProducts((d.products || []).filter((p: Product) => p.active)));
    } catch {
      toast.error('Connection issue - try again');
    } finally {
      setSubmitting(false);
    }
  }

  function printReceipt() {
    const w = window.open('', '_blank', 'width=380,height=640');
    if (!w) return;
    w.document.write(`<pre style="font-family:monospace;font-size:13px;white-space:pre-wrap;padding:16px;">${receipt?.text.replace(/</g, '&lt;')}</pre>`);
    w.document.close();
    w.focus();
    w.print();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="font-display text-3xl font-bold text-primary flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-[var(--accent)]" /> Point of Sale
          </h1>
          <InstallPosButton />
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search products..."
            className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-[var(--border-color)] bg-transparent text-primary placeholder:text-muted outline-none focus:border-[var(--accent)]"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {loading && <p className="text-muted text-sm col-span-2">Loading products...</p>}
          {!loading && filtered.length === 0 && <p className="text-muted text-sm col-span-2">No products match.</p>}
          {filtered.map(p => (
            <div key={p.id} className="glass-soft rounded-2xl p-4">
              <p className="font-semibold text-primary text-sm mb-2.5">{p.name}</p>
              <div className="flex flex-wrap gap-1.5">
                {p.variants.filter(v => v.active).map(v => (
                  <button
                    key={v.id}
                    onClick={() => addToCart(p, v)}
                    disabled={v.stock <= 0}
                    className="px-2.5 py-1.5 rounded-lg text-xs border border-[var(--border-color)] hover:border-[var(--accent)] hover:bg-[var(--accent)]/5 disabled:opacity-35 disabled:cursor-not-allowed transition-colors text-left"
                    title={v.stock <= 0 ? 'Out of stock' : `${v.stock} in stock`}
                  >
                    <span className="text-secondary">{v.label}</span>{' '}
                    <span className="font-semibold text-primary">{fmtKsh(v.priceKsh)}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="glass-strong rounded-2xl p-5 sticky top-8">
          <p className="font-display font-bold text-lg text-primary mb-4">Current Sale</p>
          {cart.length === 0 ? (
            <p className="text-muted text-sm">Tap a product to add it.</p>
          ) : (
            <div className="space-y-3 mb-4 max-h-[42vh] overflow-y-auto">
              {cart.map(l => (
                <div key={l.variantId} className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-primary truncate">{l.productName}</p>
                    <p className="text-[11px] text-muted">{l.variantLabel} · {fmtKsh(l.unitPrice)}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => changeQty(l.variantId, -1)} className="w-6 h-6 rounded-md border border-[var(--border-color)] flex items-center justify-center hover:bg-[var(--surface)]"><Minus className="w-3 h-3" /></button>
                    <span className="text-sm text-primary w-5 text-center">{l.quantity}</span>
                    <button onClick={() => changeQty(l.variantId, 1)} className="w-6 h-6 rounded-md border border-[var(--border-color)] flex items-center justify-center hover:bg-[var(--surface)]"><Plus className="w-3 h-3" /></button>
                    <button onClick={() => removeLine(l.variantId)} className="w-6 h-6 rounded-md flex items-center justify-center text-muted hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="border-t border-[var(--border-color)] pt-3 flex items-center justify-between mb-4">
            <span className="text-secondary text-sm">Total</span>
            <span className="font-display font-bold text-xl text-primary">{fmtKsh(total)}</span>
          </div>
          <button
            onClick={() => setCheckoutOpen(true)}
            disabled={cart.length === 0}
            className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-br from-[var(--accent-light)] to-[var(--accent)] disabled:opacity-40 shadow-sm"
          >
            Charge {fmtKsh(total)}
          </button>
        </div>
      </div>

      {checkoutOpen && !receipt && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4">
          <div className="glass-strong rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <p className="font-display font-bold text-lg text-primary">Take Payment · {fmtKsh(total)}</p>
              <button onClick={() => setCheckoutOpen(false)} className="text-muted hover:text-primary"><X className="w-5 h-5" /></button>
            </div>

            <div className="flex gap-2 mb-4">
              <button onClick={() => setMethod('cash')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border transition-colors ${method === 'cash' ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]' : 'border-[var(--border-color)] text-secondary'}`}>
                <Banknote className="w-4 h-4" /> Cash
              </button>
              <button onClick={() => setMethod('mpesa')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border transition-colors ${method === 'mpesa' ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]' : 'border-[var(--border-color)] text-secondary'}`}>
                <Smartphone className="w-4 h-4" /> M-Pesa
              </button>
            </div>

            {method === 'cash' ? (
              <div className="space-y-3 mb-4">
                <input
                  type="number"
                  value={cashReceived}
                  onChange={e => setCashReceived(e.target.value)}
                  placeholder="Amount received"
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[var(--border-color)] bg-transparent text-primary outline-none focus:border-[var(--accent)]"
                />
                <div className="flex gap-1.5 flex-wrap">
                  {QUICK_CASH.map(n => (
                    <button key={n} onClick={() => setCashReceived(String(n))} className="px-2.5 py-1 rounded-full text-xs border border-[var(--border-color)] hover:border-[var(--accent)] text-secondary">{fmtKsh(n)}</button>
                  ))}
                  <button onClick={() => setCashReceived(String(total))} className="px-2.5 py-1 rounded-full text-xs border border-[var(--border-color)] hover:border-[var(--accent)] text-secondary">Exact</button>
                </div>
                {cashReceived && (
                  <p className={`text-sm ${cashShort ? 'text-red-500' : 'text-secondary'}`}>
                    {cashShort ? 'Short by ' + fmtKsh(total - Number(cashReceived)) : 'Change due: ' + fmtKsh(change)}
                  </p>
                )}
              </div>
            ) : (
              <div className="mb-4">
                <input
                  value={mpesaRef}
                  onChange={e => setMpesaRef(e.target.value.toUpperCase())}
                  placeholder="M-Pesa reference e.g. QFT7XXXXX"
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[var(--border-color)] bg-transparent text-primary outline-none focus:border-[var(--accent)]"
                />
                <p className="text-[11px] text-muted mt-1.5">Ask the customer to show the confirmation SMS from paying your till, then enter the reference code here.</p>
              </div>
            )}

            <button onClick={() => setShowCustomer(v => !v)} className="text-xs text-[var(--accent)] mb-3">
              {showCustomer ? 'Hide' : '+ Add'} customer details (optional)
            </button>
            {showCustomer && (
              <div className="space-y-2 mb-4">
                <input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Customer name" className="w-full px-3.5 py-2 text-sm rounded-xl border border-[var(--border-color)] bg-transparent text-primary outline-none focus:border-[var(--accent)]" />
                <input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} placeholder="Phone (07... )" className="w-full px-3.5 py-2 text-sm rounded-xl border border-[var(--border-color)] bg-transparent text-primary outline-none focus:border-[var(--accent)]" />
              </div>
            )}

            <button
              onClick={completeSale}
              disabled={submitting || (method === 'cash' && cashShort) || (method === 'mpesa' && !mpesaRef.trim())}
              className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-br from-[var(--accent-light)] to-[var(--accent)] disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ReceiptText className="w-4 h-4" />}
              Complete Sale
            </button>
          </div>
        </div>
      )}

      {receipt && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4">
          <div className="glass-strong rounded-2xl p-6 w-full max-w-sm max-h-[90vh] overflow-y-auto">
            <p className="font-display font-bold text-lg text-primary mb-1">Sale Complete</p>
            <p className="text-xs text-muted mb-4">{receipt.orderNumber}</p>
            <div ref={printRef} className="bg-[var(--surface)] rounded-xl p-4 mb-4">
              <pre className="text-[11.5px] whitespace-pre-wrap text-primary font-mono">{receipt.text}</pre>
            </div>
            <div className="flex gap-2">
              <button onClick={printReceipt} className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-[var(--border-color)] text-secondary hover:bg-[var(--surface)] flex items-center justify-center gap-2">
                <Printer className="w-4 h-4" /> Print
              </button>
              <button onClick={resetSale} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-br from-[var(--accent-light)] to-[var(--accent)]">
                New Sale
              </button>
            </div>
          </div>
        </div>
      )}

      <PosAssistant />
    </div>
  );
}
