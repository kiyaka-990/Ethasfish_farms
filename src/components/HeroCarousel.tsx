import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight } from 'lucide-react';

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
    media: { type: 'image', url: 'https://images.unsplash.com/photo-1758656911249-c0f1af7dcaec?w=1920&q=85' },
    badge: 'Fresh from Lake Victoria',
    titlePre: 'Premium Nile Tilapia,',
    titleAccent: 'Lake-to-Table.',
    subtitle: 'Sustainably farmed in offshore cages at Othany East, Seme. Hormone-free, chemical-free, zero plastic packaging.',
    primaryHref: '/shop',
    primaryLabel: 'Shop Fresh Fish'
  }
];

// Single, full-bleed hero statement (no carousel chrome) - admins can swap
// the image/video and copy from Admin > Site Content. The slides array is
// kept for data-shape compatibility; only the first entry is rendered.
export default function HeroCarousel({ slides = DEFAULT_HERO_SLIDES }: { slides?: HeroSlide[] }) {
  const s = slides[0] ?? DEFAULT_HERO_SLIDES[0];

  return (
    <section className="relative min-h-[92vh] flex items-center justify-center overflow-hidden">
      <div className="absolute inset-0">
        {s.media.type === 'video' ? (
          <video
            className="absolute inset-0 w-full h-full object-cover animate-ken-burns"
            src={s.media.url}
            poster={s.media.poster}
            autoPlay
            muted
            loop
            playsInline
          />
        ) : (
          <Image src={s.media.url} alt="" fill priority sizes="100vw" className="object-cover animate-ken-burns" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/45 to-[#040C1A]/90" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/50 via-transparent to-transparent" />
      </div>

      <div className="relative max-w-4xl mx-auto px-4 text-center z-10">
        <h1 className="font-display text-5xl md:text-7xl lg:text-8xl font-bold leading-[0.95] tracking-tight text-white [text-shadow:0_2px_24px_rgba(0,0,0,0.35)]">
          {s.titlePre}<br />
          <span className="gradient-text">{s.titleAccent}</span>
        </h1>
        <p className="mt-7 text-lg md:text-xl text-white/85 max-w-2xl mx-auto leading-relaxed [text-shadow:0_1px_12px_rgba(0,0,0,0.3)]">{s.subtitle}</p>
        <div className="mt-9">
          <Link href={s.primaryHref} className="btn-primary text-base">
            {s.primaryLabel} <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
