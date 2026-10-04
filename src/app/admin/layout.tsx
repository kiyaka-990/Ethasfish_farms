import { redirect } from 'next/navigation';
import Link from 'next/link';
import { UserButton } from '@clerk/nextjs';
import { getStaffSession, CLERK_ENABLED } from '@/lib/identity';
import { LayoutDashboard, Package, ShoppingBag, MessageSquare, LayoutTemplate, Image as ImageIcon, Users, UserPlus, Activity, FileText, Boxes, Wallet, Truck, Bot, Sparkles } from 'lucide-react';
import Logo from '@/components/Logo';
import AdminMobileNav from './AdminMobileNav';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!CLERK_ENABLED) {
    return (
      <div className="max-w-xl mx-auto px-4 py-24 text-center">
        <div className="glass-strong rounded-3xl p-10">
          <h1 className="font-display text-2xl font-bold text-primary mb-3">Admin portal not yet configured</h1>
          <p className="text-secondary">
            Authentication (Clerk) hasn&apos;t been connected to this project yet. Once it is, sign in from{' '}
            <Link href="/sign-in" className="text-[var(--accent)] hover:underline">/sign-in</Link> to access the portal.
          </p>
        </div>
      </div>
    );
  }

  const staff = await getStaffSession();
  if (!staff) redirect('/sign-in?redirect_url=/admin');

  // `icon` is a plain string here (not a component reference) specifically
  // so this array stays serializable when passed into AdminMobileNav, a
  // Client Component - the desktop <aside> below resolves components
  // locally via ICON_MAP since it never crosses that boundary.
  const navItems = [
    { href: '/admin', icon: 'LayoutDashboard' as const, label: 'Dashboard' },
    { href: '/admin/assistant', icon: 'Sparkles' as const, label: 'Assistant' },
    { href: '/admin/agents', icon: 'Bot' as const, label: 'AI Agents' },
    { href: '/admin/orders', icon: 'ShoppingBag' as const, label: 'Orders' },
    { href: '/admin/invoices', icon: 'FileText' as const, label: 'Invoices' },
    { href: '/admin/leads', icon: 'UserPlus' as const, label: 'Leads' },
    { href: '/admin/products', icon: 'Package' as const, label: 'Products' },
    { href: '/admin/inventory', icon: 'Boxes' as const, label: 'Inventory' },
    { href: '/admin/expenses', icon: 'Wallet' as const, label: 'Accounting' },
    { href: '/admin/purchasing', icon: 'Truck' as const, label: 'Purchasing' },
    { href: '/admin/content', icon: 'LayoutTemplate' as const, label: 'Site Content' },
    { href: '/admin/media', icon: 'ImageIcon' as const, label: 'Media Library' },
    { href: '/admin/faqs', icon: 'MessageSquare' as const, label: 'Bot FAQs' },
    { href: '/admin/activity', icon: 'Activity' as const, label: 'Activity Log' },
    ...(staff.role === 'admin' ? [{ href: '/admin/staff', icon: 'Users' as const, label: 'Staff' }] : [])
  ];

  const ICON_MAP = { LayoutDashboard, Package, ShoppingBag, MessageSquare, LayoutTemplate, ImageIcon, Users, UserPlus, Activity, FileText, Boxes, Wallet, Truck, Bot, Sparkles };

  return (
    <div className="flex flex-col lg:flex-row min-h-screen">
      <AdminMobileNav
        navItems={navItems}
        staffName={staff.name}
        staffEmail={staff.email}
        portalLabel={staff.role === 'admin' ? 'Admin Portal' : 'Sales Portal'}
      />
      <aside className="hidden lg:flex w-64 flex-col p-4 gap-2 border-r border-[var(--border-color)] sticky top-0 self-start h-screen">
        <div className="px-3 py-4 flex items-center justify-between">
          <Link href="/">
            <Logo size={36} />
            <p className="text-[10px] uppercase tracking-wider text-muted mt-3">{staff.role === 'admin' ? 'Admin Portal' : 'Sales Portal'}</p>
          </Link>
        </div>

        {navItems.map(({ href, icon, label }) => {
          const Icon = ICON_MAP[icon];
          return (
            <Link key={href} href={href} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-secondary hover:text-primary hover:bg-[var(--surface)] transition-colors">
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          );
        })}

        <div className="mt-auto flex items-center gap-3 px-3 py-3 rounded-xl glass-soft">
          <UserButton />
          <div className="min-w-0">
            <p className="text-sm text-primary truncate">{staff.name}</p>
            <p className="text-[11px] text-muted truncate">{staff.email}</p>
          </div>
        </div>
      </aside>

      <div className="flex-1 min-w-0 px-4 lg:px-8 py-8">
        {children}
      </div>
    </div>
  );
}
