'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartItem {
  productId: string;
  variantId: string;
  productName: string;
  variantLabel: string;
  weight: string;
  priceKsh: number;
  quantity: number;
  imageUrl?: string;
}

interface CartState {
  items: CartItem[];
  isOpen: boolean;
  add: (item: Omit<CartItem, 'quantity'>) => void;
  remove: (variantId: string) => void;
  setQty: (variantId: string, qty: number) => void;
  clear: () => void;
  open: () => void;
  close: () => void;
  toggle: () => void;
  subtotal: () => number;
  count: () => number;
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,
      add: (item) => set((s) => {
        const existing = s.items.find(i => i.variantId === item.variantId);
        if (existing) return { items: s.items.map(i => i.variantId === item.variantId ? { ...i, quantity: i.quantity + 1 } : i) };
        return { items: [...s.items, { ...item, quantity: 1 }] };
      }),
      remove: (variantId) => set((s) => ({ items: s.items.filter(i => i.variantId !== variantId) })),
      setQty: (variantId, qty) => set((s) => ({
        items: qty <= 0 ? s.items.filter(i => i.variantId !== variantId) : s.items.map(i => i.variantId === variantId ? { ...i, quantity: qty } : i)
      })),
      clear: () => set({ items: [] }),
      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),
      toggle: () => set((s) => ({ isOpen: !s.isOpen })),
      subtotal: () => get().items.reduce((a, i) => a + i.priceKsh * i.quantity, 0),
      count: () => get().items.reduce((a, i) => a + i.quantity, 0)
    }),
    { name: 'ethas-cart' }
  )
);
