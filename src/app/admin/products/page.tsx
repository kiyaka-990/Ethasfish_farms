'use client';
import { useEffect, useState } from 'react';
import { Loader2, Save, Trash2, Plus, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import MediaPicker from '@/components/admin/MediaPicker';

const emptyProduct = { name: '', slug: '', type2: 'whole', description: '', badge: '', imageUrl: '' };
const emptyVariant = { label: '', weight: '', perItem: '', priceKsh: 0, stock: 0 };

export default function AdminProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [newProduct, setNewProduct] = useState(emptyProduct);
  const [creatingProduct, setCreatingProduct] = useState(false);
  const [newVariant, setNewVariant] = useState<Record<string, any>>({});

  async function load() {
    setLoading(true);
    const res = await fetch('/api/admin/products');
    const data = await res.json();
    setProducts(data.products || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function saveProduct(p: any) {
    setSavingId(p.id);
    const res = await fetch('/api/admin/products', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'updateProduct', productId: p.id, name: p.name, description: p.description, badge: p.badge, active: p.active, imageUrl: p.imageUrl })
    });
    setSavingId(null);
    if (res.ok) toast.success('Product saved · chatbot updated');
    else toast.error('Failed to save');
  }

  async function deleteProduct(id: string) {
    if (!confirm('Delete this whole product, including all its sizes? This cannot be undone.')) return;
    const res = await fetch(`/api/admin/products?productId=${id}`, { method: 'DELETE' });
    if (res.ok) { toast.success('Product deleted'); load(); } else toast.error('Failed to delete');
  }

  async function createProduct() {
    if (!newProduct.name.trim()) return toast.error('Name required');
    setCreatingProduct(true);
    const slug = newProduct.slug.trim() || newProduct.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const res = await fetch('/api/admin/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'createProduct', ...newProduct, slug })
    });
    setCreatingProduct(false);
    if (res.ok) { toast.success('Product created'); setNewProduct(emptyProduct); load(); }
    else toast.error('Failed to create — slug may already exist');
  }

  async function saveVariant(v: any) {
    setSavingId(v.id);
    const res = await fetch('/api/admin/products', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'updateVariant', variantId: v.id, label: v.label, weight: v.weight, perItem: v.perItem, priceKsh: v.priceKsh, stock: v.stock, active: v.active })
    });
    setSavingId(null);
    if (res.ok) toast.success('Saved · chatbot updated');
    else toast.error('Save failed');
  }

  async function deleteVariant(id: string) {
    if (!confirm('Delete this size?')) return;
    const res = await fetch(`/api/admin/products?variantId=${id}`, { method: 'DELETE' });
    if (res.ok) { toast.success('Deleted'); load(); }
    else toast.error('Failed to delete');
  }

  async function addVariant(productId: string) {
    const draft = newVariant[productId] || emptyVariant;
    if (!draft.label || !draft.weight) return toast.error('Label and weight required');
    const res = await fetch('/api/admin/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'createVariant', productId, ...draft })
    });
    if (res.ok) { toast.success('Size added'); setNewVariant(nv => ({ ...nv, [productId]: emptyVariant })); load(); }
    else toast.error('Failed to add size');
  }

  function update(productId: string, variantId: string, key: string, value: any) {
    setProducts(ps => ps.map(p => p.id !== productId ? p : ({
      ...p, variants: p.variants.map((v: any) => v.id !== variantId ? v : { ...v, [key]: value })
    })));
  }
  function updateProductField(productId: string, key: string, value: any) {
    setProducts(ps => ps.map(p => p.id !== productId ? p : { ...p, [key]: value }));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-primary">Products & Pricing</h1>
        <p className="text-sm text-muted mt-1 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-[var(--accent)]" />
          Updates here are picked up by the AI sales agent instantly
        </p>
      </div>

      <div className="glass-strong rounded-3xl p-6 space-y-3">
        <h2 className="font-semibold text-primary">Add new product</h2>
        <div className="grid md:grid-cols-4 gap-3">
          <input className="input-glass" placeholder="Name (e.g. Smoked Tilapia)" value={newProduct.name} onChange={e => setNewProduct({ ...newProduct, name: e.target.value })} />
          <select className="input-glass" value={newProduct.type2} onChange={e => setNewProduct({ ...newProduct, type2: e.target.value })}>
            <option value="whole">Whole</option>
            <option value="fillet">Fillet</option>
            <option value="fingerling">Fingerling</option>
            <option value="feed">Feed</option>
            <option value="consultancy">Consultancy</option>
          </select>
          <input className="input-glass" placeholder="Badge (e.g. New)" value={newProduct.badge} onChange={e => setNewProduct({ ...newProduct, badge: e.target.value })} />
          <button onClick={createProduct} disabled={creatingProduct} className="btn-primary">
            {creatingProduct ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Create
          </button>
        </div>
        <textarea className="input-glass resize-none" rows={2} placeholder="Description" value={newProduct.description} onChange={e => setNewProduct({ ...newProduct, description: e.target.value })} />
        <MediaPicker accept="image" onPick={url => setNewProduct({ ...newProduct, imageUrl: url })} />
        {newProduct.imageUrl && <p className="text-[11px] text-muted truncate">Image: {newProduct.imageUrl}</p>}
      </div>

      {loading ? (
        <div className="glass rounded-3xl p-12 text-center"><Loader2 className="w-6 h-6 animate-spin text-[var(--accent)] mx-auto" /></div>
      ) : (
        <div className="space-y-6">
          {products.map(p => (
            <div key={p.id} className="glass-strong rounded-3xl p-6">
              <div className="flex items-start justify-between gap-4 mb-5">
                <div className="flex-1 grid md:grid-cols-[120px_1fr] gap-4">
                  <div className="space-y-2">
                    {p.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.imageUrl} alt="" className="w-full h-20 object-cover rounded-xl" />
                    )}
                    <MediaPicker accept="image" onPick={url => updateProductField(p.id, 'imageUrl', url)} />
                  </div>
                  <div className="space-y-2">
                    <input className="input-glass !py-2 font-display font-bold" value={p.name} onChange={e => updateProductField(p.id, 'name', e.target.value)} />
                    <textarea className="input-glass !py-2 text-sm resize-none" rows={2} value={p.description} onChange={e => updateProductField(p.id, 'description', e.target.value)} />
                    <div className="flex items-center gap-2 flex-wrap">
                      <input className="input-glass !py-1.5 text-xs w-32" placeholder="Badge" value={p.badge || ''} onChange={e => updateProductField(p.id, 'badge', e.target.value)} />
                      <span className="text-[10px] uppercase tracking-wider text-muted">{p.type}</span>
                      <label className="flex items-center gap-1.5 text-xs text-secondary ml-auto">
                        <input type="checkbox" checked={p.active} onChange={e => updateProductField(p.id, 'active', e.target.checked)} /> Active
                      </label>
                      <button onClick={() => saveProduct(p)} disabled={savingId === p.id} className="btn-primary !py-1.5 !px-3 text-xs">
                        {savingId === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save
                      </button>
                      <button onClick={() => deleteProduct(p.id)} className="p-1.5 rounded-lg text-red-500/60 hover:text-red-600 hover:bg-red-500/10">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
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

                <div className="glass-soft rounded-2xl p-4 grid sm:grid-cols-12 gap-3 items-end border border-dashed border-[var(--border-color)]">
                  <div className="sm:col-span-2">
                    <input className="input-glass !py-2 text-sm" placeholder="Label" value={newVariant[p.id]?.label || ''} onChange={e => setNewVariant(nv => ({ ...nv, [p.id]: { ...(nv[p.id] || emptyVariant), label: e.target.value } }))} />
                  </div>
                  <div className="sm:col-span-2">
                    <input className="input-glass !py-2 text-sm" placeholder="Weight" value={newVariant[p.id]?.weight || ''} onChange={e => setNewVariant(nv => ({ ...nv, [p.id]: { ...(nv[p.id] || emptyVariant), weight: e.target.value } }))} />
                  </div>
                  <div className="sm:col-span-3">
                    <input className="input-glass !py-2 text-sm" placeholder="Per item note" value={newVariant[p.id]?.perItem || ''} onChange={e => setNewVariant(nv => ({ ...nv, [p.id]: { ...(nv[p.id] || emptyVariant), perItem: e.target.value } }))} />
                  </div>
                  <div className="sm:col-span-2">
                    <input type="number" className="input-glass !py-2 text-sm" placeholder="Price" value={newVariant[p.id]?.priceKsh || ''} onChange={e => setNewVariant(nv => ({ ...nv, [p.id]: { ...(nv[p.id] || emptyVariant), priceKsh: parseInt(e.target.value, 10) || 0 } }))} />
                  </div>
                  <div className="sm:col-span-1">
                    <input type="number" className="input-glass !py-2 text-sm" placeholder="Stock" value={newVariant[p.id]?.stock || ''} onChange={e => setNewVariant(nv => ({ ...nv, [p.id]: { ...(nv[p.id] || emptyVariant), stock: parseInt(e.target.value, 10) || 0 } }))} />
                  </div>
                  <div className="sm:col-span-2">
                    <button onClick={() => addVariant(p.id)} className="btn-glass !py-2 text-xs w-full">
                      <Plus className="w-3.5 h-3.5" /> Add Size
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
