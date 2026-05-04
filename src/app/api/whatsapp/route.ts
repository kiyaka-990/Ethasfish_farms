import { NextRequest, NextResponse } from 'next/server';
import { generateReply } from '@/lib/chatbot';

export const dynamic = 'force-dynamic';

// Meta verification handshake
export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get('hub.mode');
  const token = req.nextUrl.searchParams.get('hub.verify_token');
  const challenge = req.nextUrl.searchParams.get('hub.challenge');
  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse('Forbidden', { status: 403 });
}

// Incoming WhatsApp message
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const change = body?.entry?.[0]?.changes?.[0]?.value;
    const message = change?.messages?.[0];
    if (!message) return NextResponse.json({ ok: true });

    const from = message.from;
    const text = message.text?.body;
    if (!text || !from) return NextResponse.json({ ok: true });

    const { text: reply } = await generateReply(text);

    // Send reply via WhatsApp Cloud API
    if (process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID) {
      await fetch(`https://graph.facebook.com/v20.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: from,
          text: { body: reply }
        })
      });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('WhatsApp webhook error:', e);
    return NextResponse.json({ ok: true });
  }
}
