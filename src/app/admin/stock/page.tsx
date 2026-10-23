'use client';
import { useEffect, useRef, useState } from 'react';
import { Loader2, Fish, Plus, Send, Bot, ArrowDownCircle, ArrowUpCircle, AlertTriangle, Store } from 'lucide-react';
import toast from 'react-hot-toast';
import { fmtKsh } from '@/lib/utils';

interface SourceStock {
  sourceType: string; sourceNumber: string; label: string;
  pieces: number; kg: number; harvests: number; avgWeightKg: number;
}
interface OutletStock {
  id: string; name: string;
  distributedPieces: number; distributedKg: number;
  soldPieces: number; soldKg: number;
  revenueKsh: number; salesCount: number;
  pieces: number; kg: number;
  lowStockPieces: number; lowStockKg: number; isLow: boolean;
}
interface Snapshot {
  harvested: { pieces: number; kg: number; count: number };
  distributed: { pieces: number; kg: number; count: number };
  sold: { pieces: number; kg: number; amountKsh: number; count: number };
  farm: { pieces: number; kg: number };
  avgWeightKg: number;
  today: { harvests: number; pieces: number; kg: number };
  sources: SourceStock[];
  byType: Record<string, { pieces: number; kg: number; units: number; harvests: number }>;
  outlets: OutletStock[];
  lowStock: { count: number; outlets: OutletStock[] };
  role?: string;
}

interface Msg { role: 'user' | 'bot'; content: string; }

type Tab = 'harvest' | 'distribute' | 'sale';

const SOURCE_TYPES = [
  { value: 'cage', label: 'Cage', placeholder: 'e.g. 3' },
  { value: 'pond', label: 'Pond', placeholder: 'e.g. 1 or P2' },
  { value: 'hatchery', label: 'Hatchery', placeholder: '' }
];
const CHANNELS = ['counter', 'wholesale', 'mobile', 'market'];

const chatSuggestions = [
  'Any low stock?',
  'How much stock is on the farm?',
  'What does the Kisumu outlet have?',
  'Record 120 pieces from pond 3'
];

const emptySnapshot: Snapshot = {
  harvested: { pieces: 0, kg: 0, count: 0 },
  distributed: { pieces: 0, kg: 0, count: 0 },
  sold: { pieces: 0, kg: 0, amountKsh: 0, count: 0 },
  farm: { pieces: 0, kg: 0 },
  avgWeightKg: 0,
  today: { harvests: 0, pieces: 0, kg: 0 },
  sources: [],
  byType: {},
  outlets: [],
  lowStock: { count: 0, outlets: [] }
};

export default function AdminStockPage() {
  const [snap, setSnap] = useState<Snapshot>(emptySnapshot);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('harvest');
  const [saving, setSaving] = useState(false);

  // Harvest form
  const [sourceType, setSourceType] = useState('cage');
  const [sourceNumber, setSourceNumber] = useState('');
  const [hPieces, setHPieces] = useState('');
  const [hKg, setHKg] = useState('');
  const [hNote, setHNote] = useState('');

  // Distribute form
  const [distOutlet, setDistOutlet] = useState('');
  const [dPieces, setDPieces] = useState('');
  const [dKg, setDKg] = useState('');
  const [dNote, setDNote] = useState('');

  // Sale form
  const [saleOutlet, setSaleOutlet] = useState('');
  const [sPieces, setSPieces] = useState('');
  const [sKg, setSKg] = useState('');
  const [sAmount, setSAmount] = useState('');
  const [sChannel, setSChannel] = useState('counter');
  const [sNote, setSNote] = useState('');

  // Add outlet (admin)
  const [newOutlet, setNewOutlet] = useState('');
  const [addingOutlet, setAddingOutlet] = useState(false);

  // Low-stock thresholds (admin): keyed by outlet id
  const [thr, setThr] = useState<Record<string, { pieces: string; kg: string }>>({});
  const [savingThr, setSavingThr] = useState<string | null>(null);

  // Stockist chat
  const [messages, setMessages] = useState<Msg[]>([
    { role: 'bot', content: "Hi - I'm the stockist agent. Ask me about farm or outlet stock, or tell me to record a harvest, a send-out, or an outlet sale." }
  ]);
  const [input, setInput] = useState('');
  const [chatting, setChatting] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);

  async function load() {
    try {
      const res = await fetch('/api/admin/stock');
      const data = await res.json();
      if (data.error) return toast.error(data.error);
      setSnap({ ...emptySnapshot, ...data });
      const outs: OutletStock[] = data.outlets || [];
      setThr(Object.fromEntries(outs.map(o => [o.id, { pieces: String(o.lowStockPieces ?? 0), kg: String(o.lowStockKg ?? 0) }])));
    } catch {
      toast.error('Could not load stock');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages, chatting]);

  const isAdmin = snap.role === 'admin';

  function sendToTab(next: Tab, outletName: string) {
    if (next === 'distribute') setDistOutlet(outletName);
    else setSaleOutlet(outletName);
    setTab(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function post(path: string, body: Record<string, unknown>, method: 'POST' | 'PATCH' = 'POST'): Promise<boolean> {
    setSaving(true);
    try {
      const res = await fetch(path, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed');
        return false;
      }
      return true;
    } catch {
      toast.error('Connection issue');
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function submitHarvest() {
    const pieces = Number(hPieces);
    const kg = Number(hKg);
    if (!pieces || pieces <= 0) return toast.error('Enter the pieces counted');
    if (!kg || kg <= 0) return toast.error('Enter the weight in kg');
    if (sourceType !== 'hatchery' && !sourceNumber.trim())
      return toast.error(`Enter the ${sourceType} number`);
    const ok = await post('/api/admin/stock/harvest', {
      sourceType, sourceNumber: sourceNumber.trim(), pieces, weightKg: kg, note: hNote || null
    });
    if (ok) {
      toast.success(`Harvest recorded: ${pieces} pcs (${kg} kg)`);
      setSourceNumber(''); setHPieces(''); setHKg(''); setHNote('');
      load();
    }
  }

  async function submitDistribute() {
    const pieces = Number(dPieces) || 0;
    const kg = Number(dKg) || 0;
    if (!distOutlet) return toast.error('Pick an outlet');
    if (!pieces && !kg) return toast.error('Enter pieces and/or weight');
    const ok = await post('/api/admin/stock/distribute', {
      outlet: distOutlet, pieces, weightKg: kg, note: dNote || null
    });
    if (ok) {
      toast.success(`Sent ${pieces || '~'} ${pieces ? 'pcs' : ''}${pieces && kg ? ' / ' : ''}${kg || ''}${kg ? ' kg' : ''} to ${distOutlet}`);
      setDPieces(''); setDKg(''); setDNote('');
      load();
    }
  }

  async function submitSale() {
    const pieces = Number(sPieces) || 0;
    const kg = Number(sKg) || 0;
    const amount = Number(sAmount) || 0;
    if (!saleOutlet) return toast.error('Pick an outlet');
    if (!pieces && !kg) return toast.error('Enter pieces and/or weight sold');
    if (!amount) return toast.error('Enter the cash taken');
    const ok = await post('/api/admin/stock/sale', {
      outlet: saleOutlet, pieces, weightKg: kg, amountKsh: amount, channel: sChannel, note: sNote || null
    });
    if (ok) {
      toast.success(`Sale recorded at ${saleOutlet} - ${fmtKsh(amount)}`);
      setSPieces(''); setSKg(''); setSAmount(''); setSNote('');
      load();
    }
  }

  async function saveThresholds(outletId: string) {
    const t = thr[outletId];
    if (!t) return;
    const pieces = Number(t.pieces);
    const kg = Number(t.kg);
    if (!Number.isFinite(pieces) || pieces < 0 || !Number.isFinite(kg) || kg < 0)
      return toast.error('Thresholds must be 0 or more');
    setSavingThr(outletId);
    const ok = await post('/api/admin/stock/outlets', { outletId, lowStockPieces: pieces, lowStockKg: kg }, 'PATCH');
    setSavingThr(null);
    if (ok) {
      toast.success('Alert thresholds updated');
      load();
    }
  }

  async function addOutlet() {
    if (!newOutlet.trim()) return toast.error('Enter an outlet name');
    setAddingOutlet(true);
    const ok = await post('/api/admin/stock/outlets', { name: newOutlet.trim() });
    setAddingOutlet(false);
    if (ok) {
      toast.success(`Outlet "${newOutlet.trim()}" added`);
      setNewOutlet('');
      load();
    }
  }

  async function sendChat(text?: string) {
    const message = (text ?? input).trim();
    if (!message || chatting) return;
    setInput('');
    setMessages(m => [...m, { role: 'user', content: message }]);
    setChatting(true);
    try {
      const res = await fetch('/api/admin/stock/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      });
      const data = await res.json();
      setMessages(m => [...m, { role: 'bot', content: data.reply || data.error || 'Something went wrong.' }]);
      load();
    } catch {
      setMessages(m => [...m, { role: 'bot', content: 'Connection issue - try again.' }]);
    } finally {
      setChatting(false);
    }
  }

  function format(s: string) {
    return s.split('\n').map((line, i) => {
      const html = line.replace(/\*([^*]+)\*/g, '<strong>$1</strong>');
      return <p key={i} className="mb-1.5 last:mb-0" dangerouslySetInnerHTML={{ __html: html }} />;
    });
  }

  const sourceTypeMeta = SOURCE_TYPES.find(t => t.value === sourceType);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-primary flex items-center gap-2">
          <Fish className="w-6 h-6 text-[var(--accent)]" /> Stock
        </h1>
        <p className="text-sm text-muted mt-1">
          Harvest from numbered cages and ponds or the hatchery (counted in pieces and weighed in kg), send fish to outlets, and record outlet sales.
        </p>
      </div>

      {/* Snapshot */}
      {/* Low-stock alerts */}
      {snap.lowStock.count > 0 && (
        <div className="glass-strong rounded-2xl p-5 border-l-4 border-l-amber-500 flex flex-wrap items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-primary">
              Low stock at {snap.lowStock.count} outlet{snap.lowStock.count === 1 ? '' : 's'}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {snap.lowStock.outlets.map(o => (
                <span key={o.id} className="badge !bg-amber-500/15 !border-amber-500/40 !text-amber-500">
                  {o.name}: {o.pieces} pcs / {o.kg} kg (alert at {o.lowStockPieces} pcs / {o.lowStockKg} kg)
                </span>
              ))}
            </div>
            <p className="text-xs text-muted mt-1.5">
              Restock from farm stock or ask the stockist agent to sort it out.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-strong rounded-2xl p-5">
          <p className="text-[11px] uppercase tracking-wider text-muted">Farm Stock</p>
          <p className="font-display text-xl font-bold text-primary mt-1">{snap.farm.pieces.toLocaleString()} pcs</p>
          <p className="text-xs text-secondary mt-0.5">{snap.farm.kg.toLocaleString()} kg undistributed</p>
        </div>
        <div className="glass-strong rounded-2xl p-5">
          <p className="text-[11px] uppercase tracking-wider text-muted">Harvested Today</p>
          <p className="font-display text-xl font-bold text-primary mt-1">{snap.today.pieces.toLocaleString()} pcs</p>
          <p className="text-xs text-secondary mt-0.5">{snap.today.kg.toLocaleString()} kg · {snap.today.harvests} harvest{snap.today.harvests === 1 ? '' : 's'}</p>
        </div>
        <div className="glass-strong rounded-2xl p-5">
          <p className="text-[11px] uppercase tracking-wider text-muted">Revenue at Outlets</p>
          <p className="font-display text-xl font-bold text-primary mt-1">{fmtKsh(snap.sold.amountKsh)}</p>
          <p className="text-xs text-secondary mt-0.5">{snap.sold.pieces.toLocaleString()} pcs · {snap.sold.kg.toLocaleString()} kg sold</p>
        </div>
        <div className="glass-strong rounded-2xl p-5">
          <p className="text-[11px] uppercase tracking-wider text-muted">Average Weight</p>
          <p className="font-display text-xl font-bold text-primary mt-1">{snap.avgWeightKg || 0} kg</p>
          <p className="text-xs text-secondary mt-0.5">per piece - derives missing pieces/kg</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-5 gap-6 items-start">
        <div className="lg:col-span-3 space-y-6">
          {/* Forms */}
          <div className="glass-strong rounded-3xl p-6 space-y-4">
            <div className="flex flex-wrap gap-2">
              {([
                { id: 'harvest' as Tab, label: 'Record Harvest' },
                { id: 'distribute' as Tab, label: 'Send to Outlet' },
                { id: 'sale' as Tab, label: 'Record Sale' }
              ]).map(t => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                    tab === t.id
                      ? 'bg-gradient-to-br from-[var(--accent-light)] to-[var(--accent)] text-white'
                      : 'text-secondary hover:text-primary hover:bg-[var(--surface)]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {tab === 'harvest' && (
              <div className="space-y-3">
                <div className="grid md:grid-cols-2 gap-3">
                  <select className="input-glass" value={sourceType} onChange={e => setSourceType(e.target.value)}>
                    {SOURCE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                  {sourceType !== 'hatchery' && (
                    <input
                      className="input-glass"
                      placeholder={`${sourceType === 'pond' ? 'Pond' : 'Cage'} number ${sourceTypeMeta?.placeholder || ''}`}
                      value={sourceNumber}
                      onChange={e => setSourceNumber(e.target.value)}
                    />
                  )}
                  <input type="number" min={1} className="input-glass" placeholder="Pieces counted *"
                    value={hPieces} onChange={e => setHPieces(e.target.value)} />
                  <input type="number" min={1} step="0.1" className="input-glass" placeholder="Weight on the scales (kg) *"
                    value={hKg} onChange={e => setHKg(e.target.value)} />
                  <input className="input-glass md:col-span-2" placeholder="Note (optional - e.g. grading out)"
                    value={hNote} onChange={e => setHNote(e.target.value)} />
                </div>
                <p className="text-xs text-muted">
                  Every harvest is counted <strong>and</strong> weighed - pieces and kg are both required, whether it&apos;s a cage, a pond, or the hatchery.
                </p>
                <button onClick={submitHarvest} disabled={saving} className="btn-primary">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowDownCircle className="w-4 h-4" />} Record Harvest
                </button>
              </div>
            )}

            {tab === 'distribute' && (
              <div className="space-y-3">
                <div className="grid md:grid-cols-2 gap-3">
                  <select className="input-glass" value={distOutlet} onChange={e => setDistOutlet(e.target.value)}>
                    <option value="">Outlet *</option>
                    {snap.outlets.map(o => <option key={o.id} value={o.name}>{o.name}</option>)}
                  </select>
                  <input type="number" min={0} className="input-glass" placeholder="Pieces"
                    value={dPieces} onChange={e => setDPieces(e.target.value)} />
                  <input type="number" min={0} step="0.1" className="input-glass" placeholder="Weight (kg)"
                    value={dKg} onChange={e => setDKg(e.target.value)} />
                  <input className="input-glass" placeholder="Note (optional)"
                    value={dNote} onChange={e => setDNote(e.target.value)} />
                </div>
                <p className="text-xs text-muted">
                  Fill in pieces or kg - whichever you didn&apos;t enter is derived from the {snap.avgWeightKg || 'current'} kg average.
                  Farm stock: {snap.farm.pieces} pcs / {snap.farm.kg} kg.
                </p>
                <button onClick={submitDistribute} disabled={saving} className="btn-primary">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUpCircle className="w-4 h-4" />} Send to Outlet
                </button>
              </div>
            )}

            {tab === 'sale' && (
              <div className="space-y-3">
                <div className="grid md:grid-cols-2 gap-3">
                  <select className="input-glass" value={saleOutlet} onChange={e => setSaleOutlet(e.target.value)}>
                    <option value="">Outlet *</option>
                    {snap.outlets.map(o => (
                      <option key={o.id} value={o.name}>
                        {o.name} ({o.pieces} pcs / {o.kg} kg){o.isLow ? ' - LOW' : ''}
                      </option>
                    ))}
                  </select>
                  <select className="input-glass" value={sChannel} onChange={e => setSChannel(e.target.value)}>
                    {CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <input type="number" min={0} className="input-glass" placeholder="Pieces sold"
                    value={sPieces} onChange={e => setSPieces(e.target.value)} />
                  <input type="number" min={0} step="0.1" className="input-glass" placeholder="Weight sold (kg)"
                    value={sKg} onChange={e => setSKg(e.target.value)} />
                  <input type="number" min={0} className="input-glass" placeholder="Cash taken (KSh) *"
                    value={sAmount} onChange={e => setSAmount(e.target.value)} />
                  <input className="input-glass" placeholder="Note (optional)"
                    value={sNote} onChange={e => setSNote(e.target.value)} />
                </div>
                <p className="text-xs text-muted">
                  Sell by pieces, by kg, or both - the missing dimension is derived from the average weight. Stock can&apos;t go negative at the outlet.
                </p>
                <button onClick={submitSale} disabled={saving} className="btn-primary">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Store className="w-4 h-4" />} Record Sale
                </button>
              </div>
            )}
          </div>

          {/* Balances by source */}
          <div className="glass-strong rounded-3xl p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-semibold text-primary">Stock by Source</h2>
              <div className="flex flex-wrap gap-2">
                {['cage', 'pond', 'hatchery'].map(t => {
                  const b = snap.byType[t];
                  if (!b || !b.units) return null;
                  return (
                    <span key={t} className="badge !text-[10px] !py-0.5">
                      {b.units} {t}{b.units > 1 ? (t === 'hatchery' ? '' : 's') : ''} · {b.pieces} pcs · {b.kg} kg
                    </span>
                  );
                })}
              </div>
            </div>

            {loading ? (
              <div className="py-8 text-center"><Loader2 className="w-5 h-5 animate-spin text-[var(--accent)] mx-auto" /></div>
            ) : snap.sources.length === 0 ? (
              <p className="text-sm text-muted text-center py-4">
                No harvests yet - record one above and each cage and pond will show its own balance here.
              </p>
            ) : (
              <div className="space-y-2">
                {snap.sources.map(s => (
                  <div key={`${s.sourceType}-${s.sourceNumber}`} className="glass rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-primary">{s.label}</p>
                      <p className="text-[11px] text-muted">{s.harvests} harvest{s.harvests === 1 ? '' : 's'} · avg {s.avgWeightKg} kg/pc</p>
                    </div>
                    <div className="text-right">
                      <p className="font-display text-lg font-bold text-primary">{s.pieces.toLocaleString()} pcs</p>
                      <p className="text-xs text-secondary">{s.kg.toLocaleString()} kg</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="text-[11px] text-muted">
              Harvested {snap.harvested.pieces.toLocaleString()} pcs / {snap.harvested.kg.toLocaleString()} kg in total ·
              distributed {snap.distributed.pieces.toLocaleString()} pcs / {snap.distributed.kg.toLocaleString()} kg
            </p>
          </div>

          {/* Outlets */}
          <div className="glass-strong rounded-3xl p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-semibold text-primary">Outlets</h2>
              {isAdmin && (
                <div className="flex gap-2">
                  <input className="input-glass !w-40 !py-1.5 text-xs" placeholder="New outlet name"
                    value={newOutlet} onChange={e => setNewOutlet(e.target.value)} />
                  <button onClick={addOutlet} disabled={addingOutlet} className="btn-glass !py-1.5 !px-3 text-xs">
                    {addingOutlet ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Add
                  </button>
                </div>
              )}
            </div>

            {snap.outlets.length === 0 ? (
              <p className="text-sm text-muted text-center py-4">No outlets yet.</p>
            ) : (
              <div className="grid md:grid-cols-2 gap-3">
                {snap.outlets.map(o => {
                  const low = o.pieces <= 0;
                  return (
                    <div key={o.id} className={`glass rounded-2xl p-5 space-y-3 ${o.isLow ? 'ring-1 ring-amber-500/50' : ''}`}>
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-primary">{o.name}</p>
                        {o.isLow ? (
                          <span className="badge !bg-amber-500/15 !border-amber-500/40 !text-amber-500" title={`Alerts at ${o.lowStockPieces} pcs / ${o.lowStockKg} kg`}>
                            <AlertTriangle className="w-3 h-3" /> LOW
                          </span>
                        ) : low ? (
                          <span title="Out of stock"><AlertTriangle className="w-4 h-4 text-amber-500" /></span>
                        ) : null}
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className={`font-display text-xl font-bold ${o.isLow || low ? 'text-amber-500' : 'text-primary'}`}>{o.pieces.toLocaleString()} pcs</span>
                        <span className="text-sm text-secondary">{o.kg.toLocaleString()} kg</span>
                      </div>
                      <p className="text-[11px] text-muted">
                        received {o.distributedPieces} pcs / {o.distributedKg} kg · sold {o.soldPieces} pcs / {o.soldKg} kg · {fmtKsh(o.revenueKsh)} ({o.salesCount} sale{o.salesCount === 1 ? '' : 's'})
                      </p>
                      <p className="text-[11px] text-muted">
                        low-stock alert at {o.lowStockPieces} pcs / {o.lowStockKg} kg
                      </p>
                      <div className="flex gap-2">
                        <button onClick={() => sendToTab('distribute', o.name)} className="btn-glass !py-1.5 !px-3 text-xs">
                          <ArrowUpCircle className="w-3.5 h-3.5 text-green-600" /> Send Stock
                        </button>
                        <button onClick={() => sendToTab('sale', o.name)} className="btn-glass !py-1.5 !px-3 text-xs">
                          <Store className="w-3.5 h-3.5 text-[var(--accent)]" /> Record Sale
                        </button>
                      </div>
                      {isAdmin && thr[o.id] && (
                        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[var(--border-color)]">
                          <span className="text-[11px] text-muted">Alert at</span>
                          <input type="number" min={0} className="input-glass !w-20 !py-1 text-xs"
                            placeholder="pcs" value={thr[o.id].pieces}
                            onChange={e => setThr(t => ({ ...t, [o.id]: { ...t[o.id], pieces: e.target.value } }))} />
                          <span className="text-[11px] text-muted">pcs /</span>
                          <input type="number" min={0} step="0.1" className="input-glass !w-20 !py-1 text-xs"
                            placeholder="kg" value={thr[o.id].kg}
                            onChange={e => setThr(t => ({ ...t, [o.id]: { ...t[o.id], kg: e.target.value } }))} />
                          <span className="text-[11px] text-muted">kg</span>
                          <button onClick={() => saveThresholds(o.id)} disabled={savingThr === o.id}
                            className="btn-glass !py-1 !px-2.5 text-xs ml-auto">
                            {savingThr === o.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Save'}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Stockist agent */}
        <div className="lg:col-span-2 lg:sticky lg:top-8">
          <div className="glass-strong rounded-3xl flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--border-color)] flex items-center gap-2">
              <Bot className="w-4 h-4 text-[var(--accent)]" />
              <h2 className="font-semibold text-primary text-sm">Stockist Agent</h2>
              <span className="badge !text-[10px] !py-0.5 ml-auto">can record stock</span>
            </div>

            <div ref={chatRef} className="h-[420px] overflow-y-auto p-5 space-y-4">
              {messages.map((m, i) => (
                m.role === 'user' ? (
                  <div key={i} className="flex justify-end">
                    <div className="max-w-[85%] px-4 py-2.5 text-sm leading-relaxed rounded-2xl rounded-br-md bg-gradient-to-br from-[var(--accent-light)] to-[var(--accent)] text-white">
                      {format(m.content)}
                    </div>
                  </div>
                ) : (
                  <div key={i} className="flex gap-3">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[var(--accent-light)]/30 to-[var(--accent)]/20 flex items-center justify-center shrink-0 mt-0.5">
                      <Bot className="w-3.5 h-3.5 text-[var(--accent)]" />
                    </div>
                    <div className="text-sm leading-relaxed text-primary pt-1 max-w-[85%]">{format(m.content)}</div>
                  </div>
                )
              ))}
              {chatting && (
                <div className="flex gap-3">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[var(--accent-light)]/30 to-[var(--accent)]/20 flex items-center justify-center shrink-0">
                    <Bot className="w-3.5 h-3.5 text-[var(--accent)]" />
                  </div>
                  <div className="flex items-center gap-1 px-4 py-3 rounded-2xl rounded-bl-md bg-[var(--surface)]">
                    <Loader2 className="w-4 h-4 animate-spin text-[var(--accent)]" />
                  </div>
                </div>
              )}
            </div>

            {messages.length <= 1 && (
              <div className="px-5 pb-3 flex flex-wrap gap-1.5">
                {chatSuggestions.map(s => (
                  <button key={s} onClick={() => sendChat(s)}
                    className="text-xs px-3 py-1.5 rounded-full border border-[var(--border-color)] hover:border-[var(--accent)] hover:text-[var(--accent)] text-secondary transition-colors">
                    {s}
                  </button>
                ))}
              </div>
            )}

            <form onSubmit={e => { e.preventDefault(); sendChat(); }} className="p-4 border-t border-[var(--border-color)] flex gap-2">
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Ask about stock or record something..."
                className="input-glass flex-1"
              />
              <button type="submit" disabled={!input.trim() || chatting} className="btn-primary !px-4 disabled:opacity-40">
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
