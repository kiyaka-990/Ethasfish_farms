import { prisma } from './prisma';

// Lazily creates the singleton row on first read so callers never have
// to handle a missing-settings case.
export async function getTaxSettings() {
  const existing = await prisma.businessSettings.findUnique({ where: { id: 'singleton' } });
  if (existing) return existing;
  return prisma.businessSettings.create({ data: { id: 'singleton' } });
}

// Prices are VAT-inclusive (Kenyan retail convention) - this backs the
// VAT portion out of an already-final subtotal rather than adding to it,
// so enabling VAT never changes what a customer pays.
export function vatPortion(subtotal: number, vatRate: number): number {
  if (!vatRate) return 0;
  return Math.round(subtotal - subtotal / (1 + vatRate / 100));
}
