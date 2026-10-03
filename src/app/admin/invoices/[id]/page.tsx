import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { fmtKsh } from '@/lib/utils';
import Logo from '@/components/Logo';
import PrintButton from './PrintButton';

export const dynamic = 'force-dynamic';

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const invoice = await prisma.invoice.findUnique({ where: { id }, include: { items: true } });
  if (!invoice) notFound();

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex justify-end mb-4 print:hidden">
        <PrintButton />
      </div>
      <div className="glass-strong rounded-3xl p-10 bg-white text-[#0B1F3A]">
        <div className="flex items-start justify-between mb-10">
          <Logo size={44} />
          <div className="text-right">
            <h1 className="font-display text-2xl font-bold">INVOICE</h1>
            <p className="font-mono text-sm text-[#5B7190]">{invoice.invoiceNumber}</p>
            <p className="text-xs uppercase tracking-wider mt-1 font-semibold">{invoice.status}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-10 text-sm">
          <div>
            <p className="text-xs uppercase tracking-wider text-[#5B7190] mb-1">Billed To</p>
            <p className="font-semibold">{invoice.customerName}</p>
            {invoice.customerAddr && <p>{invoice.customerAddr}</p>}
            {invoice.customerPhone && <p>{invoice.customerPhone}</p>}
            {invoice.customerEmail && <p>{invoice.customerEmail}</p>}
          </div>
          <div className="text-right">
            <p><span className="text-[#5B7190]">Issued:</span> {invoice.issuedAt.toLocaleDateString()}</p>
            {invoice.dueDate && <p><span className="text-[#5B7190]">Due:</span> {invoice.dueDate.toLocaleDateString()}</p>}
          </div>
        </div>

        <table className="w-full text-sm mb-8">
          <thead>
            <tr className="border-b border-[#C7D9EC] text-left text-[#5B7190] text-xs uppercase tracking-wider">
              <th className="pb-2">Description</th>
              <th className="pb-2 text-right">Qty</th>
              <th className="pb-2 text-right">Unit Price</th>
              <th className="pb-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {invoice.items.map(it => (
              <tr key={it.id} className="border-b border-[#E7EFF8]">
                <td className="py-2">{it.description}</td>
                <td className="py-2 text-right">{it.quantity}</td>
                <td className="py-2 text-right">{fmtKsh(it.unitPrice)}</td>
                <td className="py-2 text-right font-medium">{fmtKsh(it.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end">
          <div className="w-56 text-sm space-y-1">
            <div className="flex justify-between"><span className="text-[#5B7190]">Subtotal</span><span>{fmtKsh(invoice.subtotal)}</span></div>
            {invoice.taxRate > 0 && <div className="flex justify-between"><span className="text-[#5B7190]">Tax ({invoice.taxRate}%)</span><span>{fmtKsh(invoice.taxAmount)}</span></div>}
            <div className="flex justify-between font-display text-lg font-bold pt-2 border-t border-[#C7D9EC]"><span>Total</span><span>{fmtKsh(invoice.total)}</span></div>
          </div>
        </div>

        {invoice.notes && (
          <div className="mt-8 pt-6 border-t border-[#E7EFF8] text-sm text-[#5B7190]">
            <p className="text-xs uppercase tracking-wider mb-1">Notes</p>
            <p>{invoice.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}
