import { NextRequest, NextResponse } from 'next/server';
import { requireStaff, identityErrorStatus } from '@/lib/identity';
import { runStockistAgent } from '@/lib/agents/stockist-agent';

export const dynamic = 'force-dynamic';

const AGENT_ENABLED = Boolean(process.env.VERCEL_OIDC_TOKEN || process.env.AI_GATEWAY_API_KEY);

// Chat endpoint for the stockist agent. Unlike the read-only admin
// assistant, this one can also RECORD harvests, distributions and sales
// through its tools - all of which validate against live balances and
// land in the audit trail.
export async function POST(req: NextRequest) {
  try {
    await requireStaff();
    if (!AGENT_ENABLED) {
      return NextResponse.json({
        reply: "The AI Gateway isn't connected yet, so I can't look anything up right now - use the Stock tab forms to record harvests, distributions and sales."
      });
    }
    const { message } = await req.json();
    if (!message || typeof message !== 'string') return NextResponse.json({ error: 'message required' }, { status: 400 });

    try {
      const result = await runStockistAgent(message);
      return NextResponse.json({ reply: result.text });
    } catch (e) {
      console.error('Stockist agent failed:', e);
      return NextResponse.json({ reply: "I couldn't process that just now. Try again, or use the Stock tab forms directly." });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: identityErrorStatus(e) });
  }
}
