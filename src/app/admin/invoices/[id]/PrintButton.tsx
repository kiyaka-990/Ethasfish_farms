'use client';
import { Printer } from 'lucide-react';
import { printIsolated } from '@/lib/print';

// Prints only the invoice card (the node marked `print-target` on the
// page) instead of the whole portal: no sidebar, one A4 sheet.
export default function PrintButton() {
  return (
    <button onClick={() => printIsolated()} className="btn-primary !py-2 text-sm">
      <Printer className="w-4 h-4" /> Print / Save PDF
    </button>
  );
}
