// In-page printing.
//
// Printing through window.open() is unreliable in this app: popup blockers
// (and the installed POS PWA, which blocks window.open outright) silently
// swallow the new window, so the button appears to do nothing; and even
// when the window opens, printing a document before it finishes loading
// yields a blank sheet.
//
// Instead we print the current page with a `printing-target` class on
// <body>. The @media print rules in globals.css key off that class: every
// element is hidden except the one marked `.print-target`, so only the
// receipt / invoice / purchase order is painted, at the top-left of the
// sheet, with no portal chrome around it.
export function printIsolated() {
  if (typeof document === 'undefined') return;

  const body = document.body;
  let done = false;
  const cleanup = () => {
    if (done) return;
    done = true;
    body.classList.remove('printing-target');
    window.removeEventListener('afterprint', cleanup);
  };

  window.addEventListener('afterprint', cleanup);
  body.classList.add('printing-target');

  try {
    window.print();
  } finally {
    // Safari and some Chrome builds do not always fire `afterprint`.
    window.setTimeout(cleanup, 2000);
  }
}