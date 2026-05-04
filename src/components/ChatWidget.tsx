'use client';
import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Sparkles } from 'lucide-react';

interface Msg { role: 'user' | 'bot'; content: string; }

const initialSuggestions = [
  'Show me your products',
  'What are the prices?',
  'Tell me about your services',
  'How do I order?',
  'Where are you located?'
];

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    { role: 'bot', content: "Hi! Welcome to Ethasfish Farms 🐟 I'm your AI assistant — ask me about fresh tilapia, hatchery services, fish feeds, consultancy, orders, or anything else." }
  ]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [sessionId] = useState(() => `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, typing]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 300);
  }, [open]);

  async function send(text?: string) {
    const message = (text ?? input).trim();
    if (!message) return;
    setInput('');
    setMessages(m => [...m, { role: 'user', content: message }]);
    setTyping(true);
    try {
      const res = await fetch('/api/chatbot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, sessionId })
      });
      const data = await res.json();
      setMessages(m => [...m, { role: 'bot', content: data.reply || "Sorry, I'm having trouble right now. Try WhatsApp?" }]);
    } catch {
      setMessages(m => [...m, { role: 'bot', content: 'Connection issue. Please try again or message us on WhatsApp.' }]);
    } finally {
      setTyping(false);
    }
  }

  function format(s: string) {
    return s.split('\n').map((line, i) => {
      const html = line
        .replace(/\*([^*]+)\*/g, '<strong>$1</strong>')
        .replace(/_([^_]+)_/g, '<em>$1</em>');
      return <p key={i} dangerouslySetInnerHTML={{ __html: html }} />;
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 z-[80] w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 hover:scale-110"
        style={{ background: 'linear-gradient(135deg, #1eb5a6 0%, #0e8c7f 100%)', boxShadow: '0 12px 32px rgba(30, 181, 166, 0.5)' }}
        aria-label="Open chat"
      >
        {open ? <X className="w-6 h-6 text-white" /> : <MessageCircle className="w-6 h-6 text-white" />}
        {!open && <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 border-2 border-[var(--bg-primary)] animate-pulse-soft" />}
      </button>

      <div className={`fixed bottom-24 right-6 z-[75] w-[calc(100vw-3rem)] sm:w-[400px] h-[600px] max-h-[80vh] transition-all duration-500 ${open ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-8 pointer-events-none'}`}>
        <div className="h-full flex flex-col glass-strong rounded-3xl overflow-hidden border border-[var(--border-color)] shadow-2xl">
          <div className="p-4 flex items-center gap-3 border-b border-[var(--border-color)]" style={{ background: 'linear-gradient(135deg, rgba(30, 181, 166, 0.15), rgba(14, 140, 127, 0.05))' }}>
            <div className="relative">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#4dd1c4] to-[#0e8c7f] flex items-center justify-center text-xl">🐟</div>
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-[var(--bg-tertiary)]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-primary text-sm flex items-center gap-1">
                Ethasfish AI <Sparkles className="w-3 h-3 text-[var(--accent)]" />
              </p>
              <p className="text-[11px] text-muted">Live · learns from our menu</p>
            </div>
            <button onClick={() => setOpen(false)} className="p-2 rounded-xl hover:bg-[var(--surface)] text-muted" aria-label="Close">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-4 py-2.5 text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'rounded-2xl rounded-br-md bg-gradient-to-br from-[#1eb5a6] to-[#0e8c7f] text-white'
                    : 'rounded-2xl rounded-bl-md glass-soft text-primary'
                }`}>
                  {format(m.content)}
                </div>
              </div>
            ))}
            {typing && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-md glass-soft px-4 py-3 flex gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-bounce" style={{animationDelay: '0ms'}} />
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-bounce" style={{animationDelay: '150ms'}} />
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-bounce" style={{animationDelay: '300ms'}} />
                </div>
              </div>
            )}
          </div>

          {messages.length <= 1 && (
            <div className="px-4 pb-2 flex flex-wrap gap-1.5">
              {initialSuggestions.map(s => (
                <button key={s} onClick={() => send(s)} className="text-[11px] px-3 py-1.5 rounded-full glass-soft hover:bg-[var(--surface-strong)] text-secondary transition-colors">
                  {s}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={(e) => { e.preventDefault(); send(); }} className="p-3 border-t border-[var(--border-color)] flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask anything..."
              className="input-glass !py-2.5 text-sm flex-1"
            />
            <button type="submit" disabled={!input.trim()} className="btn-primary !p-3 disabled:opacity-50" aria-label="Send">
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
