import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';

// GET /api/dm-messages?player_id=xxx — return messages for a player
export async function GET(req: Request) {
  try {
    await ensureSchema();
    const url = new URL(req.url);
    const playerId = url.searchParams.get('player_id');
    if (!playerId) return NextResponse.json({ error: 'player_id required' }, { status: 400 });

    const rows = await query(
      'SELECT * FROM dm_messages WHERE player_id = $1 ORDER BY created_at DESC',
      [playerId]
    );
    return NextResponse.json(rows);
  } catch (err) {
    console.error('GET /api/dm-messages', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

// POST /api/dm-messages — send a message to a player
export async function POST(req: Request) {
  try {
    await ensureSchema();
    const { player_id, message } = await req.json();

    if (!player_id || !message?.trim()) {
      return NextResponse.json({ error: 'player_id and message required' }, { status: 400 });
    }

    const id = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    await query(
      `INSERT INTO dm_messages (id, player_id, message) VALUES ($1, $2, $3)`,
      [id, player_id, message.trim()]
    );

    const [row] = await query('SELECT * FROM dm_messages WHERE id = $1', [id]);
    return NextResponse.json(row);
  } catch (err) {
    console.error('POST /api/dm-messages', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
