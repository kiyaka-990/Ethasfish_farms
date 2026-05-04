import Link from 'next/link';
import { getAdminFromCookies } from '@/lib/auth';
import { LayoutDashboard, Package, ShoppingBag, MessageSquare, LogOut } from 'lucide-react';
import Logo from '@/components/Logo';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdminFromCookies();

  if (!admin) {
    return <div>{children}</div>;
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      <aside className="hidden lg:flex w-64 flex-col p-4 gap-2 border-r border-[var(--border-color)] sticky top-16 self-start h-[calc(100vh-4rem)]">
        <div className="px-3 py-4">
          <Logo size={36} />
          <p className="text-[10px] uppercase tracking-wider text-muted mt-3">Admin Panel</p>
        </div>

        {[
          { href: '/admin', Icon: LayoutDashboard, label: 'Dashboard' },
          { href: '/admin/orders', Icon: ShoppingBag, label: 'Orders' },
          { href: '/admin/products', Icon: Package, label: 'Products' },
          { href: '/admin/faqs', Icon: MessageSquare, label: 'Bot FAQs' }
        ].map(({ href, Icon, label }) => (
          <Link key={href} href={href} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-secondary hover:text-primary hover:bg-[var(--surface)] transition-colors">
            <Icon className="w-4 h-4" />
            {label}
          </Link>
        ))}

        <a href="/api/admin/logout" className="mt-auto flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-red-500/80 hover:text-red-500 hover:bg-red-500/5 transition-colors">
          <LogOut className="w-4 h-4" />
          Sign out
        </a>
      </aside>

      <div className="flex-1 min-w-0 px-4 lg:px-8 py-8">
        {children}
      </div>
    </div>
  );
}
