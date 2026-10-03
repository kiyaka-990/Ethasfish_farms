'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Sparkles, Pause, Play } from 'lucide-react';

export interface HeroSlide {
  id: string;
  media: { type: 'image' | 'video'; url: string; poster?: string };
  badge: string;
  titlePre: string;
  titleAccent: string;
  subtitle: string;
  primaryHref: string;
  primaryLabel: string;
}

export const DEFAULT_HERO_SLIDES: HeroSlide[] = [
  {
    id: 'lake-to-table',
    media: { type: 'image', url: 'https://images.unsplash.com/photo-1758656911249-c0f1af7dcaec?w=1600&q=80' },
    badge: 'Fresh from Lake Victoria',
    titlePre: 'Premium Nile Tilapia',
    titleAccent: 'Lake-to-Table.',
    subtitle: 'Sustainably farmed in offshore cages at Othany East, Seme. Hormone-free, chemical-free, zero plastic packaging.',
    primaryHref: '/shop',
    primaryLabel: 'Shop Fresh Fish'
  },
  {
    id: 'hatchery',
    media: { type: 'image', url: 'https://images.unsplash.com/photo-1769771861175-2cdcdf5108db?w=1600&q=80' },
    badge: 'Hatchery & Fingerlings',
    titlePre: 'Disease-free fingerlings,',
    titleAccent: 'ready to stock.',
    subtitle: 'Certified Nile Tilapia fingerlings from our dedicated hatchery — 3–5cm, available in batches of 100, 500, and 1,000.',
    primaryHref: '/services',
    primaryLabel: 'Explore Services'
  },
  {
    id: 'consultancy',
    media: { type: 'image', url: 'https://images.unsplash.com/photo-1758535012952-67e5f5f133e7?w=1600&q=80' },
    badge: 'Aquaculture Consultancy',
    titlePre: 'From pond design to',
    titleAccent: 'profitable harvest.',
    subtitle: 'We help farmers across the region set up and run successful tilapia operations — feed, training, fingerlings, and ongoing support.',
    primaryHref: '/services',
    primaryLabel: 'Get Consultation'
  },
  {
    id: 'order-online',
    media: { type: 'image', url: 'https://images.unsplash.com/photo-1735053671690-97833aac117a?w=1600&q=80' },
    badge: 'Order Online',
    titlePre: 'Pay with M-Pesa,',
    titleAccent: 'delivered fresh.',
    subtitle: 'Same-day delivery across Kisumu County. Browse, add to cart, pay via STK push — it really is that simple.',
    primaryHref: '/shop',
    primaryLabel: 'Browse Shop'
  }
];

export default function HeroCarousel({ slides = DEFAULT_HERO_SLIDES }: { slides?: HeroSlide[] }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const list = slides.length ? slides : DEFAULT_HERO_SLIDES;

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setActive(i => (i + 1) % list.length), 7000);
    return () => clearInterval(id);
  }, [paused, list.length]);

  return (
    <section
      className="relative min-h-[92vh] flex items-center justify-center overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carousel"
      aria-label="Featured highlights"
    >
      {/* Background slides */}
      <div className="absolute inset-0">
        {list.map((s, i) => {
          const near = Math.abs(i - active) <= 1 || (active === 0 && i === list.length - 1) || (active === list.length - 1 && i === 0);
          return (
            <div key={s.id} className={`fade-slide ${i === active ? 'active' : ''}`} aria-hidden={i !== active}>
              {s.media.type === 'video' ? (
                near ? (
                  <video
                    className="absolute inset-0 w-full h-full object-cover animate-ken-burns"
                    src={s.media.url}
                    poster={s.media.poster}
                    autoPlay={i === active}
                    muted
                    loop
                    playsInline
                    preload={i === active ? 'auto' : 'metadata'}
                  />
                ) : (
                  <div className="absolute inset-0 w-full h-full bg-[var(--bg-secondary)]" />
                )
              ) : (
                <Image
                  src={s.media.url}
                  alt=""
                  fill
                  priority={i === 0}
                  loading={i === 0 ? undefined : 'lazy'}
                  sizes="100vw"
                  className="object-cover animate-ken-burns"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/45 to-[#051a13]/90" />
              <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-transparent to-transparent" />
            </div>
          );
        })}
      </div>

      <div className="orb orb-1 animate-float" />
      <div className="orb orb-2 animate-float-delay" />

      <div className="relative max-w-5xl mx-auto px-4 text-center z-10">
        {list.map((s, i) => (
          <div
            key={s.id}
            className={`transition-all duration-1000 ${i === active ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6 absolute inset-x-4 pointer-events-none'}`}
            aria-hidden={i !== active}
          >
            <div className="inline-flex items-center gap-2 mb-6">
              <span className="badge !bg-white/10 !border-white/25 !text-white">
                <Sparkles className="w-3 h-3" /> {s.badge}
              </span>
            </div>
            <h1 className="font-display text-5xl md:text-7xl lg:text-8xl font-bold leading-[0.95] tracking-tight text-white [text-shadow:0_2px_24px_rgba(0,0,0,0.35)]">
              {s.titlePre}<br />
              <span className="gradient-text">{s.titleAccent}</span>
            </h1>
            <p className="mt-7 text-lg md:text-xl text-white/85 max-w-2xl mx-auto leading-relaxed [text-shadow:0_1px_12px_rgba(0,0,0,0.3)]">{s.subtitle}</p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Link href={s.primaryHref} className="btn-primary text-base">
                {s.primaryLabel} <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/farm" className="btn-glass text-base">Discover Our Farm</Link>
            </div>
          </div>
        ))}

        {/* Controls */}
        <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 flex items-center gap-3">
          <button
            onClick={() => setPaused(p => !p)}
            className="w-7 h-7 rounded-full flex items-center justify-center glass-soft hover:bg-[var(--surface-strong)] transition-colors"
            aria-label={paused ? 'Resume slideshow' : 'Pause slideshow'}
            aria-pressed={paused}
          >
            {paused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
          </button>
          <div className="flex items-center gap-2">
            {list.map((s, i) => (
              <button
                key={s.id}
                onClick={() => setActive(i)}
                className={`h-2 rounded-full transition-all ${i === active ? 'w-10 bg-[var(--accent)]' : 'w-2 bg-[var(--border-color)] hover:bg-[var(--accent-soft)]'}`}
                aria-label={`Go to slide ${i + 1}: ${s.titlePre} ${s.titleAccent}`}
                aria-current={i === active ? 'true' : undefined}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
