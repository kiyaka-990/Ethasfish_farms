'use client';
import { useState } from 'react';
import { MessageCircle, Mail, Phone, MapPin, Send, Clock, Sparkles, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', contact: '', subject: 'general', message: '' });
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      toast.success("Message sent! We'll reply via WhatsApp shortly.");
      setSent(true);
      setForm({ name: '', contact: '', subject: 'general', message: '' });
      setLoading(false);
    }, 800);
  }

  const wa = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '254700000000';

  return (
    <div className="px-4 py-16">
      <div className="max-w-6xl mx-auto">
        {/* HEADER */}
        <div className="text-center mb-16 relative">
          <div className="orb orb-3 animate-float" style={{ top: '-50px', left: '50%', transform: 'translateX(-50%)' }} />
          <span className="section-label">Reach Us</span>
          <h1 className="section-title">Let's <span className="gradient-text">talk fish</span></h1>
          <p className="text-secondary mt-4 max-w-xl mx-auto">Questions about products, services, or partnerships? We're here.</p>
        </div>

        {/* QUICK ACTIONS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
          <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer" className="glass-card-interactive rounded-2xl p-5 text-center group">
            <div className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center transition-transform group-hover:scale-110" style={{background: 'linear-gradient(135deg, #25d366, #1fab56)'}}>
              <MessageCircle className="w-5 h-5 text-white" />
            </div>
            <p className="text-xs uppercase tracking-wider text-muted mb-1">WhatsApp</p>
            <p className="text-sm font-semibold text-primary">Chat instantly</p>
          </a>

          <a href="tel:+254737548998" className="glass-card-interactive rounded-2xl p-5 text-center group">
            <div className="w-12 h-12 rounded-2xl mx-auto mb-3 bg-gradient-to-br from-[var(--accent)]/20 to-[var(--accent-light)]/10 flex items-center justify-center transition-transform group-hover:scale-110">
              <Phone className="w-5 h-5 text-[var(--accent)]" />
            </div>
            <p className="text-xs uppercase tracking-wider text-muted mb-1">Phone</p>
            <p className="text-sm font-semibold text-primary">+254 737 548998</p>
            <p className="text-xs text-muted">+254 712 696427</p>
          </a>

          <a href="mailto:info@ethasfarms.co.ke" className="glass-card-interactive rounded-2xl p-5 text-center group">
            <div className="w-12 h-12 rounded-2xl mx-auto mb-3 bg-gradient-to-br from-[var(--accent)]/20 to-[var(--accent-light)]/10 flex items-center justify-center transition-transform group-hover:scale-110">
              <Mail className="w-5 h-5 text-[var(--accent)]" />
            </div>
            <p className="text-xs uppercase tracking-wider text-muted mb-1">Email</p>
            <p className="text-sm font-semibold text-primary">info@ethasfarms.co.ke</p>
          </a>

          <div className="glass-card-interactive rounded-2xl p-5 text-center">
            <div className="w-12 h-12 rounded-2xl mx-auto mb-3 bg-gradient-to-br from-[var(--accent)]/20 to-[var(--accent-light)]/10 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-[var(--accent)]" />
            </div>
            <p className="text-xs uppercase tracking-wider text-muted mb-1">Visit</p>
            <p className="text-sm font-semibold text-primary">Othany East, Seme</p>
          </div>
        </div>

        {/* FORM + INFO */}
        <div className="grid lg:grid-cols-5 gap-6">
          <form onSubmit={handleSubmit} className="lg:col-span-3 glass-strong rounded-3xl p-8 space-y-5 relative overflow-hidden">
            <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-gradient-to-br from-[var(--accent)]/15 to-transparent animate-blob" />

            <div className="relative">
              <h3 className="font-display text-xl font-semibold text-primary mb-1 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[var(--accent)]" /> Send a message
              </h3>
              <p className="text-sm text-muted">We typically reply within 1 hour during business hours.</p>
            </div>

            {sent && (
              <div className="relative glass rounded-xl p-4 flex items-center gap-3 border-green-500/30 border">
                <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                <p className="text-sm text-secondary">Thanks! We'll respond shortly via WhatsApp or email.</p>
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-4 relative">
              <div>
                <label className="text-[11px] uppercase tracking-wider text-muted mb-1.5 block">Name</label>
                <input className="input-glass" required value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Your name" />
              </div>
              <div>
                <label className="text-[11px] uppercase tracking-wider text-muted mb-1.5 block">Phone or Email</label>
                <input className="input-glass" required value={form.contact} onChange={e=>setForm({...form,contact:e.target.value})} placeholder="+254 7XX XXX XXX" />
              </div>
            </div>

            <div className="relative">
              <label className="text-[11px] uppercase tracking-wider text-muted mb-1.5 block">What can we help with?</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {[
                  { v: 'general', l: 'General' },
                  { v: 'order', l: 'Order' },
                  { v: 'fingerlings', l: 'Fingerlings' },
                  { v: 'consultancy', l: 'Consultancy' }
                ].map(o => (
                  <button key={o.v} type="button" onClick={() => setForm({...form, subject: o.v})}
                    className={`px-3 py-2 rounded-xl text-xs font-medium transition ${form.subject === o.v ? 'bg-gradient-to-br from-[#3B93CE] to-[#1C6EA8] text-white shadow-lg' : 'glass-soft hover:bg-[var(--surface-strong)]'}`}>
                    {o.l}
                  </button>
                ))}
              </div>
            </div>

            <div className="relative">
              <label className="text-[11px] uppercase tracking-wider text-muted mb-1.5 block">Message</label>
              <textarea rows={5} className="input-glass resize-none" required value={form.message} onChange={e=>setForm({...form,message:e.target.value})} placeholder="Tell us how we can help..." />
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full">
              <Send className="w-4 h-4" /> {loading ? 'Sending...' : 'Send Message'}
            </button>
          </form>

          <div className="lg:col-span-2 space-y-4">
            <div className="glass-strong rounded-3xl p-6 relative overflow-hidden">
              <div className="absolute -bottom-20 -left-20 w-48 h-48 rounded-full bg-gradient-to-br from-[var(--accent-soft)]/20 to-transparent animate-blob" />
              <div className="relative">
                <h3 className="font-display text-lg font-semibold mb-4">Business Hours</h3>
                <div className="space-y-3">
                  {[
                    { day: 'Monday – Friday', hours: '7:00am – 6:00pm' },
                    { day: 'Saturday', hours: '8:00am – 4:00pm' },
                    { day: 'Sunday', hours: 'Closed', closed: true }
                  ].map(s => (
                    <div key={s.day} className="flex items-center justify-between text-sm">
                      <span className="text-secondary flex items-center gap-2"><Clock className="w-3.5 h-3.5 text-[var(--accent)]"/>{s.day}</span>
                      <span className={s.closed ? 'text-muted' : 'text-primary font-medium'}>{s.hours}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="glass-strong rounded-3xl p-6 relative overflow-hidden bg-gradient-to-br from-[var(--accent)]/5 to-transparent">
              <h3 className="font-display text-lg font-semibold mb-2">Bulk orders?</h3>
              <p className="text-sm text-secondary mb-4">For restaurants, hotels, or wholesale orders — let's chat about volume pricing and scheduled delivery.</p>
              <a href={`https://wa.me/${wa}?text=Hi%20Ethasfish%2C%20I'd%20like%20to%20discuss%20bulk%20orders.`} target="_blank" rel="noopener noreferrer" className="btn-primary text-sm w-full">
                <MessageCircle className="w-4 h-4" /> Chat on WhatsApp
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
