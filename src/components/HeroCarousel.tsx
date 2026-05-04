'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';

const slides = [
  {
    image: 'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=1600&q=80',
    badge: 'Fresh from Lake Victoria',
    titlePre: 'Premium Nile Tilapia',
    titleAccent: 'Lake-to-Table.',
    subtitle: 'Sustainably farmed in offshore cages at Othany East, Seme. Hormone-free, chemical-free, zero plastic packaging.',
    primaryHref: '/shop',
    primaryLabel: 'Shop Fresh Fish'
  },
  {
    image: 'https://images.unsplash.com/photo-1545816250-e12bedba42ba?w=1600&q=80',
    badge: 'Hatchery & Fingerlings',
    titlePre: 'Disease-free fingerlings,',
    titleAccent: 'ready to stock.',
    subtitle: 'Certified Nile Tilapia fingerlings from our dedicated hatchery — 3–5cm, available in batches of 100, 500, and 1,000.',
    primaryHref: '/services',
    primaryLabel: 'Explore Services'
  },
  {
    image: 'https://images.unsplash.com/photo-1518545300995-3c3e3a72e64a?w=1600&q=80',
    badge: 'Aquaculture Consultancy',
    titlePre: 'From pond design to',
    titleAccent: 'profitable harvest.',
    subtitle: 'We help farmers across the region set up and run successful tilapia operations — feed, training, fingerlings, and ongoing support.',
    primaryHref: '/services',
    primaryLabel: 'Get Consultation'
  },
  {
    image: 'https://images.unsplash.com/photo-1580651207-26d76d3eecd6?w=1600&q=80',
    badge: 'Order Online',
    titlePre: 'Pay with M-Pesa,',
    titleAccent: 'delivered fresh.',
    subtitle: 'Same-day delivery across Kisumu County. Browse, add to cart, pay via STK push — it really is that simple.',
    primaryHref: '/shop',
    primaryLabel: 'Browse Shop'
  }
];

export default function HeroCarousel() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setActive(i => (i + 1) % slides.length), 6000);
    return () => clearInterval(id);
  }, [paused]);

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
        {slides.map((s, i) => (
          <div
            key={i}
            className={`fade-slide ${i === active ? 'active' : ''}`}
            aria-hidden={i !== active}
          >
            <div
              className="absolute inset-0 bg-cover bg-center animate-ken-burns"
              style={{ backgroundImage: `url('${s.image}')` }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-[var(--bg-primary)]/40 via-[var(--bg-primary)]/60 to-[var(--bg-primary)]/95" />
            <div className="absolute inset-0 bg-gradient-to-r from-[var(--bg-primary)]/60 via-transparent to-transparent" />
          </div>
        ))}
      </div>

      <div className="orb orb-1 animate-float" />
      <div className="orb orb-2 animate-float-delay" />

      <div className="relative max-w-5xl mx-auto px-4 text-center z-10">
        {slides.map((s, i) => (
          <div
            key={i}
            className={`transition-all duration-1000 ${i === active ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6 absolute inset-x-4 pointer-events-none'}`}
            aria-hidden={i !== active}
          >
            <div className="inline-flex items-center gap-2 mb-6">
              <span className="badge">
                <Sparkles className="w-3 h-3" /> {s.badge}
              </span>
            </div>
            <h1 className="font-display text-5xl md:text-7xl lg:text-8xl font-bold leading-[0.95] tracking-tight">
              {s.titlePre}<br/>
              <span className="gradient-text">{s.titleAccent}</span>
            </h1>
            <p className="mt-7 text-lg md:text-xl text-secondary max-w-2xl mx-auto leading-relaxed">{s.subtitle}</p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Link href={s.primaryHref} className="btn-primary text-base">
                {s.primaryLabel} <ArrowRight className="w-4 h-4" />
              </Link>
              <Link href="/farm" className="btn-glass text-base">Discover Our Farm</Link>
            </div>
          </div>
        ))}

        {/* Dots */}
        <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 flex items-center gap-2">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className={`h-2 rounded-full transition-all ${i === active ? 'w-10 bg-[var(--accent)]' : 'w-2 bg-[var(--border-color)] hover:bg-[var(--accent-soft)]'}`}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
