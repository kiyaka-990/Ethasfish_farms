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
//
// Two paper shapes are supported:
//   a4      - invoices, purchase orders, the customer receipt page (default)
//   thermal - POS receipts on an 80mm receipt roll; adds a `paper-thermal`
//             body class that assigns the `.print-target` to a named
//             `@page thermal` (80mm wide) and narrows it to the roll.
//             If the print dialog's paper can't be changed to 80mm the
//             content still lays out at roll width, so nothing overlaps.
export interface PrintOptions {
  paper?: 'a4' | 'thermal';
}

export function printIsolated(options: PrintOptions = {}) {
  if (typeof document === 'undefined') return;

  const thermal = options.paper === 'thermal';
  const body = document.body;
  let done = false;
  const cleanup = () => {
    if (done) return;
    done = true;
    body.classList.remove('printing-target');
    body.classList.remove('paper-thermal');
    window.removeEventListener('afterprint', cleanup);
  };

  window.addEventListener('afterprint', cleanup);
  body.classList.add('printing-target');
  if (thermal) body.classList.add('paper-thermal');

  try {
    window.print();
  } finally {
    // Safari and some Chrome builds do not always fire `afterprint`.
    window.setTimeout(cleanup, 2000);
  }
}
