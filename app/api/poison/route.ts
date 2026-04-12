import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import type { PoisonStatus } from '@/lib/types';

// GET — all active poisons (optionally filter by player_id)
export async function GET(req: Request) {
  await ensureSchema();
  const { searchParams } = new URL(req.url);
  const playerId = searchParams.get('player_id');

  try {
    const rows = playerId
      ? await query<PoisonStatus>('SELECT * FROM poison_status WHERE active = true AND player_id = $1 ORDER BY started_at DESC', [playerId])
      : await query<PoisonStatus>('SELECT * FROM poison_status WHERE active = true ORDER BY started_at DESC');
    return NextResponse.json(rows);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// POST — poison a player
export async function POST(req: Request) {
  await ensureSchema();
  try {
    const { player_id, poison_type, poison_name, effect, duration, session_id = null } = await req.json();
    const id = crypto.randomUUID();
    await query(
      `INSERT INTO poison_status (id, player_id, poison_type, poison_name, effect, duration, session_id) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, player_id, poison_type || 'Poisoned', poison_name || '', effect || '', duration || 'long_rest', session_id]
    );
    const rows = await query<PoisonStatus>('SELECT * FROM poison_status WHERE id = $1', [id]);
    return NextResponse.json(rows[0]);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// PATCH — clear a poison (or clear all for a player)
export async function PATCH(req: Request) {
  await ensureSchema();
  try {
    const { id, player_id, action, poison_name, effect, duration } = await req.json();
    if (action === 'update' && id) {
      const sets: string[] = [];
      const vals: unknown[] = [];
      if (typeof poison_name === 'string') { sets.push(`poison_name = $${vals.length + 1}`); vals.push(poison_name); }
      if (typeof effect === 'string') { sets.push(`effect = $${vals.length + 1}`); vals.push(effect); }
      if (typeof duration === 'string') { sets.push(`duration = $${vals.length + 1}`); vals.push(duration); }
      if (sets.length > 0) {
        vals.push(id);
        await query(`UPDATE poison_status SET ${sets.join(', ')} WHERE id = $${vals.length}`, vals);
      }
    } else if (id) {
      await query('UPDATE poison_status SET active = false WHERE id = $1', [id]);
    } else if (player_id) {
      await query('UPDATE poison_status SET active = false WHERE player_id = $1 AND active = true', [player_id]);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
