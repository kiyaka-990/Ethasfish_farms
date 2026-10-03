import { NextRequest, NextResponse } from 'next/server';
import type { ModelMessage } from 'ai';
import { prisma } from '@/lib/prisma';
import { generateReply } from '@/lib/chatbot';
import { runSalesAgent } from '@/lib/agents/sales-agent';

export const dynamic = 'force-dynamic';

const AGENT_ENABLED = Boolean(process.env.VERCEL_OIDC_TOKEN || process.env.AI_GATEWAY_API_KEY);
const HISTORY_TURNS = 8;

export async function POST(req: NextRequest) {
  let message: string, sessionId: string | undefined;
  try {
    const body = await req.json();
    message = body.message;
    sessionId = body.sessionId;
    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'message required' }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: 'invalid request body' }, { status: 400 });
  }

  let text: string;
  let intent = 'ai';

  if (AGENT_ENABLED) {
    try {
      const history = sessionId
        ? await prisma.chatMessage.findMany({ where: { sessionId }, orderBy: { createdAt: 'desc' }, take: HISTORY_TURNS * 2 })
        : [];
      const messages: ModelMessage[] = [
        ...history.reverse().map(h => ({ role: h.role === 'bot' ? 'assistant' : 'user', content: h.content }) as ModelMessage),
        { role: 'user', content: message }
      ];
      const result = await runSalesAgent(messages, sessionId);
      text = result.text;
    } catch (e) {
      console.error('Sales agent failed, falling back to rule-based bot:', e);
      const fallback = await generateReply(message);
      text = fallback.text;
      intent = fallback.intent;
    }
  } else {
    const fallback = await generateReply(message);
    text = fallback.text;
    intent = fallback.intent;
  }

  if (sessionId) {
    prisma.chatMessage.createMany({
      data: [
        { sessionId, role: 'user', content: message },
        { sessionId, role: 'bot', content: text, metadata: JSON.stringify({ intent }) }
      ]
    }).catch(() => {/* silent */});
  }

  return NextResponse.json({ reply: text, intent });
}
