// Generates public/manual/ethasfish-portal-manual.pdf - the downloadable
// staff manual linked from the portal sidebar. Zero dependencies: writes
// the PDF byte-by-byte with the standard Helvetica fonts (no embedding).
//
//   node scripts/make-manual.mjs
//
// Re-run after changing the CONTENT below; the PDF is committed so deploys
// always have it even if nobody regenerates.

import { mkdirSync, writeFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'manual', 'ethasfish-portal-manual.pdf');

// ---------- page geometry (A4 points) ----------
const W = 595.28, H = 841.89, M = 56;
const CONTENT = W - 2 * M;          // 483.28 usable width
const BOTTOM = 64;                  // footer zone below this

// ---------- fonts (standard PDF base-14, no embedding) ----------
const TITLE = 'F1', BOLD = 'F2', BODY = 'F3';

// ---------- WinAnsi-safe encoding ----------
// Text is written with latin1 byte mapping, so only code points whose low
// byte matches WinAnsiEncoding are allowed. ASCII + these three are safe:
const BULLET = '\u0095';            // WinAnsi 0x95 = bullet
const MIDDOT = '\u00B7';            // WinAnsi 0xB7 = middle dot
// (Em/en dashes, ellipses and the U+2022 bullet encode to the WRONG byte
// under latin1 - never use them here. Use " - " and straight quotes.)

function esc(s) {
  return s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

// Crude per-character width estimate for Helvetica (1000-unit em).
// Bucketed: close enough that nothing overflows the right margin.
const NARROW = new Set("iljtfrI.,;:!|'`()[]{}/\\ ".split(''));
const WIDE = new Set('MWmw@'.split(''));
function widthOf(str, size) {
  let w = 0;
  for (const ch of str) {
    const u = NARROW.has(ch) ? 0.30 : WIDE.has(ch) ? 0.88 : 0.55;
    w += u * size;
  }
  return w;
}

function wrap(text, size, limit) {
  const out = [];
  for (const raw of text.split('\n')) {
    const words = raw.split(/\s+/).filter(Boolean);
    if (!words.length) { out.push(''); continue; }
    let line = '';
    for (let word of words) {
      // force-break a word wider than the whole column
      while (widthOf(word, size) > limit) {
        if (line) { out.push(line); line = ''; }
        let cut = 1;
        while (widthOf(word.slice(0, cut + 1), size) <= limit) cut++;
        out.push(word.slice(0, cut));
        word = word.slice(cut);
      }
      const candidate = line ? line + ' ' + word : word;
      if (widthOf(candidate, size) <= limit) line = candidate;
      else { if (line) out.push(line); line = word; }
    }
    if (line) out.push(line);
  }
  return out;
}

// ---------- document model ----------
const pages = [];
let ops = null;
let y = 0;

function newPage() { ops = []; pages.push(ops); y = H - M; }
function ensure(h) { if (y - h < BOTTOM) newPage(); }

function textAt(str, x, yy, font, size, gray) {
  ops.push(
    `BT /${font} ${size} Tf ${gray} rg 1 0 0 1 ${x.toFixed(2)} ${yy.toFixed(2)} Tm (${esc(str)}) Tj ET`
  );
}

function rule(yy, gray, weight) {
  ops.push(`${gray} G ${weight} w ${M} ${yy.toFixed(2)} m ${(W - M).toFixed(2)} ${yy.toFixed(2)} l S`);
}

function heading(s) {
  ensure(54);
  y -= 22;
  textAt(s, M, y, BOLD, 15, '0.11 0.43 0.66');
  y -= 8;
  ensure(10);
  rule(y, '0.85', 0.8);
  y -= 6;
}

function para(s) {
  const lines = wrap(s, 10.5, CONTENT);
  for (const ln of lines) {
    ensure(15);
    y -= 14;
    textAt(ln, M, y, BODY, 10.5, '0.17 0.19 0.24');
  }
  y -= 6;
}

function bullet(s) {
  const indent = 15;
  const lines = wrap(s, 10.5, CONTENT - indent);
  let first = true;
  for (const ln of lines) {
    ensure(15);
    y -= 14;
    if (first) { textAt(BULLET, M, y, BODY, 10.5, '0.11 0.43 0.66'); first = false; }
    textAt(ln, M + indent, y, BODY, 10.5, '0.17 0.19 0.24');
  }
}

function gap(n) { y -= n; }

// ---------- cover page ----------
newPage();
ops.push(`0.11 0.43 0.66 rg ${M} ${y - 6} 44 5 re f`); // accent bar
y -= 44;
textAt('ETHASFISH FARMS', M, y, BOLD, 13, '0.11 0.43 0.66');
y -= 46;
textAt('Portal User Manual', M, y, TITLE, 34, '0.04 0.12 0.23');
y -= 24;
textAt('Staff guide to the POS, Orders, Credit ledger, Stock and CMS tools', M, y, BODY, 12, '0.36 0.44 0.57');
y -= 20;
textAt(`Version 2.0 ${MIDDOT} October 2026`, M, y, BODY, 10.5, '0.5 0.55 0.62');
y -= 18;
rule(y, '0.85', 1);
y -= 34;

const onCover = (s) => {
  ensure(16);
  y -= 15;
  textAt(s, M, y, BOLD, 11, '0.17 0.19 0.24');
};
onCover("What's inside");
y -= 6;
[
  '1. Getting Started   2. Dashboard   3. Point of Sale   4. Orders',
  '5. Credit Ledger   6. Fish Stock   7. Products, Media & Site Content',
  '8. Invoices & Accounting   9. Receipts   10. AI Assistant & Agents   11. Quick Glossary'
].forEach(t => { ensure(15); y -= 14; textAt(t, M, y, BODY, 10.5, '0.36 0.44 0.57'); });

y -= 26;
ensure(30);
y -= 14;
textAt('This PDF lives in the portal sidebar - look for "Portal Manual" to', M, y, BODY, 10, '0.5 0.55 0.62');
y -= 14;
textAt('download the latest copy at any time.', M, y, BODY, 10, '0.5 0.55 0.62');

newPage();

// ---------- sections ----------
heading('1. Getting Started');
para('Sign in at /sign-in with your staff account. Admins see every section in this manual; sales managers get the day-to-day till tools - Dashboard, Assistant, Point of Sale, Orders, Credit, Leads, Products, Promotions and Stock.');
bullet('Desktop shows a sidebar on the left; on phones and tablets tap the menu icon at the top to open the same navigation.');
bullet('Use the sun/moon button to switch light/dark theme - your choice is remembered.');
bullet('Sign out from the icon at the bottom of the sidebar (or the one inside the mobile menu).');
bullet('Accounting, Purchasing, Invoices, Site Content, Media, Bot FAQs, Activity Log, Staff and Settings are admin-only sections.');

heading('2. Dashboard (/admin)');
bullet('Four cards - Total orders, Pending, This month (revenue from paid orders only) and Active products.');
bullet('Recent Orders shows the last 8 orders with their status and payment colour; "View all" jumps to Orders.');

heading('3. Point of Sale (/admin/pos)');
bullet('Search or tap a product variant to add it to the cart; + / - adjusts quantity and can never exceed the live stock figure.');
bullet('Press Charge and pick how the customer pays: Cash (quick notes, change due), M-Pesa (enter the reference from the customer\'s confirmation SMS), or Credit.');
bullet('Credit: customer name, phone and a payment due date are required. The sale is saved unpaid and the printed receipt says PAY LATER with the due date.');
bullet('The till shares stock with the online shop - every POS sale reduces website stock instantly, and the website does the same for the till.');
bullet('Print the receipt from the confirmation popup, or install the POS as its own app with the "Install App" button.');

heading('4. Orders (/admin/orders)');
bullet('Filter by fulfilment status (pending, paid, preparing, out_for_delivery, delivered, cancelled) or by payment: All / Owed / Credit / Paid.');
bullet('POS sales carry a POS badge, credit sales show a CREDIT badge, and anything unpaid past its due date gets a red OVERDUE outline with the number of days late.');
bullet('Record Payment accepts any amount up to the outstanding balance (cash, mpesa, bank or mobile) with an optional reference. Part-payments are allowed - the balance stays owed until it is settled in full.');
bullet('Resend Receipt pushes the receipt again through WhatsApp / SMS / email when those channels are configured; View Receipt opens the printable copy.');

heading('5. Credit Ledger (/admin/credit)');
bullet('Three totals across the top - total owed, how much of it is overdue, and how many customers owe anything.');
bullet('Tap a customer row to expand their open orders with due dates; Record Payment settles an order without leaving the page.');
bullet('The ledger fills itself from POS credit sales and unpaid orders - every payment recorded here also appears on the order in Orders.');

heading('6. Fish Stock (/admin/stock)');
bullet('Record harvests from numbered cages, ponds or the hatchery (pieces + kilograms) - this builds up farm stock.');
bullet('Distribute farm stock to outlets, then record outlet sales in pieces and/or kilograms. Balances are always derived: farm = harvests - distributions; outlet = distributions - sales.');
bullet('Low-stock alerts fire when an outlet drops to its per-outlet piece/kg thresholds (set them on the outlet; 0 turns an alert off).');
bullet('The Stockist Agent (chat on the Stock tab) answers stock questions and can record harvests, distributions and sales for you.');

heading('7. Products, Media & Site Content');
bullet('/admin/products - products and their variants (label, pieces, weight, price, stock). A price of 0 means quote-only: it is hidden from the till.');
bullet('/admin/media - drag & drop images and videos; reuse them anywhere with Upload / Library in the media picker.');
bullet('/admin/content - edit the homepage, hero slides, stats and the farm gallery. Saves go live immediately - no redeploy needed.');
bullet('Product stock and fish stock are separate on purpose: packed variants track shop stock, while the fish ledger tracks pieces/kg at the farm and outlets.');

heading('8. Invoices & Accounting (admin)');
bullet('/admin/invoices - raise an invoice with an optional due date; move it draft -> sent -> paid, or overdue / void; print from the invoice page.');
bullet('/admin/expenses - log expenses; the accounting summary counts paid orders only.');
bullet('/admin/settings - VAT rate and KRA PIN (0% while not VAT-registered; prices are treated as VAT-inclusive either way).');
bullet('/admin/purchasing - supplier purchase orders. /admin/staff - who can sign in. /admin/activity - every action, with who did it.');

heading('9. Receipts & Notifications');
bullet('Receipts go out via WhatsApp, SMS (Africa\'s Talking) and email (Resend) - each channel is skipped quietly when its API key is not set.');
bullet('Every receipt includes the order number and a track link (/track) the customer can open any time to check status.');

heading('10. AI Assistant & Agents');
bullet('/admin/assistant answers read-only questions about the business; the Stockist Agent on the Stock tab can also write stock movements through validated tools.');
bullet('/admin/agents (admin) lists every run - model, tokens used and which tools were called.');
bullet('Premium models need Vercel AI Gateway credits; without them the agents fall back to a free-tier model (or the rule-based storefront bot).');

heading('11. Quick Glossary');
bullet('Order status - pending, paid, preparing, out_for_delivery, delivered, cancelled: where the goods are.');
bullet('Payment status - unpaid, processing, partially_paid, paid, failed: where the money is. Revenue figures count paid orders only.');
bullet('Channel - online (website checkout) or pos (till). Method - mpesa, cash or credit.');
bullet('Credit terms - due date set at the sale; the order turns overdue once that date passes while still unpaid.');

// ---------- footers (page total known only now) ----------
const total = pages.length;
pages.forEach((page, i) => {
  const label = `Ethasfish Farms ${MIDDOT} Portal User Manual ${MIDDOT} Page ${i + 1} of ${total}`;
  const x = (W - widthOf(label, 8)) / 2;
  page.push(`BT /${BODY} 8 Tf 0.55 0.58 0.63 rg 1 0 0 1 ${x.toFixed(2)} 34 Tm (${esc(label)}) Tj ET`);
});

// ---------- serialize ----------
const chunks = [];
let offset = 0;
const offsets = []; // object number -> byte offset
function push(str) { const b = Buffer.from(str, 'latin1'); chunks.push(b); offset += b.length; }

push('%PDF-1.4\n%\u00E2\u00E3\u00CF\u00D3\n'); // binary comment: marks file as binary

const objs = []; // fn() -> body string, in object order (index 0 = obj 1)
objs.push('<< /Type /Catalog /Pages 2 0 R >>');
const fontBodies = {
  [TITLE]: '/Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding',
  [BOLD]: '/Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding',
  [BODY]: '/Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding'
};
const fontObjs = { [TITLE]: 3, [BOLD]: 4, [BODY]: 5 };
objs.push('<< /Type /Pages /Kids [' +
  pages.map((_, i) => `${6 + i * 2} 0 R`).join(' ') +
  `] /Count ${pages.length} >>`);
objs.push(`<< ${fontBodies[TITLE]} >>`);
objs.push(`<< ${fontBodies[BOLD]} >>`);
objs.push(`<< ${fontBodies[BODY]} >>`);
pages.forEach((page, i) => {
  const content = page.join('\n');
  const pageNum = 6 + i * 2;
  const streamNum = pageNum + 1;
  objs.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] ` +
    `/Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents ${streamNum} 0 R >>`);
  objs.push(`<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`);
});

objs.forEach((body, i) => {
  offsets[i + 1] = offset;
  push(`${i + 1} 0 obj\n${body}\nendobj\n`);
});

const xrefAt = offset;
const size = objs.length + 1;
let xref = `xref\n0 ${size}\n0000000000 65535 f \n`;
for (let n = 1; n < size; n++) {
  xref += `${String(offsets[n]).padStart(10, '0')} 00000 n \n`;
}
push(xref);
push(`trailer\n<< /Size ${size} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`);

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, Buffer.concat(chunks));

const kb = (statSync(OUT).size / 1024).toFixed(1);
console.log(`Wrote ${OUT}`);
console.log(`Pages: ${pages.length} | Size: ${kb} KB`);
