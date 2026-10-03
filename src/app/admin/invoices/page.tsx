'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Plus, Trash2, FileText, Eye } from 'lucide-react';
import toast from 'react-hot-toast';
import { fmtKsh } from '@/lib/utils';

interface InvoiceItem { description: string; quantity: number; unitPrice: number; }
interface Invoice {
  id: string; invoiceNumber: string; customerName: string; customerEmail: string | null; customerPhone: string | null;
  subtotal: number; taxRate: number; taxAmount: number; total: number; status: string; dueDate: string | null;
  issuedAt: string; items: (InvoiceItem & { id: string; lineTotal: number })[];
}
interface Order { id: string; orderNumber: string; customerName: string; customerEmail: string | null; customerPhone: string; items: { productName: string; variantLabel: string; quantity: number; unitPrice: number }[]; }

const statuses = ['draft', 'sent', 'paid', 'overdue', 'void'];
const statusColor: Record<string, string> = { draft: 'text-muted', sent: 'text-[var(--accent)]', paid: 'text-green-600', overdue: 'text-red-500', void: 'text-red-500' };

const emptyItem: InvoiceItem = { description: '', quantity: 1, unitPrice: 0 };

export default function AdminInvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddr, setCustomerAddr] = useState('');
  const [taxRate, setTaxRate] = useState(0);
  const [dueDate, setDueDate] = useState('');
  const [items, setItems] = useState<InvoiceItem[]>([{ ...emptyItem }]);

  async function load() {
    setLoading(true);
    const [invRes, ordRes] = await Promise.all([fetch('/api/admin/invoices'), fetch('/api/admin/orders')]);
    const invData = await invRes.json();
    const ordData = await ordRes.json();
    setInvoices(invData.invoices || []);
    setOrders(ordData.orders || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function prefillFromOrder(orderId: string) {
    const o = orders.find(x => x.id === orderId);
    if (!o) return;
    setCustomerName(o.customerName);
    setCustomerEmail(o.customerEmail || '');
    setCustomerPhone(o.customerPhone);
    setItems(o.items.map(it => ({ description: `${it.productName} (${it.variantLabel})`, quantity: it.quantity, unitPrice: it.unitPrice })));
  }

  function updateItem(i: number, patch: Partial<InvoiceItem>) {
    setItems(its => its.map((it, idx) => idx === i ? { ...it, ...patch } : it));
  }
  function addItem() { setItems(its => [...its, { ...emptyItem }]); }
  function removeItem(i: number) { setItems(its => its.filter((_, idx) => idx !== i)); }

  const subtotal = items.reduce((s, it) => s + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0), 0);
  const taxAmount = Math.round(subtotal * (taxRate / 100));
  const total = subtotal + taxAmount;

  async function create() {
    if (!customerName.trim() || items.some(it => !it.description.trim())) return toast.error('Customer name and item descriptions are required');
    setCreating(true);
    const res = await fetch('/api/admin/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerName, customerEmail, customerPhone, customerAddr, taxRate, dueDate: dueDate || null, items })
    });
    setCreating(false);
    if (res.ok) {
      toast.success('Invoice created');
      setCustomerName(''); setCustomerEmail(''); setCustomerPhone(''); setCustomerAddr(''); setTaxRate(0); setDueDate(''); setItems([{ ...emptyItem }]);
      load();
    } else toast.error('Failed to create invoice');
  }

  async function setStatus(id: string, status: string) {
    setSaving(id);
    const res = await fetch('/api/admin/invoices', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) });
    setSaving(null);
    if (res.ok) { toast.success(`Marked ${status}`); load(); } else toast.error('Failed');
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-primary flex items-center gap-2">
          <FileText className="w-6 h-6 text-[var(--accent)]" /> Invoices
        </h1>
        <p className="text-sm text-muted mt-1">Create and track invoices — separate from M-Pesa order receipts.</p>
      </div>

      <div className="glass-strong rounded-3xl p-6 space-y-4">
        <h2 className="font-semibold text-primary">New Invoice</h2>

        <select className="input-glass" defaultValue="" onChange={e => e.target.value && prefillFromOrder(e.target.value)}>
          <option value="">Prefill from an existing order (optional)</option>
          {orders.map(o => <option key={o.id} value={o.id}>{o.orderNumber} — {o.customerName}</option>)}
        </select>

        <div className="grid md:grid-cols-2 gap-3">
          <input className="input-glass" placeholder="Customer name" value={customerName} onChange={e => setCustomerName(e.target.value)} />
          <input className="input-glass" placeholder="Phone" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} />
          <input className="input-glass" placeholder="Email" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} />
          <input className="input-glass" placeholder="Address" value={customerAddr} onChange={e => setCustomerAddr(e.target.value)} />
        </div>

        <div className="space-y-2">
          {items.map((it, i) => (
            <div key={i} className="grid grid-cols-[1fr_80px_110px_auto] gap-2 items-center">
              <input className="input-glass !py-2 text-sm" placeholder="Description" value={it.description} onChange={e => updateItem(i, { description: e.target.value })} />
              <input type="number" min={1} className="input-glass !py-2 text-sm" placeholder="Qty" value={it.quantity} onChange={e => updateItem(i, { quantity: Number(e.target.value) })} />
              <input type="number" min={0} className="input-glass !py-2 text-sm" placeholder="Unit price" value={it.unitPrice} onChange={e => updateItem(i, { unitPrice: Number(e.target.value) })} />
              <button onClick={() => removeItem(i)} className="p-2 text-red-500/80 hover:text-red-500" aria-label="Remove item"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
          <button onClick={addItem} className="btn-glass !py-1.5 !px-3 text-xs"><Plus className="w-3.5 h-3.5" /> Add line item</button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm text-secondary flex items-center gap-2">Tax %
            <input type="number" min={0} className="input-glass !w-20 !py-1.5 text-sm" value={taxRate} onChange={e => setTaxRate(Number(e.target.value))} />
          </label>
          <label className="text-sm text-secondary flex items-center gap-2">Due date
            <input type="date" className="input-glass !w-auto !py-1.5 text-sm" value={dueDate} onChange={e => setDueDate(e.target.value)} />
          </label>
          <div className="ml-auto text-right">
            <p className="text-xs text-muted">Subtotal {fmtKsh(subtotal)} {taxRate > 0 && `+ Tax ${fmtKsh(taxAmount)}`}</p>
            <p className="font-display text-xl font-bold text-primary">{fmtKsh(total)}</p>
          </div>
        </div>

        <button onClick={create} disabled={creating} className="btn-primary">
          {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Create Invoice
        </button>
      </div>

      {loading ? (
        <div className="glass rounded-3xl p-12 text-center"><Loader2 className="w-6 h-6 animate-spin text-[var(--accent)] mx-auto" /></div>
      ) : invoices.length === 0 ? (
        <div className="glass rounded-3xl p-12 text-center text-muted text-sm">No invoices yet.</div>
      ) : (
        <div className="space-y-3">
          {invoices.map(inv => (
            <div key={inv.id} className="glass rounded-2xl p-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-primary font-mono text-sm">{inv.invoiceNumber}</p>
                <p className="text-xs text-secondary">{inv.customerName} · {new Date(inv.issuedAt).toLocaleDateString()}</p>
              </div>
              <div className="text-right">
                <p className="font-display font-bold text-primary">{fmtKsh(inv.total)}</p>
                <select
                  value={inv.status}
                  disabled={saving === inv.id}
                  onChange={e => setStatus(inv.id, e.target.value)}
                  className={`input-glass !w-auto !py-1 !px-2 text-xs font-semibold ${statusColor[inv.status] || ''}`}
                >
                  {statuses.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <Link href={`/admin/invoices/${inv.id}`} className="btn-glass !py-2 !px-3 text-xs"><Eye className="w-3.5 h-3.5" /> View</Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
