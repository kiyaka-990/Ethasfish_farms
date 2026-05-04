import Link from 'next/link';
import { Microscope, Wheat, GraduationCap, ArrowRight, CheckCircle2, Users, Clock, Award } from 'lucide-react';

export const metadata = { title: 'Services — Hatchery, Feeds & Consultancy' };

const services = [
  {
    id: 'hatchery',
    Icon: Microscope,
    title: 'Hatchery & Fingerlings',
    tagline: 'Disease-free Nile Tilapia fingerlings — direct from our hatchery',
    image: 'https://images.unsplash.com/photo-1567899378494-47b22a2ae96a?w=1200&q=80',
    description: 'Our dedicated Nile Tilapia hatchery produces certified, disease-free fingerlings ready for stocking. We carefully select brood stock, manage incubation in controlled tanks, and grade fingerlings before delivery.',
    bullets: [
      '3–5cm size, ready to stock',
      'Available in 100, 500, and 1,000+ batches',
      'Free survival guidance for first 2 weeks',
      'Bulk pricing for cooperatives & schools',
      'Delivery available across Western Kenya'
    ],
    cta: { label: 'Order Fingerlings', href: '/shop?type=fingerling' }
  },
  {
    id: 'feeds',
    Icon: Wheat,
    title: 'Quality Fish Feeds',
    tagline: 'High-protein floating pellets for every growth stage',
    image: 'https://images.unsplash.com/photo-1565374391884-ce0a8d6e3ddb?w=1200&q=80',
    description: 'Premium fish feed formulated specifically for Nile Tilapia. Our 25% crude protein floating pellets are tested in our own ponds and proven to deliver ~100g growth in three months.',
    bullets: [
      'Starter, grower, and finisher pellet sizes',
      '25% crude protein optimised for tilapia',
      'Floating pellets reduce waste',
      'No hormones or antibiotics',
      'Available in 25kg, 50kg bags or bulk'
    ],
    cta: { label: 'Enquire About Feed', href: '/contact' }
  },
  {
    id: 'consultancy',
    Icon: GraduationCap,
    title: 'Aquaculture Consultancy',
    tagline: 'From pond design to profitable harvest — we guide you',
    image: 'https://images.unsplash.com/photo-1544942479-2e9d96e4f0e3?w=1200&q=80',
    description: 'Whether you\'re starting a small backyard pond or a commercial cage operation, our team provides end-to-end consultancy. We share what works — and what doesn\'t — based on real Lake Victoria experience.',
    bullets: [
      'Site assessment & feasibility studies',
      'Pond and cage design',
      'Stocking density & feed planning',
      'Water quality management training',
      'Harvest planning & market linkage'
    ],
    cta: { label: 'Book a Consultation', href: '/contact' }
  }
];

export default function ServicesPage() {
  return (
    <div>
      {/* HERO */}
      <section className="relative px-4 pt-12 pb-16 overflow-hidden">
        <div className="orb orb-1 animate-float" />
        <div className="orb orb-2 animate-float-delay" />
        <div className="relative max-w-4xl mx-auto text-center">
          <span className="section-label">Our Services</span>
          <h1 className="section-title mb-6">Beyond the fish — a <span className="gradient-text">full aquaculture partner</span></h1>
          <p className="text-secondary text-lg max-w-2xl mx-auto">
            We don't just sell tilapia. We grow it, hatch it, feed it, and help you do the same.
          </p>
        </div>
      </section>

      {/* IMPACT STATS */}
      <section className="px-4 mb-24">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { Icon: Users, v: '120+', l: 'Farmers Served' },
            { Icon: CheckCircle2, v: '10K+', l: 'Fingerlings/month' },
            { Icon: Clock, v: '7–10', l: 'Months Rearing' },
            { Icon: Award, v: '5+', l: 'Years Experience' }
          ].map(({ Icon, v, l }, i) => (
            <div key={l} className="glass-card-interactive rounded-2xl p-5 text-center animate-fade-up" style={{ animationDelay: `${i * 80}ms` }}>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--accent-soft)]/30 to-[var(--accent)]/10 flex items-center justify-center mx-auto mb-2">
                <Icon className="w-4 h-4 text-[var(--accent)]" />
              </div>
              <div className="font-display text-2xl font-bold gradient-text">{v}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted mt-1">{l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* SERVICES */}
      <section className="px-4 pb-24 space-y-20">
        <div className="max-w-6xl mx-auto space-y-20">
          {services.map((s, i) => {
            const reverse = i % 2 === 1;
            return (
              <div key={s.id} id={s.id} className={`grid md:grid-cols-2 gap-8 items-center ${reverse ? 'md:grid-flow-dense' : ''}`}>
                <div className={`relative h-80 rounded-3xl overflow-hidden glass-card-interactive ${reverse ? 'md:col-start-2' : ''}`}>
                  <div className="absolute inset-0 bg-cover bg-center transition-transform duration-700 hover:scale-110 animate-ken-burns" style={{ backgroundImage: `url('${s.image}')` }} />
                  <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-primary)]/60 via-transparent to-transparent" />
                  <div className="absolute bottom-4 left-4 w-14 h-14 rounded-2xl glass-strong flex items-center justify-center">
                    <s.Icon className="w-6 h-6 text-[var(--accent)]" />
                  </div>
                </div>

                <div className="space-y-4">
                  <span className="badge"><s.Icon className="w-3 h-3" /> Service {i + 1}</span>
                  <h2 className="font-display text-3xl md:text-4xl font-bold text-primary">{s.title}</h2>
                  <p className="text-[var(--accent)] font-medium">{s.tagline}</p>
                  <p className="text-secondary leading-relaxed">{s.description}</p>
                  <ul className="space-y-2 pt-2">
                    {s.bullets.map(b => (
                      <li key={b} className="flex items-start gap-2 text-sm text-secondary">
                        <CheckCircle2 className="w-4 h-4 text-[var(--accent)] mt-0.5 flex-shrink-0" />
                        {b}
                      </li>
                    ))}
                  </ul>
                  <Link href={s.cta.href} className="btn-primary mt-4">
                    {s.cta.label} <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 pb-24">
        <div className="max-w-4xl mx-auto glass-strong rounded-3xl p-12 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[var(--accent)]/10 via-transparent to-[var(--accent-light)]/10" />
          <div className="relative">
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">Ready to grow with us?</h2>
            <p className="text-secondary mb-8 max-w-xl mx-auto">Whether you need fingerlings, feed, or expert advice — we're here. Reach out via WhatsApp or book a visit to our farm.</p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link href="/contact" className="btn-primary">Get in Touch <ArrowRight className="w-4 h-4" /></Link>
              <Link href="/farm" className="btn-glass">Visit Our Farm</Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
