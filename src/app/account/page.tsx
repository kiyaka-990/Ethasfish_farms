import Link from 'next/link';
import { redirect } from 'next/navigation';
import { UserButton } from '@clerk/nextjs';
import { ensureCustomerProfile, getStaffSession } from '@/lib/identity';
import { prisma } from '@/lib/prisma';
import { fmtKsh } from '@/lib/utils';
import { Package, ArrowRight, LayoutDashboard } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'My Account' };

export default async function AccountPage() {
  const customer = await ensureCustomerProfile();
  if (!customer) redirect('/sign-in?redirect_url=/account');

  const [staff, orders] = await Promise.all([
    getStaffSession(),
    prisma.order.findMany({
      where: { customerId: customer.id },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
      take: 20
    })
  ]);

  return (
    <div className="px-4 py-16 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-10">
        <div>
          <span className="section-label">My Account</span>
          <h1 className="font-display text-3xl font-bold text-primary">{customer.name || customer.email || 'Welcome'}</h1>
        </div>
        <div className="flex items-center gap-3">
          {staff && (
            <Link href="/admin" className="btn-glass text-sm">
              <LayoutDashboard className="w-4 h-4" /> Staff Portal
            </Link>
          )}
          <UserButton />
        </div>
      </div>

      <div className="glass-strong rounded-3xl p-6">
        <h2 className="font-display text-xl font-semibold text-primary mb-4">Order History</h2>
        {orders.length === 0 ? (
          <div className="py-12 text-center text-muted">
            No orders yet. <Link href="/shop" className="text-[var(--accent)] hover:underline">Start shopping</Link>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--border-color)]">
            {orders.map(o => (
              <li key={o.id} className="py-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl glass-soft flex items-center justify-center flex-shrink-0">
                    <Package className="w-4 h-4 text-[var(--accent)]" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-muted">{o.orderNumber}</p>
                    <p className="text-sm text-primary truncate">{o.items.length} item{o.items.length !== 1 ? 's' : ''} &middot; {fmtKsh(o.total)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="badge !text-[10px] !py-0.5">{o.status}</span>
                  <Link href={`/track?order=${o.orderNumber}`} className="text-sm text-[var(--accent)] hover:text-[var(--accent-light)] inline-flex items-center gap-1">
                    Track <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
