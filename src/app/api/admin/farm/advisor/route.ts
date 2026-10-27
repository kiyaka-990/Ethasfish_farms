import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, identityErrorStatus } from '@/lib/identity';
import { runFarmAdvisor } from '@/lib/agents/farm-agent';

export const dynamic = 'force-dynamic';

const AGENT_ENABLED = Boolean(process.env.VERCEL_OIDC_TOKEN || process.env.AI_GATEWAY_API_KEY);

// Chat endpoint for the farm advisor: reads live telemetry through its
// tools and can queue pump/aerator commands (audited like every other
// agent write). Same AI Gateway enablement as the stockist agent.
export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    if (!AGENT_ENABLED) {
      return NextResponse.json({
        reply:
          "The AI Gateway isn't connected yet, so I can't interpret the readings right now - the live charts, alert rules and the pump buttons on this page all still work."
      });
    }
    const { message } = await req.json();
    if (!message || typeof message !== 'string') return NextResponse.json({ error: 'message required' }, { status: 400 });

    try {
      const result = await runFarmAdvisor(message);
      return NextResponse.json({ reply: result.text });
    } catch (e) {
      console.error('Farm advisor failed:', e);
      return NextResponse.json({ reply: "I couldn't process that just now - try again, or act from the charts and rules below." });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: identityErrorStatus(e) });
  }
}
