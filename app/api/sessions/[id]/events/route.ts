import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';

// GET /api/sessions/:id/events — list events, optionally filtered by type
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureSchema();
    const { id } = await params;
    const type = req.nextUrl.searchParams.get('type');

    const events = type
      ? await query(
          'SELECT * FROM session_events WHERE session_id = $1 AND event_type = $2 ORDER BY created_at DESC',
          [id, type]
        )
      : await query(
          'SELECT * FROM session_events WHERE session_id = $1 ORDER BY created_at DESC',
          [id]
        );

    return NextResponse.json(events);
  } catch (err) {
    console.error('GET /api/sessions/[id]/events', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

// POST /api/sessions/:id/events — log an event
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureSchema();
    const { id } = await params;
    const { event_type, payload = {} } = await req.json();

    if (!event_type) {
      return NextResponse.json({ error: 'event_type required' }, { status: 400 });
    }

    await query(
      `INSERT INTO session_events (id, session_id, event_type, payload, created_at)
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4)`,
      [id, event_type, JSON.stringify(payload), Date.now()]
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('POST /api/sessions/[id]/events', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
