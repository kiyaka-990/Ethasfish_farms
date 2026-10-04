'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ShoppingBag, Menu, X, User } from 'lucide-react';
import { UserButton, Show, SignInButton } from '@clerk/nextjs';
import Logo from './Logo';
import ThemeToggle from './ThemeToggle';
import { useCart } from '@/lib/cart-store';
import { CLERK_ENABLED } from '@/lib/identity-client';

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
  const { open } = useCart();
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setCartCount(useCart.getState().count());
    const unsub = useCart.subscribe(s => setCartCount(s.items.reduce((a, i) => a + i.quantity, 0)));
    return unsub;
  }, []);

  return (
    <header className={`fixed top-[var(--promo-bar-h,0px)] left-0 right-0 z-50 transition-all duration-500 ${scrolled ? 'py-2' : 'py-4'}`}>
      <div className="mx-auto max-w-7xl px-4">
        <nav
          className={`flex items-center justify-between gap-6 px-4 md:px-6 py-3 rounded-2xl transition-all duration-500 ${scrolled ? 'glass-strong' : 'glass'}`}
          aria-label="Primary"
        >
          <Link href="/" className="flex-shrink-0" aria-label="Ethasfish Farms home">
            <Logo size={36} />
          </Link>

          <div className="hidden lg:flex items-center gap-1">
            {links.map(l => {
              const active = pathname === l.href;
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  aria-current={active ? 'page' : undefined}
                  className={`relative px-4 py-2 text-sm font-medium rounded-xl transition-all ${active ? 'text-primary bg-[var(--surface-strong)]' : 'text-secondary hover:text-primary hover:bg-[var(--surface)]'}`}
                >
                  {l.label}
                </Link>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle className="hidden sm:inline-flex" />

            <button onClick={open} className="relative p-2.5 rounded-xl glass hover:bg-[var(--surface-strong)] transition-colors" aria-label={`Open cart${cartCount > 0 ? `, ${cartCount} items` : ''}`}>
              <ShoppingBag className="w-5 h-5" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1.5 rounded-full bg-gradient-to-br from-[#7FC2E8] to-[#1C6EA8] text-[11px] font-bold flex items-center justify-center text-white shadow-lg" aria-hidden="true">
                  {cartCount}
                </span>
              )}
            </button>

            {CLERK_ENABLED && <AccountArea />}

            <Link href="/shop" className="hidden md:inline-flex btn-primary !py-2 !px-4 text-sm">
              Order Now
            </Link>
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden p-2.5 rounded-xl glass"
              aria-label="Toggle menu"
              aria-expanded={mobileOpen}
              aria-controls="mobile-nav"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </nav>

        {mobileOpen && (
          <div id="mobile-nav" className="lg:hidden mt-2 glass-strong rounded-2xl p-3 space-y-1 animate-fade-up">
            {links.map(l => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setMobileOpen(false)}
                aria-current={pathname === l.href ? 'page' : undefined}
                className={`block px-4 py-3 rounded-xl text-sm font-medium transition-colors ${pathname === l.href ? 'bg-[var(--surface-strong)] text-primary' : 'text-secondary hover:bg-[var(--surface)]'}`}
              >
                {l.label}
              </Link>
            ))}
            <div className="flex items-center gap-2 px-1 pt-2">
              <ThemeToggle className="sm:hidden" />
              <Link href="/shop" onClick={() => setMobileOpen(false)} className="btn-primary flex-1">
                Order Now
              </Link>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

// Rendered only when Clerk is actually configured (see CLERK_ENABLED above).
function AccountArea() {
  return (
    <>
      <Show when="signed-in">
        <Link href="/account" className="p-2.5 rounded-xl glass hover:bg-[var(--surface-strong)] transition-colors hidden sm:inline-flex" aria-label="Your account">
          <User className="w-5 h-5" />
        </Link>
        <UserButton />
      </Show>
      <Show when="signed-out">
        <SignInButton mode="modal">
          <button className="p-2.5 rounded-xl glass hover:bg-[var(--surface-strong)] transition-colors" aria-label="Sign in">
            <User className="w-5 h-5" />
          </button>
        </SignInButton>
      </Show>
    </>
  );
}
