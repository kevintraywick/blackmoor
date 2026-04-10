import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';

// GET /api/raven-post/sendings?playerId=X — returns sendings for a player
export async function GET(req: Request) {
  try {
    await ensureSchema();
    const { searchParams } = new URL(req.url);
    const playerId = searchParams.get('playerId');
    if (!playerId) {
      return NextResponse.json({ error: 'playerId required' }, { status: 400 });
    }
    const rows = await query<{ id: string; body: string; published_at: string }>(
      `SELECT id, body, published_at FROM raven_items
       WHERE medium = 'sending' AND target_player = $1
       ORDER BY published_at DESC
       LIMIT 50`,
      [playerId],
    );
    return NextResponse.json(rows);
  } catch (err) {
    console.error('GET /api/raven-post/sendings', err);
    return NextResponse.json({ error: 'fetch failed' }, { status: 500 });
  }
}
