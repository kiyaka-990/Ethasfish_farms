'use client';
import { Printer, Share2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface Props { orderNumber: string; }

export default function ReceiptActions({ orderNumber }: Props) {
  function handlePrint() {
    if (typeof window !== 'undefined') window.print();
  }

  async function handleShare() {
    const url = `${window.location.origin}/receipt?order=${orderNumber}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: `Ethasfish Receipt — ${orderNumber}`, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success('Receipt link copied!');
      }
    } catch {
      // share cancelled
    }
  }

  return (
    <div className="flex gap-2">
      <button onClick={handlePrint} className="btn-glass !py-1.5 !px-3 text-xs" aria-label="Print receipt">
        <Printer className="w-3.5 h-3.5" /> Print
      </button>
      <button onClick={handleShare} className="btn-glass !py-1.5 !px-3 text-xs" aria-label="Share receipt">
        <Share2 className="w-3.5 h-3.5" /> Share
      </button>
    </div>
  );
}
