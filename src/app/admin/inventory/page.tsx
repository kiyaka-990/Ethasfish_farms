'use client';
import { useEffect, useState } from 'react';
import { Loader2, Plus, Boxes, ArrowDownCircle, ArrowUpCircle, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { fmtKsh } from '@/lib/utils';

interface Movement { id: string; type: string; quantity: number; reason: string | null; createdAt: string; }
interface Item {
  id: string; name: string; category: string; unit: string; quantity: number; reorderLevel: number; costPerUnit: number;
  movements: Movement[];
}

const categories = ['feed', 'supplies', 'equipment', 'other'];

export default function AdminInventoryPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [moveFor, setMoveFor] = useState<string | null>(null);
  const [moveQty, setMoveQty] = useState('');
  const [moveReason, setMoveReason] = useState('');
  const [moveType, setMoveType] = useState<'in' | 'out'>('in');

  const [name, setName] = useState('');
  const [category, setCategory] = useState('feed');
  const [unit, setUnit] = useState('kg');
  const [quantity, setQuantity] = useState(0);
  const [reorderLevel, setReorderLevel] = useState(0);
  const [costPerUnit, setCostPerUnit] = useState(0);

  async function load() {
    setLoading(true);
    const res = await fetch('/api/admin/inventory');
    const data = await res.json();
    setItems(data.items || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function create() {
    if (!name.trim() || !unit.trim()) return toast.error('Name and unit are required');
    setCreating(true);
    const res = await fetch('/api/admin/inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, category, unit, quantity, reorderLevel, costPerUnit })
    });
    setCreating(false);
    if (res.ok) {
      toast.success('Item added');
      setName(''); setQuantity(0); setReorderLevel(0); setCostPerUnit(0);
      load();
    } else toast.error('Failed to add item');
  }

  async function recordMovement(itemId: string) {
    const qty = Number(moveQty);
    if (!qty || qty <= 0) return toast.error('Enter a quantity');
    const res = await fetch('/api/admin/inventory/movements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId, type: moveType, quantity: qty, reason: moveReason || null })
    });
    if (res.ok) {
      toast.success('Movement recorded');
      setMoveFor(null); setMoveQty(''); setMoveReason('');
      load();
    } else toast.error('Failed');
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-primary flex items-center gap-2">
          <Boxes className="w-6 h-6 text-[var(--accent)]" /> Inventory
        </h1>
        <p className="text-sm text-muted mt-1">Feed, supplies, and equipment — separate from shop product stock.</p>
      </div>

      <div className="glass-strong rounded-3xl p-6 space-y-3">
        <h2 className="font-semibold text-primary">Add Item</h2>
        <div className="grid md:grid-cols-3 gap-3">
          <input className="input-glass" placeholder="Name (e.g. 'Grower pellets 25%')" value={name} onChange={e => setName(e.target.value)} />
          <select className="input-glass" value={category} onChange={e => setCategory(e.target.value)}>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input className="input-glass" placeholder="Unit (kg, bag, litre, piece)" value={unit} onChange={e => setUnit(e.target.value)} />
          <input type="number" className="input-glass" placeholder="Starting quantity" value={quantity} onChange={e => setQuantity(Number(e.target.value))} />
          <input type="number" className="input-glass" placeholder="Reorder level" value={reorderLevel} onChange={e => setReorderLevel(Number(e.target.value))} />
          <input type="number" className="input-glass" placeholder="Cost per unit (KSh)" value={costPerUnit} onChange={e => setCostPerUnit(Number(e.target.value))} />
        </div>
        <button onClick={create} disabled={creating} className="btn-primary">
          {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add Item
        </button>
      </div>

      {loading ? (
        <div className="glass rounded-3xl p-12 text-center"><Loader2 className="w-6 h-6 animate-spin text-[var(--accent)] mx-auto" /></div>
      ) : items.length === 0 ? (
        <div className="glass rounded-3xl p-12 text-center text-muted text-sm">No inventory items yet.</div>
      ) : (
        <div className="space-y-3">
          {items.map(it => {
            const low = it.quantity <= it.reorderLevel;
            return (
              <div key={it.id} className="glass rounded-2xl p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-primary flex items-center gap-1.5">
                      {it.name}
                      {low && <span title="At or below reorder level"><AlertTriangle className="w-4 h-4 text-amber-500" /></span>}
                    </p>
                    <p className="text-xs text-secondary">{it.category} · {fmtKsh(it.costPerUnit)}/{it.unit}</p>
                  </div>
                  <div className="text-right">
                    <p className={`font-display text-xl font-bold ${low ? 'text-amber-500' : 'text-primary'}`}>{it.quantity} {it.unit}</p>
                    <p className="text-[11px] text-muted">reorder at {it.reorderLevel} {it.unit}</p>
                  </div>
                </div>

                {moveFor === it.id ? (
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[var(--border-color)]">
                    <select className="input-glass !w-auto !py-1.5 text-xs" value={moveType} onChange={e => setMoveType(e.target.value as 'in' | 'out')}>
                      <option value="in">Stock in</option>
                      <option value="out">Stock out</option>
                    </select>
                    <input type="number" className="input-glass !w-24 !py-1.5 text-xs" placeholder="Qty" value={moveQty} onChange={e => setMoveQty(e.target.value)} />
                    <input className="input-glass !py-1.5 text-xs flex-1 min-w-[140px]" placeholder="Reason (e.g. PO received, feeding)" value={moveReason} onChange={e => setMoveReason(e.target.value)} />
                    <button onClick={() => recordMovement(it.id)} className="btn-primary !py-1.5 !px-3 text-xs">Save</button>
                    <button onClick={() => setMoveFor(null)} className="btn-glass !py-1.5 !px-3 text-xs">Cancel</button>
                  </div>
                ) : (
                  <div className="flex gap-2 pt-1">
                    <button onClick={() => { setMoveFor(it.id); setMoveType('in'); }} className="btn-glass !py-1.5 !px-3 text-xs"><ArrowDownCircle className="w-3.5 h-3.5 text-green-600" /> Stock In</button>
                    <button onClick={() => { setMoveFor(it.id); setMoveType('out'); }} className="btn-glass !py-1.5 !px-3 text-xs"><ArrowUpCircle className="w-3.5 h-3.5 text-red-500" /> Stock Out</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
