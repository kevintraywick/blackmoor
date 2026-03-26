import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';

// Static mapping prevents user-supplied strings from ever touching the query template
const PLAYER_COLUMNS: Record<string, string> = {
  discord: 'discord', species: 'species', class: 'class', level: 'level',
  hp: 'hp', xp: 'xp', speed: 'speed', size: 'size', ac: 'ac', gold: 'gold',
  boons: 'boons', class_features: 'class_features', species_traits: 'species_traits',
  player_notes: 'player_notes', general_notes: 'general_notes',
  gear: 'gear', spells: 'spells',
  dm_notes: 'dm_notes', status: 'status',
};

// Fields that contain JSON arrays and must be serialized before INSERT/UPDATE
const JSON_COLUMNS = new Set(['gear', 'spells']);

// GET /api/players/:id — fetch one player's sheet
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureSchema();
    const { id } = await params;

    const rows = await query('SELECT * FROM player_sheets WHERE id = $1', [id]);
    if (!rows[0]) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json(rows[0]);
  } catch (err) {
    console.error('GET /api/players/[id]', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

// PATCH /api/players/:id — update (or upsert) specific fields on a player sheet
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureSchema();
    const { id } = await params;
    const patch = await req.json();

    // Only update fields that exist in the static column map
    const keys = Object.keys(patch).filter(k => PLAYER_COLUMNS[k] !== undefined);
    if (keys.length === 0) return NextResponse.json({ error: 'No valid fields' }, { status: 400 });

    // Upsert: insert the row if it doesn't exist, then update the fields
    // This means a player sheet is created on first save — no manual seeding needed.
    await query(
      `INSERT INTO player_sheets (id) VALUES ($1) ON CONFLICT (id) DO NOTHING`,
      [id]
    );

    const setClauses = keys.map((k, i) => `${PLAYER_COLUMNS[k]} = $${i + 2}`).join(', ');
    const values = keys.map(k => JSON_COLUMNS.has(k) ? JSON.stringify(patch[k]) : patch[k]);
    await query(`UPDATE player_sheets SET ${setClauses} WHERE id = $1`, [id, ...values]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('PATCH /api/players/[id]', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
