'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Tag, Fish, Package, Megaphone, X, ArrowRight } from 'lucide-react';

interface Promo { id: string; type: string; message: string; ctaLabel: string | null; ctaHref: string | null; }

const ICONS: Record<string, typeof Tag> = { sale: Tag, harvest: Fish, restock: Package, announcement: Megaphone };
const DISMISS_KEY = 'ethasfish-promo-dismissed';

// Site-wide promo strip, staff-managed from Admin > Promotions. Sets a CSS
// var (--promo-bar-h) that the fixed Navbar and page padding read, so the
// layout only shifts down when there's actually something to show.
export default function AnnouncementBar() {
  const [promos, setPromos] = useState<Promo[]>([]);
  const [dismissed, setDismissed] = useState(true); // default true until we know better, so nothing flashes
  const [index, setIndex] = useState(0);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDismissed(sessionStorage.getItem(DISMISS_KEY) === '1');
    fetch('/api/promotions').then(r => r.json()).then(d => setPromos(d.promotions || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (promos.length < 2) return;
    const t = setInterval(() => setIndex(i => (i + 1) % promos.length), 5000);
    return () => clearInterval(t);
  }, [promos.length]);

  const visible = !dismissed && promos.length > 0;

  useEffect(() => {
    function sync() {
      document.documentElement.style.setProperty('--promo-bar-h', visible && barRef.current ? `${barRef.current.offsetHeight}px` : '0px');
    }
    sync();
    window.addEventListener('resize', sync);
    return () => {
      window.removeEventListener('resize', sync);
      document.documentElement.style.setProperty('--promo-bar-h', '0px');
    };
  }, [visible, index]);

  if (!visible) return null;
  const p = promos[index % promos.length];
  const Icon = ICONS[p.type] || Megaphone;

  return (
    <div ref={barRef} className="fixed top-0 left-0 right-0 z-[60] bg-gradient-to-r from-[#1C6EA8] to-[#3B93CE] text-white">
      <div className="mx-auto max-w-7xl px-4 py-2 flex items-center justify-center gap-2.5 text-sm relative">
        <Icon className="w-4 h-4 shrink-0" />
        <p className="text-center">
          {p.message}
          {p.ctaLabel && p.ctaHref && (
            <Link href={p.ctaHref} className="ml-2 font-semibold underline underline-offset-2 inline-flex items-center gap-0.5">
              {p.ctaLabel} <ArrowRight className="w-3 h-3" />
            </Link>
          )}
        </p>
        <button
          onClick={() => { sessionStorage.setItem(DISMISS_KEY, '1'); setDismissed(true); }}
          className="absolute right-2 sm:right-4 p-1 rounded-full hover:bg-white/15 transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
