'use client';
import { useEffect, useState } from 'react';
import { Cookie } from 'lucide-react';

const CONSENT_KEY = 'ethasfish-cookie-consent';

export default function CookieConsent() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(CONSENT_KEY)) setShow(true);
  }, []);

  function accept() {
    localStorage.setItem(CONSENT_KEY, 'accepted');
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[85] p-4">
      <div className="mx-auto max-w-2xl rounded-2xl glass-strong shadow-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-center gap-4">
        <Cookie className="w-6 h-6 text-[var(--accent)] shrink-0" />
        <p className="text-sm text-secondary text-center sm:text-left flex-1">
          We use cookies to keep your cart working and improve your experience on this site. By continuing, you agree to our use of cookies.
        </p>
        <button onClick={accept} className="btn-primary !py-2 !px-5 text-sm shrink-0 whitespace-nowrap">
          Accept
        </button>
      </div>
    </div>
  );
}
