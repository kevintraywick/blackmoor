import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import { pauseClock, resumeClock, getGameClock } from '@/lib/game-clock';

// POST /api/sessions/[id]/control
// Body: { action: 'pause' | 'resume' | 'end' }
//
// pause:  set sessions.status='paused', pause the campaign clock
// resume: set sessions.status='open',   resume the campaign clock
// end:    set sessions.status='ended',  pause the campaign clock (does not
//         auto-resume — the clock stays where it is until the next session)
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureSchema();
    const { id } = await params;
    const body = await req.json();
    const { action } = body;

    if (action !== 'pause' && action !== 'resume' && action !== 'end') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const [session] = await query<{ id: string; status: string }>(
      `SELECT id, status FROM sessions WHERE id = $1`,
      [id]
    );
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    let newStatus = session.status;
    if (action === 'pause') {
      newStatus = 'paused';
      await pauseClock();
    } else if (action === 'resume') {
      newStatus = 'open';
      await resumeClock();
    } else {
      newStatus = 'ended';
      await pauseClock();
    }

    await query(`UPDATE sessions SET status = $1 WHERE id = $2`, [newStatus, id]);
    const clock = await getGameClock();

    return NextResponse.json({ ok: true, status: newStatus, clock });
  } catch (err) {
    console.error('POST /api/sessions/[id]/control', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

// GET /api/sessions/[id]/control
// Returns current session status + global clock state, used by the bar to poll.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureSchema();
    const { id } = await params;
    const [session] = await query<{ id: string; status: string }>(
      `SELECT id, status FROM sessions WHERE id = $1`,
      [id]
    );
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }
    const clock = await getGameClock();
    return NextResponse.json({ status: session.status, clock });
  } catch (err) {
    console.error('GET /api/sessions/[id]/control', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
