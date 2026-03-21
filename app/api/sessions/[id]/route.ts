import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

// DELETE /api/sessions/:id — remove a session
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await query('DELETE FROM sessions WHERE id = $1', [id]);
  return NextResponse.json({ ok: true });
}

// PATCH /api/sessions/:id — update session fields
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  // Build SET clause dynamically from provided fields
  const allowed = ['title', 'date', 'goal', 'scenes', 'npcs', 'locations', 'loose_ends', 'notes'];
  const updates = Object.entries(body).filter(([k]) => allowed.includes(k));
  if (!updates.length) return NextResponse.json({ ok: true });

  const setClause = updates.map(([k], i) => `${k} = $${i + 1}`).join(', ');
  const values = updates.map(([, v]) => v);

  await query(
    `UPDATE sessions SET ${setClause}, last_modified = $${values.length + 1} WHERE id = $${values.length + 2}`,
    [...values, Date.now(), id]
  );

  const [session] = await query('SELECT * FROM sessions WHERE id = $1', [id]);
  return NextResponse.json(session);
}
