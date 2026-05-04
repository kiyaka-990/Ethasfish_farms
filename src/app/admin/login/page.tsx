'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Loader2, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import Logo from '@/components/Logo';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      toast.success('Welcome back!');
      router.push('/admin');
      router.refresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16 -mt-16">
      <div className="orb orb-1 animate-float" />
      <div className="orb orb-2 animate-float-delay" />

      <div className="relative w-full max-w-md">
        <div className="text-center mb-6">
          <Logo size={56} />
        </div>

        <form onSubmit={handleSubmit} className="glass-strong rounded-3xl p-8 space-y-5">
          <div className="text-center">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-[#1eb5a6]/20 to-[#0e8c7f]/10 flex items-center justify-center mb-3">
              <ShieldCheck className="w-6 h-6 text-[var(--accent)]" />
            </div>
            <h1 className="font-display text-2xl font-bold text-primary">Admin Sign In</h1>
            <p className="text-sm text-muted mt-1">Manage products, orders & FAQs</p>
          </div>

          <div>
            <label className="text-[11px] uppercase tracking-wider text-muted mb-1.5 block">Email</label>
            <input type="email" required className="input-glass" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@ethasfish.co.ke" />
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-wider text-muted mb-1.5 block">Password</label>
            <input type="password" required className="input-glass" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
            {loading ? 'Signing in...' : 'Sign In'}
          </button>

          <p className="text-center text-[11px] text-primary/30">Default: admin@ethasfish.co.ke / changeme123 (after seeding)</p>
        </form>
      </div>
    </div>
  );
}
