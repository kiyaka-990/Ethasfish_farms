'use client';
import { useEffect, useRef, useState } from 'react';
import { Sparkles, X, Send, Loader2 } from 'lucide-react';

interface Msg { role: 'user' | 'bot'; content: string; }

const suggestions = ["What's left of medium tilapia?", 'Any low stock items?', "Today's sales so far"];

// A cashier-facing shortcut into the same read-only admin agent used on
// /admin/assistant, surfaced right on the till screen so staff don't have
// to leave a sale in progress to check stock or look something up.
export default function PosAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([{ role: 'bot', content: "Ask me about stock, today's sales, or orders - I'm read-only, so I can't ring anything up for you." }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  async function send(text?: string) {
    const message = (text ?? input).trim();
    if (!message || loading) return;
    setInput('');
    setMessages(m => [...m, { role: 'user', content: message }]);
    setLoading(true);
    try {
      const res = await fetch('/api/admin/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      });
      const data = await res.json();
      setMessages(m => [...m, { role: 'bot', content: data.reply || data.error || 'Something went wrong.' }]);
    } catch {
      setMessages(m => [...m, { role: 'bot', content: 'Connection issue - try again.' }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(v => !v)}
        className="fixed bottom-6 right-6 z-[80] w-[52px] h-[52px] rounded-full flex items-center justify-center bg-gradient-to-br from-[var(--accent-light)] to-[var(--accent)] shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200"
        aria-label="Ask assistant"
      >
        {open ? <X className="w-5 h-5 text-white" /> : <Sparkles className="w-5 h-5 text-white" />}
      </button>

      <div className={`fixed bottom-24 right-6 z-[75] w-[calc(100vw-3rem)] sm:w-[340px] h-[460px] max-h-[65vh] transition-all duration-300 ${open ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-3 pointer-events-none'}`}>
        <div className="h-full flex flex-col rounded-2xl overflow-hidden border border-[var(--border-color)] shadow-2xl" style={{ background: 'var(--bg-tertiary)' }}>
          <div className="px-4 py-3 flex items-center gap-2 border-b border-[var(--border-color)]">
            <Sparkles className="w-4 h-4 text-[var(--accent)]" />
            <p className="font-semibold text-primary text-sm">Till Assistant</p>
          </div>
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`text-[13px] leading-relaxed px-3 py-2 rounded-xl max-w-[90%] ${m.role === 'user' ? 'ml-auto bg-gradient-to-br from-[var(--accent-light)] to-[var(--accent)] text-white' : 'bg-[var(--surface)] text-primary'}`}>
                {m.content}
              </div>
            ))}
            {loading && <Loader2 className="w-4 h-4 animate-spin text-muted" />}
          </div>
          <div className="px-3 pb-2 flex flex-wrap gap-1.5">
            {suggestions.map(s => (
              <button key={s} onClick={() => send(s)} className="text-[11px] px-2 py-1 rounded-full border border-[var(--border-color)] hover:border-[var(--accent)] hover:text-[var(--accent)] text-secondary transition-colors">
                {s}
              </button>
            ))}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); send(); }} className="p-2.5 border-t border-[var(--border-color)] flex gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask about stock, sales..."
              className="flex-1 px-3 py-2 text-sm rounded-xl border border-[var(--border-color)] bg-transparent text-primary placeholder:text-muted outline-none focus:border-[var(--accent)]"
            />
            <button type="submit" disabled={!input.trim() || loading} className="w-9 h-9 rounded-xl bg-gradient-to-br from-[var(--accent-light)] to-[var(--accent)] flex items-center justify-center disabled:opacity-40 shrink-0">
              <Send className="w-4 h-4 text-white" />
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
