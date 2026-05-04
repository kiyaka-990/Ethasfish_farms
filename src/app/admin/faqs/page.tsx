'use client';
import { useEffect, useState } from 'react';
import { Loader2, Plus, Trash2, Save, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';

interface Faq {
  id?: string;
  question: string;
  answer: string;
  keywords: string;
  category: string;
  active: boolean;
}

const empty: Faq = { question: '', answer: '', keywords: '', category: 'general', active: true };

export default function AdminFaqsPage() {
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Faq>({ ...empty });
  const [saving, setSaving] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch('/api/admin/faqs');
    const data = await res.json();
    setFaqs(data.faqs || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function create() {
    if (!draft.question.trim() || !draft.answer.trim()) return toast.error('Question and answer required');
    setSaving('new');
    const res = await fetch('/api/admin/faqs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft)
    });
    setSaving(null);
    if (res.ok) {
      toast.success('FAQ added · chatbot updated');
      setDraft({ ...empty });
      load();
    } else toast.error('Failed');
  }

  async function update(faq: Faq) {
    setSaving(faq.id!);
    const res = await fetch('/api/admin/faqs', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(faq)
    });
    setSaving(null);
    if (res.ok) toast.success('Updated');
    else toast.error('Failed');
  }

  async function remove(id: string) {
    if (!confirm('Delete this FAQ?')) return;
    const res = await fetch(`/api/admin/faqs?id=${id}`, { method: 'DELETE' });
    if (res.ok) { toast.success('Deleted'); load(); }
  }

  function patch(id: string, key: keyof Faq, value: any) {
    setFaqs(fs => fs.map(f => f.id !== id ? f : { ...f, [key]: value }));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-primary">Chatbot FAQs</h1>
        <p className="text-sm text-muted mt-1 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-[var(--accent)]" />
          Add Q&As to teach the chatbot — it will use them on the website and WhatsApp
        </p>
      </div>

      <div className="glass-strong rounded-3xl p-6 space-y-3">
        <h2 className="font-semibold text-primary">Add new FAQ</h2>
        <div className="grid md:grid-cols-2 gap-3">
          <input className="input-glass" placeholder="Question (e.g., 'Do you offer bulk discounts?')" value={draft.question} onChange={e => setDraft({...draft, question: e.target.value})} />
          <input className="input-glass" placeholder="Category (general, products, ordering, etc.)" value={draft.category} onChange={e => setDraft({...draft, category: e.target.value})} />
        </div>
        <textarea className="input-glass resize-none" rows={3} placeholder="Answer..." value={draft.answer} onChange={e => setDraft({...draft, answer: e.target.value})} />
        <input className="input-glass" placeholder="Keywords (comma-separated, e.g., 'bulk, wholesale, discount, large order')" value={draft.keywords} onChange={e => setDraft({...draft, keywords: e.target.value})} />
        <button onClick={create} disabled={saving === 'new'} className="btn-primary">
          {saving === 'new' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Add FAQ
        </button>
      </div>

      {loading ? (
        <div className="glass rounded-3xl p-12 text-center"><Loader2 className="w-6 h-6 animate-spin text-[var(--accent)] mx-auto" /></div>
      ) : (
        <div className="space-y-3">
          {faqs.map(f => (
            <div key={f.id} className="glass rounded-2xl p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <span className="badge !text-[10px]">{f.category}</span>
                <div className="flex items-center gap-1">
                  <label className="flex items-center gap-1.5 text-xs text-secondary">
                    <input type="checkbox" checked={f.active} onChange={e => patch(f.id!, 'active', e.target.checked)} className="accent-sea-400" />
                    Active
                  </label>
                </div>
              </div>
              <input className="input-glass !py-2 text-sm font-semibold" value={f.question} onChange={e => patch(f.id!, 'question', e.target.value)} />
              <textarea rows={2} className="input-glass !py-2 text-sm resize-none" value={f.answer} onChange={e => patch(f.id!, 'answer', e.target.value)} />
              <input className="input-glass !py-2 text-xs text-secondary" value={f.keywords} onChange={e => patch(f.id!, 'keywords', e.target.value)} placeholder="comma-separated keywords" />
              <div className="flex gap-2">
                <button onClick={() => update(f)} disabled={saving === f.id} className="btn-primary !py-2 text-xs">
                  {saving === f.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save
                </button>
                <button onClick={() => remove(f.id!)} className="btn-glass !py-2 text-xs !text-red-600">
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
