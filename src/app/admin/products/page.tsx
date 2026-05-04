'use client';
import { useEffect, useState } from 'react';
import { Loader2, Save, Trash2, Plus, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { fmtKsh } from '@/lib/utils';

export default function AdminProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch('/api/admin/products');
    const data = await res.json();
    setProducts(data.products || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function saveVariant(v: any) {
    setSavingId(v.id);
    try {
      const res = await fetch('/api/admin/products', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'updateVariant',
          variantId: v.id,
          label: v.label,
          weight: v.weight,
          perItem: v.perItem,
          priceKsh: v.priceKsh,
          stock: v.stock,
          active: v.active
        })
      });
      if (!res.ok) throw new Error('Save failed');
      toast.success('Saved · chatbot updated');
    } catch (e: any) {
      toast.error(e.message);
    } finally { setSavingId(null); }
  }

  async function deleteVariant(id: string) {
    if (!confirm('Delete this size?')) return;
    const res = await fetch(`/api/admin/products?variantId=${id}`, { method: 'DELETE' });
    if (res.ok) { toast.success('Deleted'); load(); }
    else toast.error('Failed to delete');
  }

  function update(productId: string, variantId: string, key: string, value: any) {
    setProducts(ps => ps.map(p => p.id !== productId ? p : ({
      ...p, variants: p.variants.map((v: any) => v.id !== variantId ? v : { ...v, [key]: value })
    })));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-primary">Products & Pricing</h1>
        <p className="text-sm text-muted mt-1 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-[var(--accent)]" />
          Updates here are picked up by the AI chatbot within 30 seconds
        </p>
      </div>

      {loading ? (
        <div className="glass rounded-3xl p-12 text-center"><Loader2 className="w-6 h-6 animate-spin text-[var(--accent)] mx-auto" /></div>
      ) : (
        <div className="space-y-6">
          {products.map(p => (
            <div key={p.id} className="glass-strong rounded-3xl p-6">
              <div className="flex items-start justify-between mb-5">
                <div>
                  <h2 className="font-display text-xl font-bold text-primary">{p.name}</h2>
                  <p className="text-sm text-secondary max-w-xl mt-1">{p.description}</p>
                  <div className="flex items-center gap-2 mt-2">
                    {p.badge && <span className="badge !text-[10px]">{p.badge}</span>}
                    <span className="text-[10px] uppercase tracking-wider text-muted">{p.type}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                {p.variants.map((v: any) => (
                  <div key={v.id} className="glass rounded-2xl p-4 grid sm:grid-cols-12 gap-3 items-end">
                    <div className="sm:col-span-2">
                      <label className="text-[10px] uppercase tracking-wider text-muted mb-1 block">Label</label>
                      <input className="input-glass !py-2 text-sm" value={v.label} onChange={e => update(p.id, v.id, 'label', e.target.value)} />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-[10px] uppercase tracking-wider text-muted mb-1 block">Weight</label>
                      <input className="input-glass !py-2 text-sm" value={v.weight} onChange={e => update(p.id, v.id, 'weight', e.target.value)} />
                    </div>
                    <div className="sm:col-span-3">
                      <label className="text-[10px] uppercase tracking-wider text-muted mb-1 block">Per item note</label>
                      <input className="input-glass !py-2 text-sm" value={v.perItem || ''} onChange={e => update(p.id, v.id, 'perItem', e.target.value)} />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-[10px] uppercase tracking-wider text-[var(--accent)] mb-1 block">Price (KSh)</label>
                      <input type="number" className="input-glass !py-2 text-sm font-semibold" value={v.priceKsh} onChange={e => update(p.id, v.id, 'priceKsh', parseInt(e.target.value, 10) || 0)} />
                    </div>
                    <div className="sm:col-span-1">
                      <label className="text-[10px] uppercase tracking-wider text-muted mb-1 block">Stock</label>
                      <input type="number" className="input-glass !py-2 text-sm" value={v.stock} onChange={e => update(p.id, v.id, 'stock', parseInt(e.target.value, 10) || 0)} />
                    </div>
                    <div className="sm:col-span-2 flex gap-1">
                      <button onClick={() => saveVariant(v)} disabled={savingId === v.id} className="btn-primary !py-2 !px-3 text-xs flex-1">
                        {savingId === v.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        Save
                      </button>
                      <button onClick={() => deleteVariant(v.id)} className="p-2 rounded-xl text-red-500/60 hover:text-red-600 hover:bg-red-500/10 transition">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
