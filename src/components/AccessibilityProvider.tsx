'use client';
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type Theme = 'light' | 'dark';
type FontSize = 'base' | 'lg' | 'xl';
type Contrast = 'normal' | 'high';
type Motion = 'normal' | 'reduce';

interface Prefs {
  theme: Theme;
  fontSize: FontSize;
  contrast: Contrast;
  motion: Motion;
  setTheme: (t: Theme) => void;
  setFontSize: (s: FontSize) => void;
  setContrast: (c: Contrast) => void;
  setMotion: (m: Motion) => void;
}

const Ctx = createContext<Prefs | null>(null);

export function useAccessibility() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAccessibility must be used inside AccessibilityProvider');
  return ctx;
}

export default function AccessibilityProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light');
  const [fontSize, setFontSize] = useState<FontSize>('base');
  const [contrast, setContrast] = useState<Contrast>('normal');
  const [motion, setMotion] = useState<Motion>('normal');

  // Hydrate from localStorage
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('ethas_a11y') || '{}');
      if (saved.theme) setTheme(saved.theme);
      if (saved.fontSize) setFontSize(saved.fontSize);
      if (saved.contrast) setContrast(saved.contrast);
      if (saved.motion) setMotion(saved.motion);
    } catch {}
  }, []);

  // Apply + persist
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    root.setAttribute('data-font-size', fontSize);
    root.setAttribute('data-contrast', contrast);
    root.setAttribute('data-motion', motion);
    try { localStorage.setItem('ethas_a11y', JSON.stringify({ theme, fontSize, contrast, motion })); } catch {}
  }, [theme, fontSize, contrast, motion]);

  return (
    <Ctx.Provider value={{ theme, fontSize, contrast, motion, setTheme, setFontSize, setContrast, setMotion }}>
      {children}
    </Ctx.Provider>
  );
}
