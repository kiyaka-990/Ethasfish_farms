import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateReply } from '@/lib/chatbot';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { message, sessionId } = await req.json();
    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'message required' }, { status: 400 });
    }

    const { text, intent } = await generateReply(message);

    // Persist conversation (best-effort, don't block reply)
    if (sessionId) {
      prisma.chatMessage.createMany({
        data: [
          { sessionId, role: 'user', content: message },
          { sessionId, role: 'bot', content: text, metadata: JSON.stringify({ intent }) }
        ]
      }).catch(() => {/* silent */});
    }

    return NextResponse.json({ reply: text, intent });
  } catch (e: any) {
    console.error('Chatbot error:', e);
    return NextResponse.json({
      reply: "I'm having trouble right now. You can WhatsApp our team directly — tap the green button!",
      intent: 'error'
    });
  }
}
