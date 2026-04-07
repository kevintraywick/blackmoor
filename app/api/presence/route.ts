import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import { broadcast } from '@/lib/events';

const STALE_SECONDS = 90;

// GET /api/presence — return list of online player IDs
export async function GET() {
  try {
    await ensureSchema();
    const rows = await query<{ player_id: string }>(
      `SELECT player_id FROM player_presence WHERE last_seen > NOW() - INTERVAL '${STALE_SECONDS} seconds'`
    );
    return NextResponse.json({ online: rows.map(r => r.player_id) });
  } catch (err) {
    console.error('GET /api/presence', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

// POST /api/presence — heartbeat from a player page
export async function POST(req: Request) {
  try {
    await ensureSchema();
    const { playerId } = await req.json();
    if (!playerId) return NextResponse.json({ error: 'playerId required' }, { status: 400 });

    // Check if player was previously offline (for SSE broadcast)
    const prev = await query<{ last_seen: string }>(
      'SELECT last_seen FROM player_presence WHERE player_id = $1',
      [playerId]
    );
    const wasOffline = !prev[0] ||
      (Date.now() - new Date(prev[0].last_seen).getTime()) > STALE_SECONDS * 1000;

    // Upsert presence
    await query(
      `INSERT INTO player_presence (player_id, last_seen) VALUES ($1, NOW())
       ON CONFLICT (player_id) DO UPDATE SET last_seen = NOW()`,
      [playerId]
    );

    // Broadcast presence change so splash page updates in real-time
    if (wasOffline) {
      broadcast('presence', playerId, 'patch');
    }

    // Clean up stale rows older than 1 day
    await query(`DELETE FROM player_presence WHERE last_seen < NOW() - INTERVAL '1 day'`);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('POST /api/presence', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
