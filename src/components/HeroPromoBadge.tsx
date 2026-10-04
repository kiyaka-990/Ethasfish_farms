'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';

interface Promo { message: string; ctaHref: string | null; }

// Shows the most recent active promotion as a pill above the hero
// headline. Hidden entirely when nothing's active - same data source as
// the top announcement bar and the chatbot, just a second, more
// attention-grabbing placement for whatever's currently live.
export default function HeroPromoBadge() {
  const [promo, setPromo] = useState<Promo | null>(null);

  useEffect(() => {
    fetch('/api/promotions').then(r => r.json()).then(d => setPromo(d.promotions?.[0] || null)).catch(() => {});
  }, []);

  if (!promo) return null;

  const pill = (
    <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-white/15 hover:bg-white/20 backdrop-blur-sm border border-white/25 text-white text-sm font-medium transition-colors animate-fade-up">
      <Sparkles className="w-3.5 h-3.5 text-[var(--accent-light)]" /> {promo.message}
    </span>
  );

  return (
    <div className="mb-6">
      {promo.ctaHref ? <Link href={promo.ctaHref}>{pill}</Link> : pill}
    </div>
  );
}
