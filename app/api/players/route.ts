import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';

export async function POST(req: NextRequest) {
  try {
    await ensureSchema();
    const { id, playerName, character, initial, img } = await req.json();

    if (!id || !playerName || !character || !initial) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const [{ max }] = await query<{ max: number | null }>('SELECT MAX(sort_order) as max FROM players');
    const sortOrder = (max ?? -1) + 1;

    await query(
      `INSERT INTO players (id, player_name, character, initial, img, sort_order) VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, playerName, character, initial, img ?? '', sortOrder]
    );

    // Pre-create the player sheet row so the player exists immediately
    await query(
      `INSERT INTO player_sheets (id) VALUES ($1) ON CONFLICT (id) DO NOTHING`,
      [id]
    );

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    if ((err as { code?: string }).code === '23505') {
      return NextResponse.json({ error: 'Player ID already exists' }, { status: 409 });
    }
    console.error('POST /api/players', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
