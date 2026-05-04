'use client';
import { useState, useRef, useEffect } from 'react';
import { Accessibility, Sun, Moon, Type, Eye, Zap, X } from 'lucide-react';
import { useAccessibility } from './AccessibilityProvider';

export default function AccessibilityMenu() {
  const [open, setOpen] = useState(false);
  const { theme, fontSize, contrast, motion, setTheme, setFontSize, setContrast, setMotion } = useAccessibility();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (open && ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  return (
    <div ref={ref} className="fixed bottom-6 left-6 z-[80]">
      <button
        onClick={() => setOpen(!open)}
        className="w-12 h-12 rounded-full glass-strong flex items-center justify-center hover:scale-110 transition-transform shadow-lg"
        aria-label="Accessibility settings"
        aria-expanded={open}
      >
        {open ? <X className="w-5 h-5" /> : <Accessibility className="w-5 h-5 text-[var(--accent)]" />}
      </button>

      {open && (
        <div className="absolute bottom-16 left-0 w-72 glass-strong rounded-2xl p-4 space-y-4 animate-fade-up shadow-xl">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">Accessibility</h3>
            <span className="badge !text-[10px]">A11y</span>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted block mb-2">Theme</label>
            <div className="grid grid-cols-2 gap-1.5">
              <button onClick={() => setTheme('light')} className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition ${theme === 'light' ? 'bg-gradient-to-br from-sea-400 to-sea-600 text-white' : 'glass-soft'}`}>
                <Sun className="w-3.5 h-3.5" /> Light
              </button>
              <button onClick={() => setTheme('dark')} className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium transition ${theme === 'dark' ? 'bg-gradient-to-br from-sea-400 to-sea-600 text-white' : 'glass-soft'}`}>
                <Moon className="w-3.5 h-3.5" /> Dark
              </button>
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted block mb-2 flex items-center gap-1.5">
              <Type className="w-3 h-3" /> Text size
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {(['base', 'lg', 'xl'] as const).map(s => (
                <button key={s} onClick={() => setFontSize(s)} className={`py-2 rounded-xl text-xs font-medium transition ${fontSize === s ? 'bg-gradient-to-br from-sea-400 to-sea-600 text-white' : 'glass-soft'}`}>
                  {s === 'base' ? 'A' : s === 'lg' ? 'A+' : 'A++'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted block mb-2 flex items-center gap-1.5">
              <Eye className="w-3 h-3" /> Contrast
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              <button onClick={() => setContrast('normal')} className={`py-2 rounded-xl text-xs font-medium transition ${contrast === 'normal' ? 'bg-gradient-to-br from-sea-400 to-sea-600 text-white' : 'glass-soft'}`}>Normal</button>
              <button onClick={() => setContrast('high')} className={`py-2 rounded-xl text-xs font-medium transition ${contrast === 'high' ? 'bg-gradient-to-br from-sea-400 to-sea-600 text-white' : 'glass-soft'}`}>High</button>
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted block mb-2 flex items-center gap-1.5">
              <Zap className="w-3 h-3" /> Motion
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              <button onClick={() => setMotion('normal')} className={`py-2 rounded-xl text-xs font-medium transition ${motion === 'normal' ? 'bg-gradient-to-br from-sea-400 to-sea-600 text-white' : 'glass-soft'}`}>On</button>
              <button onClick={() => setMotion('reduce')} className={`py-2 rounded-xl text-xs font-medium transition ${motion === 'reduce' ? 'bg-gradient-to-br from-sea-400 to-sea-600 text-white' : 'glass-soft'}`}>Reduce</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
