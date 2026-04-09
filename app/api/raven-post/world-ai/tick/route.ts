import { NextResponse } from 'next/server';
import { runWorldAiTick } from '@/lib/world-ai-loop';

// POST /api/raven-post/world-ai/tick
// Triggers one tick of the World AI loop.
// When called by Railway Cron: check WORLD_AI_CRON_SECRET header.
// When called from the DM pane (same-origin): no auth needed.
export async function POST(req: Request) {
  try {
    // Auth check for cron: if WORLD_AI_CRON_SECRET is set and the request
    // includes an Authorization header, validate it. If no secret is set,
    // allow all requests (dev mode or not-yet-configured).
    const cronSecret = process.env.WORLD_AI_CRON_SECRET;
    const authHeader = req.headers.get('authorization');
    if (cronSecret && authHeader) {
      const token = authHeader.replace('Bearer ', '');
      if (token !== cronSecret) {
        return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
      }
    }

    // Determine trigger type: cron sends the header, browser doesn't
    const trigger = authHeader ? 'auto' : 'manual';

    const result = await runWorldAiTick(trigger);
    return NextResponse.json(result);
  } catch (err) {
    console.error('POST world-ai/tick', err);
    return NextResponse.json({ error: 'tick failed' }, { status: 500 });
  }
}
