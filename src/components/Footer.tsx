import Link from 'next/link';
import Logo from './Logo';
import { Mail, Phone, MapPin } from 'lucide-react';
import { FacebookIcon, InstagramIcon, XIcon } from './SocialIcons';

export default function Footer() {
  return (
    <footer className="relative mt-32 border-t border-[var(--border-color)]">
      <div className="mx-auto max-w-7xl px-4 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          <div className="col-span-2">
            <Logo size={44} />
            <p className="mt-4 text-sm text-secondary leading-relaxed max-w-sm">
              Premium Nile Tilapia from Lake Victoria — sustainably farmed at Othany East, Seme, Kisumu County. Hormone-free, chemical-free, zero plastic packaging.
            </p>
            <div className="mt-6 flex gap-2">
              {[FacebookIcon, InstagramIcon, XIcon].map((Icon, i) => (
                <a key={i} href="#" className="w-10 h-10 rounded-xl glass flex items-center justify-center hover:bg-[var(--surface-strong)] transition-colors" aria-label="Social link">
                  <Icon className="w-4 h-4 text-secondary" />
                </a>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-xs uppercase tracking-[0.2em] font-bold text-muted mb-4">Explore</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/shop" className="text-secondary hover:text-[var(--accent)] transition-colors">Shop</Link></li>
              <li><Link href="/services" className="text-secondary hover:text-[var(--accent)] transition-colors">Services</Link></li>
              <li><Link href="/farm" className="text-secondary hover:text-[var(--accent)] transition-colors">Our Farm</Link></li>
              <li><Link href="/farm#nutrition" className="text-secondary hover:text-[var(--accent)] transition-colors">Nutrition</Link></li>
              <li><Link href="/track" className="text-secondary hover:text-[var(--accent)] transition-colors">Track Order</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs uppercase tracking-[0.2em] font-bold text-muted mb-4">Contact</h4>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-2 text-secondary">
                <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0 text-[var(--accent)]" />
                <span>Othany East, Seme,<br/>Kisumu County, Kenya</span>
              </li>
              <li className="flex items-center gap-2 text-secondary"><Phone className="w-4 h-4 text-[var(--accent)]" /><a href="tel:+254700000000" className="hover:text-primary">+254 700 000 000</a></li>
              <li className="flex items-center gap-2 text-secondary"><Mail className="w-4 h-4 text-[var(--accent)]" /><a href="mailto:hello@ethasfish.co.ke" className="hover:text-primary">hello@ethasfish.co.ke</a></li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-[var(--border-color)] flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-muted">
          <span>© 2026 Ethasfish Farms. All rights reserved.</span>
          <span>Raising Kenya's finest tilapia · Open Mon–Sat, 7am–6pm</span>
        </div>
      </div>
    </footer>
  );
}
