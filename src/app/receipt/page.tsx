import { redirect } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { fmtKsh } from '@/lib/utils';
import { CheckCircle2, MessageCircle } from 'lucide-react';
import Logo from '@/components/Logo';
import ReceiptActions from '@/components/ReceiptActions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Receipt' };

export default async function ReceiptPage({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  const { order: orderNumber } = await searchParams;
  if (!orderNumber) redirect('/track');

  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: { items: true }
  });

  if (!order) redirect('/track');

  const wa = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '254700000000';

  return (
    <div className="px-4 py-12 print:py-0">
      <div className="max-w-md mx-auto">
        {/* Top bar - hidden on print */}
        <div className="flex items-center justify-between mb-4 print:hidden">
          <Link href="/track" className="text-sm text-secondary hover:text-primary">← Back</Link>
          <ReceiptActions orderNumber={order.orderNumber} />
        </div>

        {/* Receipt card */}
        <div className="glass-strong rounded-3xl p-6 md:p-8 print:bg-white print:border-0 print:shadow-none">
          {/* Header */}
          <div className="flex flex-col items-center text-center pb-5 border-b border-[var(--border-color)]">
            <Logo size={48} showText={false} />
            <h1 className="font-display text-xl font-bold mt-3 text-primary">Ethasfish Farms</h1>
            <p className="text-xs text-muted mt-0.5">Othany East, Seme · Kisumu County</p>
            <p className="text-xs text-muted">+254 737 548998 · info@ethasfarms.co.ke</p>
          </div>

          {/* Status */}
          <div className="flex flex-col items-center my-6">
            {order.paymentStatus === 'paid' ? (
              <>
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center mb-3 print:bg-green-500">
                  <CheckCircle2 className="w-8 h-8 text-white" />
                </div>
                <p className="font-display text-2xl font-bold text-green-600">PAID</p>
                <p className="text-sm text-muted">Payment received</p>
              </>
            ) : (
              <>
                <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mb-3 border-2 border-amber-400">
                  <span className="text-amber-600 font-bold text-xl">{order.paymentStatus === 'processing' ? '⏳' : '!'}</span>
                </div>
                <p className="font-display text-2xl font-bold text-amber-600 uppercase">{order.paymentStatus}</p>
                <p className="text-sm text-muted">Awaiting payment</p>
              </>
            )}
          </div>

          {/* Customer info - V-Farm style */}
          <div className="font-mono text-sm space-y-1 py-4 border-y border-dashed border-[var(--border-color)]">
            <div><span className="text-muted">Name ::</span> <span className="text-primary font-semibold">{order.customerName}</span></div>
            <div><span className="text-muted">Order ::</span> <span className="text-primary font-semibold underline decoration-dotted">{order.orderNumber}</span></div>
            <div><span className="text-muted">Date ::</span> <span className="text-primary font-semibold">{new Date(order.createdAt).toLocaleDateString('en-GB')}</span></div>
            <div><span className="text-muted">Time ::</span> <span className="text-primary font-semibold">{new Date(order.createdAt).toLocaleTimeString('en-GB', { hour12: false })}</span></div>
            <div><span className="text-muted">Status ::</span> <span className="text-primary font-bold">{order.paymentStatus === 'paid' ? 'Paid' : order.paymentStatus}</span></div>
            <div><span className="text-muted">Phone ::</span> <span className="text-primary">+{order.customerPhone}</span></div>
            <div><span className="text-muted">Delivery ::</span> <span className="text-primary">{order.deliveryAddress}</span></div>
            {order.mpesaRef && <div><span className="text-muted">M-Pesa Ref ::</span> <span className="text-primary font-mono">{order.mpesaRef}</span></div>}
          </div>

          {/* Items */}
          <div className="font-mono text-sm py-4">
            <p className="text-muted mb-2">Items ::</p>
            <div className="space-y-1">
              {order.items.map((it: any) => (
                <div key={it.id} className="text-primary">
                  {it.variantLabel} ({it.productName}) × {it.quantity} - {fmtKsh(it.lineTotal)}
                </div>
              ))}
            </div>
            <div className="border-t border-dashed border-[var(--border-color)] mt-4 pt-3 space-y-1">
              <div className="flex justify-between text-secondary"><span>Subtotal ::</span><span>{fmtKsh(order.subtotal)}</span></div>
              <div className="flex justify-between text-secondary"><span>Delivery ::</span><span>{fmtKsh(order.deliveryFee)}</span></div>
              <div className="flex justify-between font-bold text-primary text-base mt-2 pt-2 border-t border-[var(--border-color)]">
                <span>Grand Total ::</span><span className="gradient-text">{fmtKsh(order.total)}</span>
              </div>
            </div>
          </div>

          {/* Footer notice */}
          <div className="border-t border-dashed border-[var(--border-color)] pt-4 text-xs text-muted text-center space-y-1">
            <p>All transactions are done in real-time.</p>
            <p>Always pay through the official Ethasfish till number.</p>
            <p className="pt-2 text-[var(--accent)] font-medium">Thank you for your order! 🐟</p>
          </div>
        </div>

        {/* Actions - hidden on print */}
        <div className="mt-6 grid grid-cols-2 gap-3 print:hidden">
          <Link href={`/track?order=${order.orderNumber}`} className="btn-glass !py-3 text-sm">
            Track Order
          </Link>
          <a href={`https://wa.me/${wa}?text=Hi%20Ethasfish%2C%20I%20have%20a%20question%20about%20order%20${order.orderNumber}`}
            target="_blank" rel="noopener noreferrer"
            className="btn-primary !py-3 text-sm">
            <MessageCircle className="w-4 h-4" /> WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}
