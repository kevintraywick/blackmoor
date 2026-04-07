import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';

// GET /api/player-changes — return unread changes (or just count with ?count=true)
export async function GET(req: Request) {
  try {
    await ensureSchema();
    const url = new URL(req.url);
    const countOnly = url.searchParams.get('count') === 'true';

    if (countOnly) {
      const rows = await query<{ count: string }>(
        'SELECT COUNT(*) as count FROM player_changes WHERE read = false'
      );
      return NextResponse.json({ count: Number(rows[0]?.count ?? 0) });
    }

    const rows = await query(
      'SELECT * FROM player_changes WHERE read = false ORDER BY created_at DESC'
    );
    return NextResponse.json(rows);
  } catch (err) {
    console.error('GET /api/player-changes', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
