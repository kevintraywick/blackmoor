import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';

// GET /api/players/:id — fetch one player's sheet
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await ensureSchema();
  const { id } = await params;

  const rows = await query('SELECT * FROM player_sheets WHERE id = $1', [id]);
  if (!rows[0]) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json(rows[0]);
}

// PATCH /api/players/:id — update (or upsert) specific fields on a player sheet
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await ensureSchema();
  const { id } = await params;
  const patch = await req.json();

  // Build a dynamic SET clause from only the provided fields
  const allowed = ['discord','species','class','level','hp','xp','speed','size','ac',
                   'boons','class_features','species_traits','player_notes','general_notes','gear'];
  const keys = Object.keys(patch).filter(k => allowed.includes(k));
  if (keys.length === 0) return NextResponse.json({ error: 'No valid fields' }, { status: 400 });

  // Upsert: insert the row if it doesn't exist, then update the fields
  // This means a player sheet is created on first save — no manual seeding needed.
  await query(
    `INSERT INTO player_sheets (id) VALUES ($1) ON CONFLICT (id) DO NOTHING`,
    [id]
  );

  const setClauses = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
  const values = keys.map(k => k === 'gear' ? JSON.stringify(patch[k]) : patch[k]);
  await query(`UPDATE player_sheets SET ${setClauses} WHERE id = $1`, [id, ...values]);

  return NextResponse.json({ ok: true });
}
