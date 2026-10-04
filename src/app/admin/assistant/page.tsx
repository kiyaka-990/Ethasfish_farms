'use client';
import { useEffect, useRef, useState } from 'react';
import { Sparkles, Send, Loader2, Bot } from 'lucide-react';

interface Msg { role: 'user' | 'bot'; content: string; }

const suggestions = [
  'How many orders this week?',
  "What's low on stock?",
  'Show me new leads',
  'What are our finances this month?',
  "What's our best-selling product?"
];

export default function AdminAssistantPage() {
  const [messages, setMessages] = useState<Msg[]>([
    { role: 'bot', content: "Hi! I'm the admin assistant - ask me anything about orders, inventory, leads, products, or finances. I can look things up but I can't make changes; do that on the relevant page." }
  ]);
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
      setMessages(m => [...m, { role: 'bot', content: data.reply || data.error || "Something went wrong." }]);
    } catch {
      setMessages(m => [...m, { role: 'bot', content: 'Connection issue - try again.' }]);
    } finally {
      setLoading(false);
    }
  }

  function format(s: string) {
    return s.split('\n').map((line, i) => {
      const html = line.replace(/\*([^*]+)\*/g, '<strong>$1</strong>');
      return <p key={i} className="mb-1.5 last:mb-0" dangerouslySetInnerHTML={{ __html: html }} />;
    });
  }

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div>
        <h1 className="font-display text-3xl font-bold text-primary flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-[var(--accent)]" /> Assistant
        </h1>
        <p className="text-sm text-muted mt-1">Ask about any real data on this portal - read-only, backed by live tool calls.</p>
      </div>

      <div className="glass-strong rounded-3xl flex-1 flex flex-col overflow-hidden min-h-[500px]">
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((m, i) => (
            m.role === 'user' ? (
              <div key={i} className="flex justify-end">
                <div className="max-w-[75%] px-4 py-2.5 text-sm leading-relaxed rounded-2xl rounded-br-md bg-gradient-to-br from-[var(--accent-light)] to-[var(--accent)] text-white">
                  {format(m.content)}
                </div>
              </div>
            ) : (
              <div key={i} className="flex gap-3">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[var(--accent-light)]/30 to-[var(--accent)]/20 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-3.5 h-3.5 text-[var(--accent)]" />
                </div>
                <div className="text-sm leading-relaxed text-primary pt-1 max-w-[80%]">{format(m.content)}</div>
              </div>
            )
          ))}
          {loading && (
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
          <div className="px-6 pb-3 flex flex-wrap gap-1.5">
            {suggestions.map(s => (
              <button key={s} onClick={() => send(s)} className="text-xs px-3 py-1.5 rounded-full border border-[var(--border-color)] hover:border-[var(--accent)] hover:text-[var(--accent)] text-secondary transition-colors">
                {s}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={e => { e.preventDefault(); send(); }} className="p-4 border-t border-[var(--border-color)] flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask about orders, stock, leads, finances..."
            className="input-glass flex-1"
          />
          <button type="submit" disabled={!input.trim() || loading} className="btn-primary !px-4 disabled:opacity-40">
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
