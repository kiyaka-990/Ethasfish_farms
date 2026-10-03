// M-Pesa Daraja API helpers
// Docs: https://developer.safaricom.co.ke/docs

const MPESA_BASE = process.env.MPESA_ENV === 'production'
  ? 'https://api.safaricom.co.ke'
  : 'https://sandbox.safaricom.co.ke';

export async function getMpesaToken(): Promise<string> {
  const key = process.env.MPESA_CONSUMER_KEY!;
  const secret = process.env.MPESA_CONSUMER_SECRET!;
  if (!key || !secret) throw new Error('M-Pesa credentials not configured');

  const auth = Buffer.from(`${key}:${secret}`).toString('base64');
  const res = await fetch(`${MPESA_BASE}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` },
    cache: 'no-store'
  });
  if (!res.ok) throw new Error(`M-Pesa auth failed: ${res.status}`);
  const data = await res.json();
  return data.access_token as string;
}

export interface STKPushParams {
  phone: string;       // 2547XXXXXXXX
  amount: number;
  reference: string;
  description: string;
}

export interface STKPushResponse {
  CheckoutRequestID?: string;
  MerchantRequestID?: string;
  ResponseCode?: string;
  ResponseDescription?: string;
  CustomerMessage?: string;
  errorMessage?: string;
}

function normalizePhone(phone: string): string {
  let p = phone.replace(/\D/g, '');
  if (p.startsWith('0')) p = '254' + p.slice(1);
  if (p.startsWith('7') || p.startsWith('1')) p = '254' + p;
  if (p.startsWith('+')) p = p.slice(1);
  return p;
}

export async function stkPush(params: STKPushParams): Promise<STKPushResponse> {
  const shortcode = process.env.MPESA_SHORTCODE!;
  const passkey = process.env.MPESA_PASSKEY!;
  const callbackSecret = process.env.MPESA_CALLBACK_SECRET!;
  if (!shortcode || !passkey || !process.env.MPESA_CALLBACK_URL || !callbackSecret) throw new Error('M-Pesa env vars missing');
  // The callback secret is appended server-side only - Safaricom calls this
  // exact URL back, so a mismatched/missing token means the request isn't
  // really from Safaricom (see /api/payments/mpesa/callback).
  const callback = `${process.env.MPESA_CALLBACK_URL}?token=${encodeURIComponent(callbackSecret)}`;

  const token = await getMpesaToken();
  const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, '').slice(0, 14);
  const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');
  const phone = normalizePhone(params.phone);

  const body = {
    BusinessShortCode: shortcode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: 'CustomerPayBillOnline',
    Amount: Math.round(params.amount),
    PartyA: phone,
    PartyB: shortcode,
    PhoneNumber: phone,
    CallBackURL: callback,
    AccountReference: params.reference.slice(0, 12),
    TransactionDesc: params.description.slice(0, 13)
  };

  const res = await fetch(`${MPESA_BASE}/mpesa/stkpush/v1/processrequest`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store'
  });
  return await res.json();
}
