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
    const { player_id, poison_type, duration } = await req.json();
    const id = crypto.randomUUID();
    await query(
      `INSERT INTO poison_status (id, player_id, poison_type, duration) VALUES ($1, $2, $3, $4)`,
      [id, player_id, poison_type || 'Poisoned', duration || 'long_rest']
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
    const { id, player_id } = await req.json();
    if (id) {
      await query('UPDATE poison_status SET active = false WHERE id = $1', [id]);
    } else if (player_id) {
      await query('UPDATE poison_status SET active = false WHERE player_id = $1 AND active = true', [player_id]);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
