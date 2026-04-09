import { NextResponse } from 'next/server';
import { triggerOverheard } from '@/lib/raven-post';

// POST /api/raven-post/overheard/trigger
// Body: { playerId: string }
// Returns: { result: 'sent'|'cooldown'|'empty'|'no-optin'|'no-twilio' }
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const playerId = typeof body.playerId === 'string' ? body.playerId : null;
    if (!playerId) {
      return NextResponse.json({ error: 'playerId required' }, { status: 400 });
    }
    const result = await triggerOverheard(playerId);
    return NextResponse.json({ result });
  } catch (err) {
    console.error('POST overheard trigger', err);
    return NextResponse.json({ error: 'trigger failed' }, { status: 500 });
  }
}
