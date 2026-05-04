'use client';
import { X, Plus, Minus, ShoppingBag, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useCart } from '@/lib/cart-store';
import { fmtKsh } from '@/lib/utils';

export default function CartDrawer() {
  const { items, isOpen, close, setQty, remove, subtotal } = useCart();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const sub = subtotal();
  const delivery = items.length > 0 ? 200 : 0;
  const total = sub + delivery;

  return (
    <>
      <div
        className={`fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={close}
      />
      <aside
        className={`fixed top-0 right-0 bottom-0 z-[70] w-full sm:w-[420px] flex flex-col transition-transform duration-500 ease-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex flex-col h-full glass-strong border-l border-[var(--border-color)]">
          <div className="flex items-center justify-between p-6 border-b border-[var(--border-color)]">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-[var(--accent)]" />
              <h3 className="font-display text-xl font-semibold text-primary">Your Cart</h3>
              {items.length > 0 && <span className="badge !py-0.5 !text-[10px]">{items.length} items</span>}
            </div>
            <button onClick={close} className="p-2 rounded-xl hover:bg-[var(--surface)] text-secondary" aria-label="Close cart">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {items.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center">
                <div className="w-20 h-20 rounded-2xl glass flex items-center justify-center mb-4">
                  <ShoppingBag className="w-8 h-8 text-muted" />
                </div>
                <p className="text-secondary mb-4">Your cart is empty</p>
                <Link href="/shop" onClick={close} className="btn-primary text-sm">Browse Fresh Fish</Link>
              </div>
            ) : (
              <div className="space-y-3">
                {items.map(item => (
                  <div key={item.variantId} className="glass rounded-2xl p-4 group">
                    <div className="flex items-start gap-3">
                      <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[var(--accent-soft)]/30 to-[var(--accent)]/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-2xl">🐟</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-primary text-sm truncate">{item.productName}</p>
                        <p className="text-xs text-muted">{item.variantLabel} · {item.weight}</p>
                        <div className="flex items-center justify-between mt-3">
                          <div className="flex items-center gap-1 glass rounded-lg p-0.5">
                            <button onClick={() => setQty(item.variantId, item.quantity - 1)} className="w-7 h-7 rounded-md hover:bg-[var(--surface-strong)] flex items-center justify-center text-secondary" aria-label="Decrease">
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="w-7 text-center text-sm font-medium text-primary">{item.quantity}</span>
                            <button onClick={() => setQty(item.variantId, item.quantity + 1)} className="w-7 h-7 rounded-md hover:bg-[var(--surface-strong)] flex items-center justify-center text-secondary" aria-label="Increase">
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <p className="font-semibold text-[var(--accent)]">{fmtKsh(item.priceKsh * item.quantity)}</p>
                        </div>
                      </div>
                      <button onClick={() => remove(item.variantId)} className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-muted hover:text-red-500" aria-label="Remove">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {items.length > 0 && (
            <div className="p-6 border-t border-[var(--border-color)] space-y-4">
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between text-secondary"><span>Subtotal</span><span>{fmtKsh(sub)}</span></div>
                <div className="flex justify-between text-secondary"><span>Delivery</span><span>{fmtKsh(delivery)}</span></div>
                <div className="flex justify-between font-semibold text-base text-primary pt-2 border-t border-[var(--border-color)]">
                  <span>Total</span><span className="gradient-text">{fmtKsh(total)}</span>
                </div>
              </div>
              <Link href="/order" onClick={close} className="btn-primary w-full">
                Checkout · Pay with M-Pesa
              </Link>
              <p className="text-center text-[11px] text-muted">Secure payment via M-Pesa STK push</p>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
