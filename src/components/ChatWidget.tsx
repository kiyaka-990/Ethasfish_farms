'use client';
import { useRef, useEffect, useState } from 'react';
import { MessageCircle, X, Send, Menu as MenuIcon, Fish } from 'lucide-react';
import { useChatUI } from '@/lib/chat-store';

interface Msg { role: 'user' | 'bot'; content: string; }

const quickReplies = [
  'Show me your products',
  'What are the prices?',
  'Tell me about your services',
  'How do I order?',
  'Track my order',
  'Where are you located?',
  'Talk to a human'
];

export default function ChatWidget() {
  const { isOpen: open, close, toggle } = useChatUI();
  const [messages, setMessages] = useState<Msg[]>([
    { role: 'bot', content: "Hi! I'm the Ethasfish Farms assistant. Ask me about fresh tilapia, hatchery services, fish feeds, consultancy, or your order." }
  ]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [showMenu, setShowMenu] = useState(true);
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
        onClick={toggle}
        className="fixed bottom-6 right-6 z-[80] w-[52px] h-[52px] rounded-full flex items-center justify-center bg-gradient-to-br from-[var(--accent-light)] to-[var(--accent)] shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200"
        aria-label="Open chat"
      >
        {open ? <X className="w-5 h-5 text-white" /> : <MessageCircle className="w-5 h-5 text-white" />}
      </button>

      <div className={`fixed bottom-24 right-6 z-[75] w-[calc(100vw-3rem)] sm:w-[380px] h-[600px] max-h-[75vh] transition-all duration-300 ${open ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-3 pointer-events-none'}`}>
        <div className="h-full flex flex-col rounded-2xl overflow-hidden border border-[var(--border-color)] shadow-2xl" style={{ background: 'var(--bg-tertiary)' }}>
          <div className="px-4 py-3.5 flex items-center gap-2.5 border-b border-[var(--border-color)] relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-[var(--accent)]/10 via-transparent to-transparent pointer-events-none" />
            <div className="relative w-9 h-9 rounded-full bg-gradient-to-br from-[var(--accent-light)] to-[var(--accent)] flex items-center justify-center shrink-0 shadow-sm">
              <Fish className="w-4 h-4 text-white" />
            </div>
            <div className="relative flex-1 min-w-0">
              <p className="font-semibold text-primary text-sm">Ethasfish Assistant</p>
              <p className="text-[11px] text-muted">AI-powered · usually replies instantly</p>
            </div>
            <span className="relative w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" aria-hidden />
            <button onClick={() => setShowMenu(v => !v)} className={`relative p-1.5 rounded-lg hover:bg-[var(--surface)] transition-colors ${showMenu ? 'text-[var(--accent)]' : 'text-muted'}`} aria-label="Toggle quick menu" aria-pressed={showMenu}>
              <MenuIcon className="w-4 h-4" />
            </button>
            <button onClick={close} className="relative p-1.5 rounded-lg hover:bg-[var(--surface)] text-muted" aria-label="Close">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
            style={{ background: 'radial-gradient(ellipse 120% 40% at 50% 0%, var(--accent-soft)/6, transparent)' }}
          >
            {messages.map((m, i) => (
              m.role === 'user' ? (
                <div key={i} className="flex justify-end animate-fade-up" style={{ animationDuration: '300ms' }}>
                  <div className="max-w-[80%] px-3.5 py-2 text-[13.5px] leading-relaxed rounded-2xl rounded-br-md bg-gradient-to-br from-[var(--accent-light)] to-[var(--accent)] text-white shadow-sm">
                    {format(m.content)}
                  </div>
                </div>
              ) : (
                <div key={i} className="flex gap-2.5 animate-fade-up" style={{ animationDuration: '300ms' }}>
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[var(--accent-light)]/30 to-[var(--accent)]/20 flex items-center justify-center shrink-0 mt-0.5">
                    <Fish className="w-3 h-3 text-[var(--accent)]" />
                  </div>
                  <div className="text-[13.5px] leading-relaxed text-primary pt-0.5 [&_p]:mb-1.5 last:[&_p]:mb-0">
                    {format(m.content)}
                  </div>
                </div>
              )
            ))}
            {typing && (
              <div className="flex gap-2.5">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[var(--accent-light)]/30 to-[var(--accent)]/20 flex items-center justify-center shrink-0">
                  <Fish className="w-3 h-3 text-[var(--accent)]" />
                </div>
                <div className="flex gap-1 items-center px-3.5 py-2.5 rounded-2xl rounded-bl-md bg-[var(--surface)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-bounce" style={{animationDelay: '0ms'}} />
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-bounce" style={{animationDelay: '150ms'}} />
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-bounce" style={{animationDelay: '300ms'}} />
                </div>
              </div>
            )}
          </div>

          {showMenu && (
            <div className="px-4 pb-2.5 flex flex-wrap gap-1.5 border-t border-[var(--border-color)] pt-2.5 max-h-28 overflow-y-auto">
              {quickReplies.map(s => (
                <button key={s} onClick={() => send(s)} className="text-[11px] px-2.5 py-1.5 rounded-full border border-[var(--border-color)] hover:border-[var(--accent)] hover:text-[var(--accent)] hover:bg-[var(--accent)]/5 text-secondary transition-all">
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
              placeholder="Message Ethasfish..."
              className="flex-1 px-3.5 py-2.5 text-sm rounded-xl border border-[var(--border-color)] bg-transparent text-primary placeholder:text-muted outline-none focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_rgba(59,147,206,0.15)] transition-all"
            />
            <button type="submit" disabled={!input.trim()} className="w-9 h-9 rounded-xl bg-gradient-to-br from-[var(--accent-light)] to-[var(--accent)] flex items-center justify-center disabled:opacity-40 transition-opacity shrink-0 shadow-sm" aria-label="Send">
              <Send className="w-4 h-4 text-white" />
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
