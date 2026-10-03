'use client';
import { useEffect, useRef } from 'react';
import { useAccessibility } from './AccessibilityProvider';

// A soft light that follows the pointer across the page (and tracks
// correctly while the page is scrolling, since it's positioned with
// fixed viewport coordinates). Skipped entirely for touch-only
// pointers and for reduced-motion preferences.
export default function CursorGlow() {
  const ref = useRef<HTMLDivElement>(null);
  const { motion } = useAccessibility();

  useEffect(() => {
    if (motion === 'reduce') return;
    if (typeof window === 'undefined' || !window.matchMedia('(pointer: fine)').matches) return;

    const el = ref.current;
    if (!el) return;

    let raf = 0;
    let x = window.innerWidth / 2;
    let y = window.innerHeight / 2;
    let visible = false;

    const render = () => {
      el.style.transform = `translate3d(${x - 220}px, ${y - 220}px, 0)`;
      raf = 0;
    };

    const onMove = (e: PointerEvent) => {
      x = e.clientX;
      y = e.clientY;
      if (!visible) { el.style.opacity = '1'; visible = true; }
      if (!raf) raf = requestAnimationFrame(render);
    };
    const onLeave = () => { el.style.opacity = '0'; visible = false; };

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerleave', onLeave);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerleave', onLeave);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [motion]);

  if (motion === 'reduce') return null;

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="fixed top-0 left-0 w-[440px] h-[440px] rounded-full pointer-events-none z-[1] opacity-0 transition-opacity duration-500"
      style={{
        background: 'radial-gradient(circle, rgba(30,181,166,0.16) 0%, rgba(77,209,196,0.08) 40%, transparent 72%)',
        filter: 'blur(4px)',
        willChange: 'transform'
      }}
    />
  );
}
