import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

// Static mapping prevents user-supplied strings from ever touching the query template
const SESSION_COLUMNS: Record<string, string> = {
  title: 'title', date: 'date', goal: 'goal', scenes: 'scenes',
  npcs: 'npcs', locations: 'locations', loose_ends: 'loose_ends', notes: 'notes',
  npc_ids: 'npc_ids',
};

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
      .map(([k, v]) => [SESSION_COLUMNS[k], v] as [string, unknown]);
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
