'use client';
import { Sun, Moon } from 'lucide-react';
import { useAccessibility } from './AccessibilityProvider';

export default function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, setTheme } = useAccessibility();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className={`relative p-2.5 rounded-xl glass hover:bg-[var(--surface-strong)] transition-colors ${className}`}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-pressed={isDark}
    >
      <Sun className={`w-5 h-5 transition-all duration-300 ${isDark ? 'scale-0 -rotate-90 absolute' : 'scale-100 rotate-0'}`} />
      <Moon className={`w-5 h-5 transition-all duration-300 ${isDark ? 'scale-100 rotate-0' : 'scale-0 rotate-90 absolute'}`} />
    </button>
  );
}
