import { NextResponse } from 'next/server';
import { ensureSchema } from '@/lib/schema';
import { advanceGameTime, ClockPausedError, getGameClock } from '@/lib/game-clock';
import { broadcast } from '@/lib/events';

// POST /api/clock/advance
// Body: { seconds: number }
// Advances the campaign-wide game clock and (per Unit 8) ticks world entities
// along their waypoint paths.
export async function POST(req: Request) {
  try {
    await ensureSchema();
    const body = await req.json();
    const { seconds } = body;
    if (typeof seconds !== 'number' || seconds <= 0) {
      return NextResponse.json({ error: 'seconds must be a positive number' }, { status: 400 });
    }
    const clock = await advanceGameTime(seconds);
    // Fan out to any SSE subscriber so ambience surfaces refresh without polling.
    broadcast('game_clock', 'default', 'patch');
    return NextResponse.json({ ok: true, clock });
  } catch (err) {
    if (err instanceof ClockPausedError) {
      return NextResponse.json({ error: 'Clock is paused' }, { status: 409 });
    }
    console.error('POST /api/clock/advance', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

// GET /api/clock/advance — convenience for clients to read the current clock.
export async function GET() {
  try {
    await ensureSchema();
    const clock = await getGameClock();
    return NextResponse.json(clock);
  } catch (err) {
    console.error('GET /api/clock/advance', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
