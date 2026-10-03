import { redirect } from 'next/navigation';
import Link from 'next/link';
import { UserButton } from '@clerk/nextjs';
import { getStaffSession, CLERK_ENABLED } from '@/lib/identity';
import { LayoutDashboard, Package, ShoppingBag, MessageSquare, LayoutTemplate, Image as ImageIcon, Users, Activity } from 'lucide-react';
import Logo from '@/components/Logo';

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

  const navItems = [
    { href: '/admin', Icon: LayoutDashboard, label: 'Dashboard' },
    { href: '/admin/orders', Icon: ShoppingBag, label: 'Orders' },
    { href: '/admin/products', Icon: Package, label: 'Products' },
    { href: '/admin/content', Icon: LayoutTemplate, label: 'Site Content' },
    { href: '/admin/media', Icon: ImageIcon, label: 'Media Library' },
    { href: '/admin/faqs', Icon: MessageSquare, label: 'Bot FAQs' },
    { href: '/admin/activity', Icon: Activity, label: 'Activity Log' },
    ...(staff.role === 'admin' ? [{ href: '/admin/staff', Icon: Users, label: 'Staff' }] : [])
  ];

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      <aside className="hidden lg:flex w-64 flex-col p-4 gap-2 border-r border-[var(--border-color)] sticky top-16 self-start h-[calc(100vh-4rem)]">
        <div className="px-3 py-4 flex items-center justify-between">
          <div>
            <Logo size={36} />
            <p className="text-[10px] uppercase tracking-wider text-muted mt-3">{staff.role === 'admin' ? 'Admin Portal' : 'Sales Portal'}</p>
          </div>
        </div>

        {navItems.map(({ href, Icon, label }) => (
          <Link key={href} href={href} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-secondary hover:text-primary hover:bg-[var(--surface)] transition-colors">
            <Icon className="w-4 h-4" />
            {label}
          </Link>
        ))}

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
