import { redirect } from 'next/navigation';
import Link from 'next/link';
import { UserButton, SignOutButton } from '@clerk/nextjs';
import { LogOut } from 'lucide-react';
import { getStaffSession, CLERK_ENABLED } from '@/lib/identity';
import { LayoutDashboard, Package, ShoppingBag, MessageSquare, LayoutTemplate, Image as ImageIcon, Users, UserPlus, Activity, FileText, Boxes, Wallet, Truck, Bot, Sparkles, Store } from 'lucide-react';
import Logo from '@/components/Logo';
import ThemeToggle from '@/components/ThemeToggle';
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
  // Branch/outlet sales managers get the day-to-day till tools; everything
  // with business-wide financial or public-site impact (pricing edits,
  // accounting, purchasing, the CMS, cross-branch activity) is admin-only.
  // This list is a convenience for navigation only - the real boundary is
  // requireAdmin() on each of those API routes.
  const navItems = [
    { href: '/admin', icon: 'LayoutDashboard' as const, label: 'Dashboard' },
    { href: '/admin/assistant', icon: 'Sparkles' as const, label: 'Assistant' },
    { href: '/admin/pos', icon: 'Store' as const, label: 'Point of Sale' },
    { href: '/admin/orders', icon: 'ShoppingBag' as const, label: 'Orders' },
    { href: '/admin/leads', icon: 'UserPlus' as const, label: 'Leads' },
    { href: '/admin/products', icon: 'Package' as const, label: 'Products' },
    ...(staff.role === 'admin' ? [
      { href: '/admin/agents', icon: 'Bot' as const, label: 'AI Agents' },
      { href: '/admin/invoices', icon: 'FileText' as const, label: 'Invoices' },
      { href: '/admin/inventory', icon: 'Boxes' as const, label: 'Inventory' },
      { href: '/admin/expenses', icon: 'Wallet' as const, label: 'Accounting' },
      { href: '/admin/purchasing', icon: 'Truck' as const, label: 'Purchasing' },
      { href: '/admin/content', icon: 'LayoutTemplate' as const, label: 'Site Content' },
      { href: '/admin/media', icon: 'ImageIcon' as const, label: 'Media Library' },
      { href: '/admin/faqs', icon: 'MessageSquare' as const, label: 'Bot FAQs' },
      { href: '/admin/activity', icon: 'Activity' as const, label: 'Activity Log' },
      { href: '/admin/staff', icon: 'Users' as const, label: 'Staff' }
    ] : [])
  ];

  const ICON_MAP = { LayoutDashboard, Package, ShoppingBag, MessageSquare, LayoutTemplate, ImageIcon, Users, UserPlus, Activity, FileText, Boxes, Wallet, Truck, Bot, Sparkles, Store };

  return (
    <div className="flex flex-col lg:flex-row min-h-screen">
      <AdminMobileNav
        navItems={navItems}
        staffName={staff.name}
        staffEmail={staff.email}
        portalLabel={staff.role === 'admin' ? 'Admin Portal' : 'Sales Portal'}
      />
      <aside className="hidden lg:flex w-64 flex-col border-r border-[var(--border-color)] sticky top-0 self-start h-screen">
        <div className="shrink-0 px-4 py-4 flex items-start justify-between">
          <Link href="/">
            <Logo size={36} />
            <p className="text-[10px] uppercase tracking-wider text-muted mt-3">{staff.role === 'admin' ? 'Admin Portal' : 'Sales Portal'}</p>
          </Link>
          <ThemeToggle className="!p-2" />
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 flex flex-col gap-2">
          {navItems.map(({ href, icon, label }) => {
            const Icon = ICON_MAP[icon];
            return (
              <Link key={href} href={href} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-secondary hover:text-primary hover:bg-[var(--surface)] transition-colors">
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
              <p className="text-sm text-primary truncate">{staff.name}</p>
              <p className="text-[11px] text-muted truncate">{staff.email}</p>
            </div>
            <SignOutButton>
              <button className="p-2 rounded-lg hover:bg-[var(--surface-strong)] text-muted hover:text-red-500 transition-colors shrink-0" aria-label="Sign out" title="Sign out">
                <LogOut className="w-4 h-4" />
              </button>
            </SignOutButton>
          </div>
        </div>
      </aside>

      <div className="flex-1 min-w-0 px-4 lg:px-8 py-8">
        {children}
      </div>
    </div>
  );
}
