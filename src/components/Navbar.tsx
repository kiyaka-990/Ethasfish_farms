'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ShoppingBag, Menu, X } from 'lucide-react';
import Logo from './Logo';
import { useCart } from '@/lib/cart-store';

const links = [
  { href: '/', label: 'Home' },
  { href: '/shop', label: 'Shop' },
  { href: '/services', label: 'Services' },
  { href: '/farm', label: 'Our Farm' },
  { href: '/track', label: 'Track Order' },
  { href: '/contact', label: 'Contact' }
];

export default function Navbar() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { count, open } = useCart();
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setCartCount(count());
    const unsub = useCart.subscribe(s => setCartCount(s.items.reduce((a, i) => a + i.quantity, 0)));
    return unsub;
  }, [count]);

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${scrolled ? 'py-2' : 'py-4'}`}>
      <div className="mx-auto max-w-7xl px-4">
        <nav className={`flex items-center justify-between gap-6 px-4 md:px-6 py-3 rounded-2xl transition-all duration-500 ${scrolled ? 'glass-strong' : 'glass'}`}>
          <Link href="/" className="flex-shrink-0">
            <Logo size={36} />
          </Link>

          <div className="hidden lg:flex items-center gap-1">
            {links.map(l => {
              const active = pathname === l.href;
              return (
                <Link key={l.href} href={l.href} className={`relative px-4 py-2 text-sm font-medium rounded-xl transition-all ${active ? 'text-primary bg-[var(--surface-strong)]' : 'text-secondary hover:text-primary hover:bg-[var(--surface)]'}`}>
                  {l.label}
                </Link>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <button onClick={open} className="relative p-2.5 rounded-xl glass hover:bg-[var(--surface-strong)] transition-colors" aria-label="Open cart">
              <ShoppingBag className="w-5 h-5" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1.5 rounded-full bg-gradient-to-br from-[#4dd1c4] to-[#0e8c7f] text-[11px] font-bold flex items-center justify-center text-white shadow-lg">
                  {cartCount}
                </span>
              )}
            </button>
            <Link href="/shop" className="hidden md:inline-flex btn-primary !py-2 !px-4 text-sm">
              Order Now
            </Link>
            <button onClick={() => setMobileOpen(!mobileOpen)} className="lg:hidden p-2.5 rounded-xl glass" aria-label="Toggle menu">
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </nav>

        {mobileOpen && (
          <div className="lg:hidden mt-2 glass-strong rounded-2xl p-3 space-y-1 animate-fade-up">
            {links.map(l => (
              <Link key={l.href} href={l.href} onClick={() => setMobileOpen(false)} className={`block px-4 py-3 rounded-xl text-sm font-medium transition-colors ${pathname === l.href ? 'bg-[var(--surface-strong)] text-primary' : 'text-secondary hover:bg-[var(--surface)]'}`}>
                {l.label}
              </Link>
            ))}
            <Link href="/shop" onClick={() => setMobileOpen(false)} className="btn-primary w-full mt-2">
              Order Now
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
