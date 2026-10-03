import Link from 'next/link';
import { ArrowRight, Fish, Leaf, Award, Truck, Shield, Sparkles, Apple, Smartphone, GraduationCap, Wheat, Microscope } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { getSiteContent } from '@/lib/content';
import ProductCard from '@/components/ProductCard';
import HeroCarousel, { DEFAULT_HERO_SLIDES } from '@/components/HeroCarousel';

async function getProducts() {
  return prisma.product.findMany({
    where: { active: true },
    include: { variants: { where: { active: true }, orderBy: { sortOrder: 'asc' } } },
    orderBy: { sortOrder: 'asc' }
  });
}

export default async function HomePage() {
  const [products, hero] = await Promise.all([
    getProducts().catch(() => []),
    getSiteContent('home.hero', { slides: DEFAULT_HERO_SLIDES })
  ]);

  return (
    <div className="relative">
      <HeroCarousel slides={hero.slides} />

      {/* TRUST STRIP */}
      <section className="px-4 py-12 mt-12">
        <div className="max-w-6xl mx-auto glass rounded-3xl p-6 flex flex-wrap items-center justify-around gap-6">
          {[
            { Icon: Fish, label: 'Lake Victoria Cages' },
            { Icon: Leaf, label: 'Hormone & Chemical Free' },
            { Icon: Award, label: 'Premium 7–10 Month Reared' },
            { Icon: Truck, label: 'Same-day Kisumu Delivery' },
            { Icon: Shield, label: 'M-Pesa Secure Payment' }
          ].map(({ Icon, label }) => (
            <div key={label} className="flex items-center gap-2 text-sm">
              <div className="w-9 h-9 rounded-xl glass-soft flex items-center justify-center">
                <Icon className="w-4 h-4 text-[var(--accent)]" />
              </div>
              <span className="text-secondary">{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* PRODUCTS */}
      <section className="px-4 py-24" id="products">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <span className="section-label">Fresh from the Lake</span>
            <h2 className="section-title mb-4">Our <span className="gradient-text">Tilapia Range</span></h2>
            <p className="text-secondary max-w-xl mx-auto">From whole fish to ready-to-cook fillets — choose your size, add to cart, pay with M-Pesa.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((p: any, i: number) => <ProductCard key={p.id} product={p} index={i} />)}
          </div>
          <div className="text-center mt-12">
            <Link href="/shop" className="btn-glass">View All Products <ArrowRight className="w-4 h-4" /></Link>
          </div>
        </div>
      </section>

      {/* SERVICES PREVIEW */}
      <section className="px-4 py-24">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="section-label">Beyond Fish</span>
            <h2 className="section-title mb-4">Full <span className="gradient-text">aquaculture</span> support</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { Icon: Microscope, title: 'Hatchery & Fingerlings', desc: 'Disease-free Nile Tilapia fingerlings from our certified hatchery.', img: 'https://images.unsplash.com/photo-1769771861175-2cdcdf5108db?w=600&q=80' },
              { Icon: Wheat, title: 'Quality Fish Feeds', desc: 'High-protein 25% crude protein floating pellets for every growth stage.', img: 'https://images.unsplash.com/photo-1731552466988-26d1dbeff4ee?w=600&q=80' },
              { Icon: GraduationCap, title: 'Aquaculture Consultancy', desc: 'Expert advice on pond design, stocking, feeding, and harvest.', img: 'https://images.unsplash.com/photo-1758535012952-67e5f5f133e7?w=600&q=80' }
            ].map(({ Icon, title, desc, img }, i) => (
              <Link key={title} href="/services" className="glass-card-interactive rounded-3xl overflow-hidden animate-fade-up" style={{ animationDelay: `${i * 100}ms` }}>
                <div className="relative h-48 overflow-hidden">
                  <div className="absolute inset-0 bg-cover bg-center transition-transform duration-700 hover:scale-110" style={{ backgroundImage: `url('${img}')` }} />
                  <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-primary)]/70 to-transparent" />
                  <div className="absolute bottom-3 left-3 w-12 h-12 rounded-2xl glass-strong flex items-center justify-center">
                    <Icon className="w-5 h-5 text-[var(--accent)]" />
                  </div>
                </div>
                <div className="p-6">
                  <h3 className="font-display text-lg font-semibold text-primary mb-2">{title}</h3>
                  <p className="text-sm text-secondary leading-relaxed">{desc}</p>
                  <div className="mt-4 inline-flex items-center gap-1 text-sm text-[var(--accent)] font-medium">
                    Learn more <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* WHY US */}
      <section className="px-4 py-24">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="section-label">Why Ethasfish</span>
            <h2 className="section-title">Quality you can <span className="gradient-text">taste</span></h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { Icon: Fish, title: '7–10 Month Patient Rearing', desc: 'Slow, natural growth gives our tilapia firmer texture and superior flavour.' },
              { Icon: Leaf, title: '25% Crude Protein Feed', desc: 'High-quality feed in greened water achieves 100g growth in 3 months.' },
              { Icon: Award, title: 'Lake Victoria Offshore Cages', desc: 'Natural water flow and 4–6.67 fish/m² density means stress-free fish.' },
              { Icon: Shield, title: 'Zero Hormones, Zero Plastic', desc: 'No chemicals or hormones — ever. Plus zero plastic in our packaging.' },
              { Icon: Truck, title: 'Fast Local Delivery', desc: 'Same-day delivery across Kisumu County. Pay with M-Pesa.' },
              { Icon: Sparkles, title: 'Lean Protein Powerhouse', desc: 'Rich in selenium, potassium, phosphorus, and B12 — only 96 cal/100g.' }
            ].map(({ Icon, title, desc }, i) => (
              <div key={title} className="glass-card-interactive rounded-3xl p-6 animate-fade-up" style={{ animationDelay: `${i * 80}ms` }}>
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[var(--accent-soft)]/30 to-[var(--accent)]/10 flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5 text-[var(--accent)]" />
                </div>
                <h3 className="font-semibold text-primary mb-2">{title}</h3>
                <p className="text-sm text-secondary leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* APP DOWNLOAD */}
      <section className="px-4 py-24">
        <div className="max-w-5xl mx-auto relative">
          <div className="orb orb-3 animate-float" style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />
          <div className="relative glass-strong rounded-3xl p-12 md:p-16 text-center overflow-hidden">
            <div className="absolute inset-0 opacity-30 bg-gradient-to-br from-[var(--accent)]/20 via-transparent to-[var(--accent-light)]/20" />
            <div className="relative">
              <span className="badge mb-6"><Smartphone className="w-3 h-3" /> Mobile App</span>
              <h2 className="section-title mb-4">Order on the <span className="gradient-text">go</span></h2>
              <p className="text-secondary max-w-md mx-auto mb-10">Download the Ethasfish app for faster ordering, push notifications, and exclusive app-only deals.</p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <a href="#" className="btn-glass !px-6 !py-4">
                  <Apple className="w-7 h-7" />
                  <div className="text-left">
                    <div className="text-[10px] text-muted">Download on the</div>
                    <div className="text-base font-semibold">App Store</div>
                  </div>
                </a>
                <a href="#" className="btn-glass !px-6 !py-4">
                  <svg viewBox="0 0 24 24" className="w-7 h-7 fill-current"><path d="M3.18 23.76c.28.16.6.19.9.07l12.44-7.04-2.79-2.79-10.55 9.76zM.5 1.02C.18 1.36 0 1.88 0 2.56v18.88c0 .68.18 1.2.5 1.54l.08.07 10.57-10.57v-.24L.58.95.5 1.02zM20.43 10.21l-2.85-1.62-3.16 3.16 3.16 3.16 2.87-1.63c.82-.46.82-1.21-.02-1.67zm-19.25 12L13.62 11.77 10.84 9l-9.66 12.21z"/></svg>
                  <div className="text-left">
                    <div className="text-[10px] text-muted">Get it on</div>
                    <div className="text-base font-semibold">Google Play</div>
                  </div>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
