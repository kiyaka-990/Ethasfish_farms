'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserButton, SignOutButton } from '@clerk/nextjs';
import {
  Menu, X, LayoutDashboard, Package, ShoppingBag, MessageSquare, LayoutTemplate,
  Image as ImageIcon, Users, UserPlus, Activity, FileText, Boxes, Wallet, Truck, Bot, Sparkles, LogOut
} from 'lucide-react';
import Logo from '@/components/Logo';
import ThemeToggle from '@/components/ThemeToggle';

// Server Components can't pass component/function references as props to
// Client Components (not serializable across the RSC boundary) - this map
// lets AdminLayout hand over plain icon-name strings instead, which is why
// the icon set here must mirror the one used server-side in admin/layout.tsx.
const ICONS = {
  LayoutDashboard, Package, ShoppingBag, MessageSquare, LayoutTemplate,
  ImageIcon, Users, UserPlus, Activity, FileText, Boxes, Wallet, Truck, Bot, Sparkles
};

interface NavItem { href: string; icon: keyof typeof ICONS; label: string; }

// The desktop sidebar is `hidden lg:flex` - below that breakpoint there
// was no navigation at all, just bare page content (e.g. landing on
// /admin shows only "Welcome back, <name>" with no way to reach any
// other section). This is the mobile/narrow-viewport fallback.
export default function AdminMobileNav({ navItems, staffName, staffEmail, portalLabel }: {
  navItems: NavItem[];
  staffName: string;
  staffEmail: string;
  portalLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="lg:hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)] sticky top-0 z-40 bg-[var(--bg-primary)]">
        <Logo size={30} />
        <div className="flex items-center gap-1.5">
          <ThemeToggle className="!p-2" />
          <button onClick={() => setOpen(true)} className="p-2 rounded-xl hover:bg-[var(--surface)] text-primary" aria-label="Open admin menu">
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <div className="relative w-72 max-w-[85vw] h-full bg-[var(--bg-tertiary)] flex flex-col">
            <div className="shrink-0 flex items-center justify-between px-4 pt-4 pb-2">
              <div>
                <Logo size={32} />
                <p className="text-[10px] uppercase tracking-wider text-muted mt-2">{portalLabel}</p>
              </div>
              <button onClick={() => setOpen(false)} className="p-2 rounded-xl hover:bg-[var(--surface)] text-muted" aria-label="Close menu">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-4 flex flex-col gap-2">
              {navItems.map(({ href, icon, label }) => {
                const Icon = ICONS[icon];
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${pathname === href ? 'bg-[var(--surface-strong)] text-primary' : 'text-secondary hover:text-primary hover:bg-[var(--surface)]'}`}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </Link>
                );
              })}
            </div>

            <div className="shrink-0 p-4">
              <div className="flex items-center gap-3 px-3 py-3 rounded-xl glass-soft">
                <UserButton />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-primary truncate">{staffName}</p>
                  <p className="text-[11px] text-muted truncate">{staffEmail}</p>
                </div>
                <SignOutButton>
                  <button className="p-2 rounded-lg hover:bg-[var(--surface-strong)] text-muted hover:text-red-500 transition-colors shrink-0" aria-label="Sign out" title="Sign out">
                    <LogOut className="w-4 h-4" />
                  </button>
                </SignOutButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
