import { type ClassValue, clsx } from 'clsx';

export function cn(...inputs: ClassValue[]) { return clsx(inputs); }

export function fmtKsh(n: number): string { return `KSh ${n.toLocaleString('en-KE')}`; }

export function generateOrderNumber(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `EF-${ts}-${rand}`;
}

export function normalizeKenyanPhone(phone: string): string {
  let p = phone.replace(/\D/g, '');
  if (p.startsWith('0')) p = '254' + p.slice(1);
  else if (/^[71]/.test(p)) p = '254' + p;
  if (p.length !== 12 || !p.startsWith('254')) throw new Error('Invalid Kenyan phone number');
  return p;
}
