'use client';
import { useEffect, useState } from 'react';
import { Loader2, Plus, Trash2, Truck, Building2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { fmtKsh } from '@/lib/utils';

interface Supplier { id: string; name: string; contactName: string | null; phone: string | null; email: string | null; category: string; }
interface POItem { description: string; quantity: number; unitCost: number; }
interface PurchaseOrder {
  id: string; poNumber: string; status: string; totalCost: number; expectedDate: string | null; createdAt: string;
  supplier: Supplier; items: (POItem & { id: string; lineTotal: number })[];
}

const supplierCategories = ['feed', 'equipment', 'fingerlings', 'other'];
const poStatuses = ['draft', 'ordered', 'received', 'cancelled'];
const statusColor: Record<string, string> = { draft: 'text-muted', ordered: 'text-[var(--accent)]', received: 'text-green-600', cancelled: 'text-red-500' };
const emptyItem: POItem = { description: '', quantity: 1, unitCost: 0 };

export default function AdminPurchasingPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingPo, setSavingPo] = useState<string | null>(null);

  const [supName, setSupName] = useState('');
  const [supContact, setSupContact] = useState('');
  const [supPhone, setSupPhone] = useState('');
  const [supCategory, setSupCategory] = useState('feed');
  const [addingSupplier, setAddingSupplier] = useState(false);

  const [supplierId, setSupplierId] = useState('');
  const [poItems, setPoItems] = useState<POItem[]>([{ ...emptyItem }]);
  const [expectedDate, setExpectedDate] = useState('');
  const [creatingPo, setCreatingPo] = useState(false);

  async function load() {
    setLoading(true);
    const [supRes, poRes] = await Promise.all([fetch('/api/admin/suppliers'), fetch('/api/admin/purchase-orders')]);
    setSuppliers((await supRes.json()).suppliers || []);
    setPos((await poRes.json()).purchaseOrders || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function addSupplier() {
    if (!supName.trim()) return toast.error('Supplier name required');
    setAddingSupplier(true);
    const res = await fetch('/api/admin/suppliers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: supName, contactName: supContact, phone: supPhone, category: supCategory })
    });
    setAddingSupplier(false);
    if (res.ok) { toast.success('Supplier added'); setSupName(''); setSupContact(''); setSupPhone(''); load(); }
    else toast.error('Failed to add supplier');
  }

  function updatePoItem(i: number, patch: Partial<POItem>) {
    setPoItems(its => its.map((it, idx) => idx === i ? { ...it, ...patch } : it));
  }
  function addPoItem() { setPoItems(its => [...its, { ...emptyItem }]); }
  function removePoItem(i: number) { setPoItems(its => its.filter((_, idx) => idx !== i)); }

  const poTotal = poItems.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.unitCost) || 0), 0);

  async function createPo() {
    if (!supplierId) return toast.error('Choose a supplier');
    if (poItems.some(it => !it.description.trim())) return toast.error('Item descriptions required');
    setCreatingPo(true);
    const res = await fetch('/api/admin/purchase-orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ supplierId, items: poItems, expectedDate: expectedDate || null })
    });
    setCreatingPo(false);
    if (res.ok) {
      toast.success('Purchase order created');
      setSupplierId(''); setPoItems([{ ...emptyItem }]); setExpectedDate('');
      load();
    } else toast.error('Failed to create PO');
  }

  async function setPoStatus(id: string, status: string) {
    setSavingPo(id);
    const res = await fetch('/api/admin/purchase-orders', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) });
    setSavingPo(null);
    if (res.ok) { toast.success(`Marked ${status}`); load(); } else toast.error('Failed');
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-primary flex items-center gap-2">
          <Truck className="w-6 h-6 text-[var(--accent)]" /> Purchasing
        </h1>
        <p className="text-sm text-muted mt-1">Suppliers and purchase orders — feed, equipment, fingerlings.</p>
      </div>

      <div className="glass-strong rounded-3xl p-6 space-y-3">
        <h2 className="font-semibold text-primary flex items-center gap-2"><Building2 className="w-4 h-4" /> Suppliers</h2>
        <div className="grid md:grid-cols-4 gap-3">
          <input className="input-glass" placeholder="Supplier name" value={supName} onChange={e => setSupName(e.target.value)} />
          <input className="input-glass" placeholder="Contact person" value={supContact} onChange={e => setSupContact(e.target.value)} />
          <input className="input-glass" placeholder="Phone" value={supPhone} onChange={e => setSupPhone(e.target.value)} />
          <select className="input-glass" value={supCategory} onChange={e => setSupCategory(e.target.value)}>
            {supplierCategories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <button onClick={addSupplier} disabled={addingSupplier} className="btn-primary !py-2 text-sm">
          {addingSupplier ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add Supplier
        </button>

        {suppliers.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2">
            {suppliers.map(s => (
              <span key={s.id} className="badge !text-[11px]">{s.name} · {s.category}</span>
            ))}
          </div>
        )}
      </div>

      <div className="glass-strong rounded-3xl p-6 space-y-3">
        <h2 className="font-semibold text-primary">New Purchase Order</h2>
        <select className="input-glass" value={supplierId} onChange={e => setSupplierId(e.target.value)}>
          <option value="">Select supplier</option>
          {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>

        <div className="space-y-2">
          {poItems.map((it, i) => (
            <div key={i} className="grid grid-cols-[1fr_80px_110px_auto] gap-2 items-center">
              <input className="input-glass !py-2 text-sm" placeholder="Description" value={it.description} onChange={e => updatePoItem(i, { description: e.target.value })} />
              <input type="number" min={1} className="input-glass !py-2 text-sm" placeholder="Qty" value={it.quantity} onChange={e => updatePoItem(i, { quantity: Number(e.target.value) })} />
              <input type="number" min={0} className="input-glass !py-2 text-sm" placeholder="Unit cost" value={it.unitCost} onChange={e => updatePoItem(i, { unitCost: Number(e.target.value) })} />
              <button onClick={() => removePoItem(i)} className="p-2 text-red-500/80 hover:text-red-500" aria-label="Remove item"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
          <button onClick={addPoItem} className="btn-glass !py-1.5 !px-3 text-xs"><Plus className="w-3.5 h-3.5" /> Add line item</button>
        </div>

        <div className="flex items-center gap-3">
          <label className="text-sm text-secondary flex items-center gap-2">Expected date
            <input type="date" className="input-glass !w-auto !py-1.5 text-sm" value={expectedDate} onChange={e => setExpectedDate(e.target.value)} />
          </label>
          <p className="ml-auto font-display text-xl font-bold text-primary">{fmtKsh(poTotal)}</p>
        </div>

        <button onClick={createPo} disabled={creatingPo} className="btn-primary">
          {creatingPo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Create Purchase Order
        </button>
      </div>

      {loading ? (
        <div className="glass rounded-3xl p-12 text-center"><Loader2 className="w-6 h-6 animate-spin text-[var(--accent)] mx-auto" /></div>
      ) : pos.length === 0 ? (
        <div className="glass rounded-3xl p-12 text-center text-muted text-sm">No purchase orders yet.</div>
      ) : (
        <div className="space-y-3">
          {pos.map(po => (
            <div key={po.id} className="glass rounded-2xl p-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-primary font-mono text-sm">{po.poNumber}</p>
                <p className="text-xs text-secondary">{po.supplier.name} · {po.items.length} item{po.items.length !== 1 ? 's' : ''} · {new Date(po.createdAt).toLocaleDateString()}</p>
              </div>
              <div className="text-right">
                <p className="font-display font-bold text-primary">{fmtKsh(po.totalCost)}</p>
                <select
                  value={po.status}
                  disabled={savingPo === po.id}
                  onChange={e => setPoStatus(po.id, e.target.value)}
                  className={`input-glass !w-auto !py-1 !px-2 text-xs font-semibold ${statusColor[po.status] || ''}`}
                >
                  {poStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
