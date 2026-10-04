// Sends receipts to customers via WhatsApp Cloud API (and optionally SMS via Africa's Talking)
// Receipt format matches the V-Farm style screenshot.

import { fmtKsh } from './utils';

interface ReceiptPayload {
  customerName: string;
  customerPhone: string;       // 254...
  orderNumber: string;
  status: string;
  items: Array<{ productName: string; variantLabel: string; quantity: number; lineTotal: number; weight?: string }>;
  subtotal: number;
  deliveryFee: number;
  total: number;
  mpesaRef?: string | null;
  servedAt?: string;
  vatRate?: number;
  vatAmount?: number;
  kraPin?: string | null;
}

export function buildReceiptText(p: ReceiptPayload): string {
  const now = new Date();
  const date = now.toLocaleDateString('en-GB');
  const time = now.toLocaleTimeString('en-GB', { hour12: false });

  const itemLines = p.items.map(i =>
    `${i.variantLabel} (${i.weight || ''}) × ${i.quantity} - ${fmtKsh(i.lineTotal)}`
  ).join('\n');

  return [
    `*ETHASFISH FARMS — Receipt*`,
    ``,
    `Name :: ${p.customerName}`,
    `Order :: ${p.orderNumber}`,
    `Date :: ${date}`,
    `Time :: ${time}`,
    `Status :: ${p.status === 'paid' ? '*PAID*' : p.status.toUpperCase()}`,
    p.servedAt ? `Served at :: ${p.servedAt}` : null,
    p.mpesaRef ? `M-Pesa Ref :: ${p.mpesaRef}` : null,
    ``,
    `Items ::`,
    itemLines,
    ``,
    `Subtotal :: ${fmtKsh(p.subtotal)}`,
    `Delivery :: ${fmtKsh(p.deliveryFee)}`,
    `*Grand Total :: ${fmtKsh(p.total)}*`,
    p.vatAmount ? `(Includes VAT ${p.vatRate}% :: ${fmtKsh(p.vatAmount)})` : null,
    p.kraPin ? `KRA PIN :: ${p.kraPin}` : null,
    ``,
    `All transactions are done in real-time.`,
    `Always pay through the official Ethasfish till number.`,
    ``,
    `Thank you for your order! 🐟`,
    `Track: ${process.env.NEXT_PUBLIC_SITE_URL || 'https://ethasfish.co.ke'}/track?order=${p.orderNumber}`
  ].filter(Boolean).join('\n');
}

export async function sendWhatsAppReceipt(p: ReceiptPayload): Promise<boolean> {
  if (!process.env.WHATSAPP_TOKEN || !process.env.WHATSAPP_PHONE_NUMBER_ID) {
    console.log('[receipt] WhatsApp not configured, skipping');
    return false;
  }
  try {
    const body = buildReceiptText(p);
    const res = await fetch(`https://graph.facebook.com/v20.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: p.customerPhone,
        text: { body }
      })
    });
    return res.ok;
  } catch (e) {
    console.error('[receipt] WhatsApp send failed:', e);
    return false;
  }
}

// Africa's Talking SMS - optional
export async function sendSmsReceipt(p: ReceiptPayload): Promise<boolean> {
  if (!process.env.AT_API_KEY || !process.env.AT_USERNAME) return false;
  try {
    const body = buildReceiptText(p);
    const params = new URLSearchParams({
      username: process.env.AT_USERNAME,
      to: '+' + p.customerPhone,
      message: body,
      from: process.env.AT_SENDER_ID || ''
    });
    const res = await fetch('https://api.africastalking.com/version1/messaging', {
      method: 'POST',
      headers: { 'apiKey': process.env.AT_API_KEY!, 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
      body: params.toString()
    });
    return res.ok;
  } catch (e) {
    console.error('[receipt] SMS send failed:', e);
    return false;
  }
}

// Email receipt via Resend (optional)
export async function sendEmailReceipt(p: ReceiptPayload, email: string): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) return false;
  try {
    const html = `
      <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#F3F7FC;color:#0B1F3A;">
        <div style="text-align:center;margin-bottom:24px;">
          <h1 style="background:linear-gradient(135deg,#3B93CE,#1C6EA8);-webkit-background-clip:text;background-clip:text;color:transparent;margin:0;font-size:28px;">Ethasfish Farms</h1>
          <p style="margin:4px 0 0;color:#5B7190;font-size:13px;">Lake Victoria · Kisumu County</p>
        </div>
        <div style="background:#fff;border:1px solid #d4ede4;border-radius:16px;padding:24px;">
          <h2 style="margin:0 0 16px;font-size:18px;">Receipt</h2>
          <table style="width:100%;font-size:14px;line-height:1.6;">
            <tr><td style="color:#5B7190;">Name</td><td>${p.customerName}</td></tr>
            <tr><td style="color:#5B7190;">Order</td><td><code>${p.orderNumber}</code></td></tr>
            <tr><td style="color:#5B7190;">Date</td><td>${new Date().toLocaleString('en-GB')}</td></tr>
            <tr><td style="color:#5B7190;">Status</td><td><strong style="color:#1C6EA8;">${p.status.toUpperCase()}</strong></td></tr>
            ${p.mpesaRef ? `<tr><td style="color:#5B7190;">M-Pesa Ref</td><td><code>${p.mpesaRef}</code></td></tr>` : ''}
          </table>
          <hr style="border:none;border-top:1px solid #d4ede4;margin:16px 0;">
          <h3 style="margin:0 0 8px;font-size:14px;color:#5B7190;text-transform:uppercase;letter-spacing:1px;">Items</h3>
          ${p.items.map(i => `<div style="display:flex;justify-content:space-between;padding:6px 0;font-size:14px;"><span>${i.variantLabel} × ${i.quantity}</span><strong>${fmtKsh(i.lineTotal)}</strong></div>`).join('')}
          <hr style="border:none;border-top:1px solid #d4ede4;margin:16px 0;">
          <div style="display:flex;justify-content:space-between;font-size:14px;color:#5B7190;"><span>Subtotal</span><span>${fmtKsh(p.subtotal)}</span></div>
          <div style="display:flex;justify-content:space-between;font-size:14px;color:#5B7190;"><span>Delivery</span><span>${fmtKsh(p.deliveryFee)}</span></div>
          <div style="display:flex;justify-content:space-between;margin-top:8px;font-size:18px;font-weight:bold;color:#1C6EA8;"><span>Grand Total</span><span>${fmtKsh(p.total)}</span></div>
        </div>
        <p style="margin-top:16px;font-size:12px;color:#5B7190;text-align:center;">All transactions are done in real-time. Always pay through our official till number.</p>
        <p style="margin-top:8px;font-size:12px;color:#5B7190;text-align:center;"><a href="${process.env.NEXT_PUBLIC_SITE_URL || ''}/track?order=${p.orderNumber}" style="color:#1C6EA8;">Track your order →</a></p>
      </div>
    `;
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.FROM_EMAIL || 'Ethasfish Farms <orders@ethasfish.co.ke>',
        to: email,
        subject: `Receipt - Order ${p.orderNumber}`,
        html
      })
    });
    return res.ok;
  } catch (e) {
    console.error('[receipt] Email send failed:', e);
    return false;
  }
}

export async function dispatchReceipt(p: ReceiptPayload, email?: string | null): Promise<{ whatsapp: boolean; sms: boolean; email: boolean }> {
  const [whatsapp, sms, emailRes] = await Promise.all([
    sendWhatsAppReceipt(p),
    sendSmsReceipt(p),
    email ? sendEmailReceipt(p, email) : Promise.resolve(false)
  ]);
  return { whatsapp, sms, email: emailRes };
}
