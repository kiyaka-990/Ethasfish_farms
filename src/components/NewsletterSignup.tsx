'use client';
import { useState } from 'react';
import { Mail, Check, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function NewsletterSignup() {
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim()) return;
    setLoading(true);
    const isEmail = value.includes('@');
    const res = await fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(isEmail ? { email: value.trim() } : { phone: value.trim() })
    });
    setLoading(false);
    if (res.ok) { setDone(true); toast.success('You\'re on the list!'); }
    else toast.error('Something went wrong — try again.');
  }

  if (done) {
    return (
      <div className="flex items-center justify-center gap-2 text-green-600 font-medium">
        <Check className="w-5 h-5" /> Thanks — we'll keep you posted on new harvests and offers.
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-center justify-center gap-3 max-w-md mx-auto">
      <input
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder="Email or phone number"
        className="input-glass !py-3 text-sm flex-1 min-w-[220px]"
      />
      <button type="submit" disabled={loading} className="btn-primary !py-3">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />} Notify Me
      </button>
    </form>
  );
}
