import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';

// Static mapping prevents user-supplied strings from ever touching the query template
const PLAYER_COLUMNS: Record<string, string> = {
  discord: 'discord', species: 'species', class: 'class', level: 'level',
  hp: 'hp', xp: 'xp', speed: 'speed', size: 'size', ac: 'ac', gold: 'gold',
  boons: 'boons', class_features: 'class_features', species_traits: 'species_traits',
  player_notes: 'player_notes', general_notes: 'general_notes',
  gear: 'gear', spells: 'spells', items: 'items',
  dm_notes: 'dm_notes', status: 'status',
};

// DM-only fields — don't log changes for these
const DM_ONLY_FIELDS = new Set(['dm_notes', 'status']);

// Fields that contain JSON arrays and must be serialized before INSERT/UPDATE
const JSON_COLUMNS = new Set(['gear', 'spells', 'items']);

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

    // Capture old values before update for change logging
    const trackableKeys = keys.filter(k => !DM_ONLY_FIELDS.has(k));
    let oldRow: Record<string, unknown> | undefined;
    if (trackableKeys.length > 0) {
      const cols = trackableKeys.map(k => PLAYER_COLUMNS[k]).join(', ');
      const rows = await query<Record<string, unknown>>(`SELECT ${cols} FROM player_sheets WHERE id = $1`, [id]);
      oldRow = rows[0];
    }

    const setClauses = keys.map((k, i) => `${PLAYER_COLUMNS[k]} = $${i + 2}`).join(', ');
    const values = keys.map(k => JSON_COLUMNS.has(k) ? JSON.stringify(patch[k]) : patch[k]);
    await query(`UPDATE player_sheets SET ${setClauses} WHERE id = $1`, [id, ...values]);

    // Log actual changes (fire-and-forget, never blocks the response)
    if (oldRow && trackableKeys.length > 0) {
      const inserts: { field: string; oldVal: string; newVal: string }[] = [];
      for (const k of trackableKeys) {
        const col = PLAYER_COLUMNS[k];
        const newVal = JSON_COLUMNS.has(k) ? JSON.stringify(patch[k]) : String(patch[k] ?? '');
        const oldVal = oldRow[col] != null ? String(oldRow[col]) : '';
        if (oldVal !== newVal) {
          inserts.push({ field: k, oldVal, newVal });
        }
      }
      if (inserts.length > 0) {
        const placeholders = inserts.map((_, i) => `($${i * 4 + 1}, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4})`).join(', ');
        const params = inserts.flatMap(ins => [id, ins.field, ins.oldVal, ins.newVal]);
        query(
          `INSERT INTO player_changes (player_id, field, old_value, new_value) VALUES ${placeholders}`,
          params
        ).catch(() => {});
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('PATCH /api/players/[id]', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
