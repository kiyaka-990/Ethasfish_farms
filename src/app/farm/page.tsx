import { MapPin, Clock, Phone, Heart, Brain, Bone, Dumbbell } from 'lucide-react';

export const metadata = { title: 'Our Farm at Othany East' };

const galleryImages = [
  { src: 'https://images.unsplash.com/photo-1758656911249-c0f1af7dcaec?w=800&q=80', caption: 'Lake Victoria offshore cages' },
  { src: 'https://images.unsplash.com/photo-1731552466988-26d1dbeff4ee?w=800&q=80', caption: 'Freshwater rearing ponds' },
  { src: 'https://images.unsplash.com/photo-1738850305638-b2f1765a4a87?w=800&q=80', caption: 'Premium harvest-ready tilapia' },
  { src: 'https://images.unsplash.com/photo-1769771861175-2cdcdf5108db?w=800&q=80', caption: 'Hatchery & fingerling production' }
];

const nutrients = [
  { label: 'Protein', value: '26g', pct: 80 },
  { label: 'Selenium', value: '54mcg', pct: 90 },
  { label: 'Potassium', value: '380mg', pct: 60 },
  { label: 'Phosphorus', value: '204mg', pct: 72 },
  { label: 'Vitamin B12', value: '1.7mcg', pct: 55 },
  { label: 'Calories', value: '96 kcal', pct: 28 },
  { label: 'Total Fat', value: '2.3g', pct: 15 }
];

export default function FarmPage() {
  return (
    <div>
      {/* HERO with parallax image */}
      <section className="relative h-[60vh] min-h-[420px] overflow-hidden">
        <div className="absolute inset-0 bg-cover bg-center animate-ken-burns" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1758656911249-c0f1af7dcaec?w=1600&q=85')" }} />
        <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/40 to-[var(--bg-primary)]" />
        <div className="absolute inset-0 flex items-center justify-center text-center px-4">
          <div>
            <span className="badge mb-4 backdrop-blur-md !bg-white/10 !border-white/25 !text-white">Ethasfish Farms</span>
            <h1 className="font-display text-5xl md:text-7xl font-bold leading-tight text-white [text-shadow:0_2px_24px_rgba(0,0,0,0.35)]">
              Sustainable aquaculture<br/>
              <span className="gradient-text">on Lake Victoria</span>
            </h1>
            <p className="mt-4 text-white/85 max-w-xl mx-auto [text-shadow:0_1px_12px_rgba(0,0,0,0.3)]">Othany East · Seme Sub-County · Kisumu County</p>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="px-4 -mt-20 relative z-10 mb-20">
        <div className="max-w-5xl mx-auto glass-strong rounded-3xl p-8 grid grid-cols-2 md:grid-cols-3 gap-4">
          {[
            { v: '3–5 cm', l: 'Stocking size' },
            { v: '7–10 mo', l: 'Rearing period' },
            { v: '4–6.67', l: 'Fish per m²' },
            { v: '100g', l: 'Growth in 3 mo' },
            { v: '25%', l: 'Crude protein' },
            { v: '0', l: 'Plastic waste' }
          ].map((s, i) => (
            <div key={i} className="glass-card-interactive rounded-2xl p-5 text-center animate-fade-up" style={{animationDelay:`${i*50}ms`}}>
              <div className="font-display text-2xl md:text-3xl font-bold gradient-text">{s.v}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted mt-1">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* STORY + GALLERY */}
      <section className="px-4 mb-24">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-10 items-center">
          <div>
            <span className="section-label">Our Story</span>
            <h2 className="section-title mb-6">From fingerling <span className="gradient-text">to table</span></h2>
            <div className="space-y-4 text-secondary leading-relaxed">
              <p>Tilapia are stocked in our production ponds at just 3–5cm and reared for 7–10 months. Stocking density (4–6.67 fish/m²) is calculated based on carrying capacity, feed quality, ration, water management, and rearing period.</p>
              <p>Feeding with 25% crude protein in greened water, our tilapia achieve up to 100g growth in three months. Lake Victoria's offshore cages provide ideal natural conditions.</p>
              <p>We also operate a dedicated Nile Tilapia fingerling production programme — supplying disease-free fingerlings to other farms across the region.</p>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              {['Nile Tilapia', 'Offshore Cages', 'Freshwater Ponds', 'Hatchery', 'Greened Water', 'Sustainable'].map(t => (
                <span key={t} className="badge">{t}</span>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {galleryImages.map((g, i) => (
              <div key={i} className="relative h-44 md:h-52 rounded-2xl overflow-hidden glass-card-interactive group animate-fade-up" style={{animationDelay:`${i*100}ms`}}>
                <div className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-110" style={{ backgroundImage: `url('${g.src}')` }} />
                <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg-primary)]/80 via-transparent to-transparent" />
                <p className="absolute bottom-2 left-3 right-3 text-xs text-white font-medium drop-shadow">{g.caption}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PROCESS TIMELINE */}
      <section className="px-4 mb-24">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <span className="section-label">Our Process</span>
            <h2 className="section-title">From <span className="gradient-text">hatchery to harvest</span></h2>
          </div>
          <div className="grid md:grid-cols-4 gap-4">
            {[
              { step: '01', title: 'Hatchery', desc: 'Brood selection & egg incubation' },
              { step: '02', title: 'Stocking', desc: '3–5cm fingerlings into cages/ponds' },
              { step: '03', title: 'Rearing', desc: '7–10 months at 25% crude protein' },
              { step: '04', title: 'Harvest', desc: 'Hand-selected, gutted & delivered' }
            ].map((s, i) => (
              <div key={s.step} className="glass-card-interactive rounded-2xl p-6 relative animate-fade-up" style={{animationDelay:`${i*100}ms`}}>
                <span className="font-display text-4xl font-bold opacity-15 absolute top-4 right-4">{s.step}</span>
                <h3 className="font-semibold text-primary mb-1">{s.title}</h3>
                <p className="text-sm text-secondary">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* NUTRITION (moved here from /nutrition) */}
      <section id="nutrition" className="px-4 mb-24">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <span className="section-label">Did You Know?</span>
            <h2 className="section-title">Tilapia <span className="gradient-text">nutrition facts</span></h2>
            <p className="text-secondary max-w-md mx-auto mt-4">One of the healthiest proteins you can eat — packed with essential vitamins and minerals.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="glass-strong rounded-3xl p-8">
              <p className="text-[11px] uppercase tracking-[0.2em] text-muted mb-6 font-bold">Per 100g serving</p>
              <div className="space-y-4">
                {nutrients.map(n => (
                  <div key={n.label}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm text-secondary">{n.label}</span>
                      <span className="text-sm font-semibold text-primary">{n.value}</span>
                    </div>
                    <div className="h-2 rounded-full bg-[var(--surface)] overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-[#7FC2E8] to-[#1C6EA8] transition-all duration-1000" style={{width: `${n.pct}%`}} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="glass-strong rounded-3xl p-8">
                <div className="text-5xl mb-4">🐟</div>
                <h3 className="font-display text-2xl font-bold text-primary mb-2">Excellent Lean Protein</h3>
                <p className="text-sm text-secondary leading-relaxed">Tilapia is an excellent source of lean protein — perfect for healthy diets, athletes, and growing children. Low in calories and fat, yet high in essential nutrients.</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { Icon: Heart, label: 'Heart Healthy' },
                  { Icon: Dumbbell, label: 'Muscle Building' },
                  { Icon: Brain, label: 'Brain Function' },
                  { Icon: Bone, label: 'Strong Bones' }
                ].map(({ Icon, label }) => (
                  <div key={label} className="glass-card-interactive rounded-2xl p-4 text-center">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--accent-soft)]/30 to-[var(--accent)]/10 flex items-center justify-center mx-auto mb-2">
                      <Icon className="w-5 h-5 text-[var(--accent)]" />
                    </div>
                    <p className="text-xs text-secondary">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* MAP + INFO */}
      <section className="px-4 pb-24">
        <div className="max-w-6xl mx-auto glass-strong rounded-3xl overflow-hidden">
          <div className="p-6 md:p-8 border-b border-[var(--border-color)]">
            <span className="section-label">Find Us</span>
            <h2 className="font-display text-2xl font-bold text-primary mb-1">Othany East, Seme</h2>
            <p className="text-sm text-secondary">Seme Sub-County, Kisumu County, Kenya · Lake Victoria Shoreline</p>
          </div>
          <div className="aspect-[16/9] w-full">
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d31912.8!2d34.55!3d-0.12!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x182aa4c8f3e2b6d7%3A0x3a5a5a5a5a5a5a5a!2sSeme%2C%20Kisumu%20County!5e0!3m2!1sen!2ske!4v1700000000000"
              className="w-full h-full"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Ethasfish Farms Location"
            />
          </div>
          <div className="p-6 grid sm:grid-cols-3 gap-4 text-sm">
            <div className="flex items-start gap-2"><MapPin className="w-4 h-4 text-[var(--accent)] mt-0.5 flex-shrink-0"/><div className="text-secondary">Othany East, Seme<br/>Kisumu County</div></div>
            <div className="flex items-start gap-2"><Clock className="w-4 h-4 text-[var(--accent)] mt-0.5 flex-shrink-0"/><div className="text-secondary">Mon–Sat<br/>7:00am – 6:00pm</div></div>
            <div className="flex items-start gap-2"><Phone className="w-4 h-4 text-[var(--accent)] mt-0.5 flex-shrink-0"/><div className="text-secondary">+254 737 548998 / +254 712 696427<br/>WhatsApp accepted</div></div>
          </div>
        </div>
      </section>
    </div>
  );
}
