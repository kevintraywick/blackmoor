import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';

// Static mapping prevents user-supplied strings from ever touching the query template
const SESSION_COLUMNS: Record<string, string> = {
  title: 'title', date: 'date', goal: 'goal', scenes: 'scenes',
  npcs: 'npcs', locations: 'locations', loose_ends: 'loose_ends', notes: 'notes',
  npc_ids: 'npc_ids', menagerie: 'menagerie',
  started_at: 'started_at', ended_at: 'ended_at',
};

// JSONB columns need JSON.stringify before passing to pg
const JSONB_COLUMNS = new Set(['npc_ids', 'menagerie']);

// GET /api/sessions/:id — fetch a single session
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const [session] = await query('SELECT * FROM sessions WHERE id = $1', [id]);
    if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(session);
  } catch (err) {
    console.error('GET /api/sessions/[id]', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

// DELETE /api/sessions/:id — remove a session
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await query('DELETE FROM sessions WHERE id = $1', [id]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/sessions/[id]', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

// PATCH /api/sessions/:id — update session fields
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    // Only update fields that exist in the static column map
    const updates = Object.entries(body)
      .filter(([k]) => SESSION_COLUMNS[k] !== undefined)
      .map(([k, v]) => [SESSION_COLUMNS[k], JSONB_COLUMNS.has(k) ? JSON.stringify(v) : v] as [string, unknown]);
    if (!updates.length) return NextResponse.json({ ok: true });

    const setClause = updates.map(([col], i) => `${col} = $${i + 1}`).join(', ');
    const values = updates.map(([, v]) => v);

    await query(
      `UPDATE sessions SET ${setClause}, last_modified = $${values.length + 1} WHERE id = $${values.length + 2}`,
      [...values, Date.now(), id]
    );

    const [session] = await query('SELECT * FROM sessions WHERE id = $1', [id]);
    return NextResponse.json(session);
  } catch (err) {
    console.error('PATCH /api/sessions/[id]', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

// POST /api/sessions/:id — session lifecycle actions (start, end)
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureSchema();
    const { id } = await params;
    const { action } = await req.json();
    const now = Date.now();

    if (action === 'start') {
      await query('UPDATE sessions SET started_at = $1 WHERE id = $2', [now, id]);
      await query(
        `INSERT INTO session_events (id, session_id, event_type, payload, created_at)
         VALUES (gen_random_uuid()::text, $1, 'session_start', '{}', $2)`,
        [id, now]
      );
    } else if (action === 'end') {
      await query('UPDATE sessions SET ended_at = $1 WHERE id = $2', [now, id]);
      await query(
        `INSERT INTO session_events (id, session_id, event_type, payload, created_at)
         VALUES (gen_random_uuid()::text, $1, 'session_end', '{}', $2)`,
        [id, now]
      );
    } else {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

    const [session] = await query('SELECT * FROM sessions WHERE id = $1', [id]);
    return NextResponse.json(session);
  } catch (err) {
    console.error('POST /api/sessions/[id]', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
