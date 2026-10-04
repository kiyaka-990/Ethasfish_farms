'use client';
import { create } from 'zustand';

// Lets the WhatsApp button open the same in-page AI chatbox instead of
// redirecting to wa.me - "intelligent, in its own chatbox" per the brief.
interface ChatUIState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

export const useChatUI = create<ChatUIState>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set((s) => ({ isOpen: !s.isOpen }))
}));
