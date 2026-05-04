import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getAdminFromCookies } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { fmtKsh } from '@/lib/utils';
import { ShoppingBag, TrendingUp, Package, Clock, ArrowRight } from 'lucide-react';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin Dashboard' };

export default async function AdminHomePage() {
  const admin = await getAdminFromCookies();
  if (!admin) redirect('/admin/login');

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [totalOrders, pendingOrders, monthRev, totalRev, recentOrders, productCount] = await Promise.all([
    prisma.order.count(),
    prisma.order.count({ where: { status: 'pending' } }),
    prisma.order.aggregate({ where: { createdAt: { gte: startOfMonth }, paymentStatus: 'paid' }, _sum: { total: true } }),
    prisma.order.aggregate({ where: { paymentStatus: 'paid' }, _sum: { total: true } }),
    prisma.order.findMany({ orderBy: { createdAt: 'desc' }, take: 8, include: { items: true } }),
    prisma.product.count({ where: { active: true } })
  ]);

  const stats = [
    { Icon: ShoppingBag, label: 'Total Orders', value: totalOrders.toString(), color: 'from-emerald-400/20 to-teal-600/10' },
    { Icon: Clock, label: 'Pending', value: pendingOrders.toString(), color: 'from-amber-400/20 to-orange-600/10' },
    { Icon: TrendingUp, label: 'This Month', value: fmtKsh(monthRev._sum.total || 0), color: 'from-[#1eb5a6]/20 to-[#0e8c7f]/10' },
    { Icon: Package, label: 'Active Products', value: productCount.toString(), color: 'from-cyan-400/20 to-blue-600/10' }
  ];

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-muted">Welcome back,</p>
        <h1 className="font-display text-3xl font-bold text-primary">{admin.name}</h1>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ Icon, label, value, color }) => (
          <div key={label} className="glass-strong rounded-2xl p-5">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center mb-3`}>
              <Icon className="w-4 h-4 text-primary" />
            </div>
            <p className="text-[11px] uppercase tracking-wider text-muted">{label}</p>
            <p className="font-display text-xl font-bold text-primary mt-1">{value}</p>
          </div>
        ))}
      </div>

      <div className="glass-strong rounded-3xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl font-semibold text-primary">Recent Orders</h2>
          <Link href="/admin/orders" className="text-sm text-[var(--accent)] hover:text-[var(--accent-light)] inline-flex items-center gap-1">
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {recentOrders.length === 0 ? (
          <div className="py-12 text-center text-muted">No orders yet</div>
        ) : (
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted">
                  <th className="px-2 py-3">Order</th>
                  <th className="px-2 py-3">Customer</th>
                  <th className="px-2 py-3">Items</th>
                  <th className="px-2 py-3">Total</th>
                  <th className="px-2 py-3">Status</th>
                  <th className="px-2 py-3">Payment</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map(o => (
                  <tr key={o.id} className="border-t border-[var(--border-color)]">
                    <td className="px-2 py-3 font-mono text-xs">{o.orderNumber}</td>
                    <td className="px-2 py-3">
                      <div className="text-primary">{o.customerName}</div>
                      <div className="text-[11px] text-muted">{o.customerPhone}</div>
                    </td>
                    <td className="px-2 py-3 text-secondary">{o.items.length}</td>
                    <td className="px-2 py-3 font-semibold gradient-text">{fmtKsh(o.total)}</td>
                    <td className="px-2 py-3"><span className="badge !text-[10px] !py-0.5">{o.status}</span></td>
                    <td className="px-2 py-3">
                      <span className={`text-xs font-medium ${o.paymentStatus === 'paid' ? 'text-green-600' : o.paymentStatus === 'failed' ? 'text-red-600' : 'text-amber-600'}`}>
                        {o.paymentStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
