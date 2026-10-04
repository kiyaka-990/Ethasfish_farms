'use client';
import { useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';

export default function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 500);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className={`fixed bottom-6 left-24 z-[78] w-11 h-11 rounded-full flex items-center justify-center glass-strong shadow-lg transition-all duration-300 hover:scale-110 ${visible ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-3 pointer-events-none'}`}
      aria-label="Scroll to top"
    >
      <ArrowUp className="w-4 h-4 text-[var(--accent)]" />
    </button>
  );
}
