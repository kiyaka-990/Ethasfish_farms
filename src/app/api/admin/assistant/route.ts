import { NextRequest, NextResponse } from 'next/server';
import { requireStaff, identityErrorStatus } from '@/lib/identity';
import { runAdminAgent } from '@/lib/agents/admin-agent';

export const dynamic = 'force-dynamic';

const AGENT_ENABLED = Boolean(process.env.VERCEL_OIDC_TOKEN || process.env.AI_GATEWAY_API_KEY);

export async function POST(req: NextRequest) {
  try {
    await requireStaff();
    if (!AGENT_ENABLED) {
      return NextResponse.json({ reply: "The AI Gateway isn't connected yet, so I can't look anything up right now - check the relevant admin page directly (Orders, Inventory, Accounting, Leads)." });
    }
    const { message } = await req.json();
    if (!message || typeof message !== 'string') return NextResponse.json({ error: 'message required' }, { status: 400 });

    try {
      const result = await runAdminAgent(message);
      return NextResponse.json({ reply: result.text });
    } catch (e) {
      console.error('Admin agent failed:', e);
      return NextResponse.json({ reply: "I couldn't process that just now. Try again, or check the relevant admin page directly." });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: identityErrorStatus(e) });
  }
}
