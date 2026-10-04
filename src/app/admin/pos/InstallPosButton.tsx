'use client';
import { useEffect, useState } from 'react';
import { Download, Check, X } from 'lucide-react';

// The browser's own "install" affordance (an icon tucked in the address
// bar) is too easy for staff at a new outlet to miss entirely. This
// captures the same native prompt and exposes it as an obvious on-page
// button instead - and explains what to do manually on browsers that
// don't support the prompt (Safari, Firefox).
export default function InstallPosButton() {
  const [promptEvent, setPromptEvent] = useState<any>(null);
  const [installed, setInstalled] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setInstalled(true);
      return;
    }
    function onBeforeInstall(e: Event) {
      e.preventDefault();
      setPromptEvent(e);
    }
    function onInstalled() {
      setInstalled(true);
      setPromptEvent(null);
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  async function install() {
    if (!promptEvent) { setShowHelp(true); return; }
    promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice.outcome === 'accepted') setInstalled(true);
    setPromptEvent(null);
  }

  if (installed) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-600 px-3 py-2">
        <Check className="w-3.5 h-3.5" /> Installed as an app
      </span>
    );
  }

  return (
    <>
      <button
        onClick={install}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-br from-[var(--accent-light)] to-[var(--accent)] shadow-sm"
      >
        <Download className="w-3.5 h-3.5" /> Install App
      </button>

      {showHelp && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/50 p-4" onClick={() => setShowHelp(false)}>
          <div className="glass-strong rounded-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <p className="font-display font-bold text-lg text-primary">Install manually</p>
              <button onClick={() => setShowHelp(false)} className="text-muted hover:text-primary"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-secondary mb-3">Your browser didn't offer the one-click prompt. Install it from the menu instead:</p>
            <ul className="text-sm text-secondary space-y-2 list-disc list-inside">
              <li><strong className="text-primary">Chrome / Edge (Windows/Mac):</strong> click the ⋮ menu, top-right → <em>Apps</em> → <em>Install Ethasfish POS</em></li>
              <li><strong className="text-primary">Safari (Mac):</strong> File menu → <em>Add to Dock</em></li>
              <li><strong className="text-primary">Phone/tablet:</strong> Share button → <em>Add to Home Screen</em></li>
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
