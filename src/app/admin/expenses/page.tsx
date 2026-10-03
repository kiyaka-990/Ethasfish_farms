'use client';
import { useEffect, useState } from 'react';
import { Loader2, Plus, Trash2, Wallet, TrendingUp, TrendingDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { fmtKsh } from '@/lib/utils';

interface Expense { id: string; category: string; description: string; amount: number; paidTo: string | null; date: string; }
interface Summary { revenue: number; expenses: number; profit: number; }

const categories = ['feed', 'labor', 'utilities', 'transport', 'maintenance', 'other'];

export default function AdminExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [summary, setSummary] = useState<{ allTime: Summary; thisMonth: Summary } | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const [category, setCategory] = useState('feed');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paidTo, setPaidTo] = useState('');
  const [date, setDate] = useState('');

  async function load() {
    setLoading(true);
    const [expRes, sumRes] = await Promise.all([fetch('/api/admin/expenses'), fetch('/api/admin/accounting/summary')]);
    setExpenses((await expRes.json()).expenses || []);
    setSummary(await sumRes.json());
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function create() {
    if (!description.trim() || !amount) return toast.error('Description and amount are required');
    setCreating(true);
    const res = await fetch('/api/admin/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, description, amount: Number(amount), paidTo, date: date || undefined })
    });
    setCreating(false);
    if (res.ok) {
      toast.success('Expense recorded');
      setDescription(''); setAmount(''); setPaidTo(''); setDate('');
      load();
    } else toast.error('Failed');
  }

  async function remove(id: string) {
    if (!confirm('Delete this expense?')) return;
    const res = await fetch(`/api/admin/expenses?id=${id}`, { method: 'DELETE' });
    if (res.ok) { toast.success('Deleted'); load(); }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-primary flex items-center gap-2">
          <Wallet className="w-6 h-6 text-[var(--accent)]" /> Accounting
        </h1>
        <p className="text-sm text-muted mt-1">Expenses and a simple profit & loss — revenue comes from paid orders + paid invoices.</p>
      </div>

      {summary && (
        <div className="grid md:grid-cols-2 gap-4">
          {([['This Month', summary.thisMonth], ['All Time', summary.allTime]] as const).map(([label, s]) => (
            <div key={label} className="glass-strong rounded-3xl p-6">
              <p className="text-xs uppercase tracking-wider text-muted mb-3 font-bold">{label}</p>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <TrendingUp className="w-4 h-4 text-green-600 mx-auto mb-1" />
                  <p className="font-display text-lg font-bold text-primary">{fmtKsh(s.revenue)}</p>
                  <p className="text-[10px] text-muted">Revenue</p>
                </div>
                <div>
                  <TrendingDown className="w-4 h-4 text-red-500 mx-auto mb-1" />
                  <p className="font-display text-lg font-bold text-primary">{fmtKsh(s.expenses)}</p>
                  <p className="text-[10px] text-muted">Expenses</p>
                </div>
                <div>
                  <Wallet className="w-4 h-4 text-[var(--accent)] mx-auto mb-1" />
                  <p className={`font-display text-lg font-bold ${s.profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>{fmtKsh(s.profit)}</p>
                  <p className="text-[10px] text-muted">Profit</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="glass-strong rounded-3xl p-6 space-y-3">
        <h2 className="font-semibold text-primary">Record Expense</h2>
        <div className="grid md:grid-cols-2 gap-3">
          <select className="input-glass" value={category} onChange={e => setCategory(e.target.value)}>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input type="date" className="input-glass" value={date} onChange={e => setDate(e.target.value)} />
          <input className="input-glass md:col-span-2" placeholder="Description (e.g. '50kg grower pellets x10 bags')" value={description} onChange={e => setDescription(e.target.value)} />
          <input type="number" className="input-glass" placeholder="Amount (KSh)" value={amount} onChange={e => setAmount(e.target.value)} />
          <input className="input-glass" placeholder="Paid to (supplier/person)" value={paidTo} onChange={e => setPaidTo(e.target.value)} />
        </div>
        <button onClick={create} disabled={creating} className="btn-primary">
          {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Record Expense
        </button>
      </div>

      {loading ? (
        <div className="glass rounded-3xl p-12 text-center"><Loader2 className="w-6 h-6 animate-spin text-[var(--accent)] mx-auto" /></div>
      ) : expenses.length === 0 ? (
        <div className="glass rounded-3xl p-12 text-center text-muted text-sm">No expenses recorded yet.</div>
      ) : (
        <div className="space-y-2">
          {expenses.map(e => (
            <div key={e.id} className="glass rounded-xl p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-primary truncate">{e.description}</p>
                <p className="text-xs text-muted">{e.category} {e.paidTo && `· ${e.paidTo}`} · {new Date(e.date).toLocaleDateString()}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <p className="font-display font-bold text-primary">{fmtKsh(e.amount)}</p>
                <button onClick={() => remove(e.id)} className="p-1.5 text-red-500/80 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
