import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';

// GET /api/availability — return all availability rows
export async function GET() {
  try {
    await ensureSchema();
    const rows = await query('SELECT player_id, saturday, status FROM availability ORDER BY saturday ASC');
    return NextResponse.json(rows);
  } catch (err) {
    console.error('GET /api/availability', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

// PUT /api/availability — upsert a single availability record
export async function PUT(req: Request) {
  try {
    await ensureSchema();
    const { player_id, saturday, status } = await req.json();

    if (!player_id || !saturday || !['in', 'out'].includes(status)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    await query(
      `INSERT INTO availability (player_id, saturday, status)
       VALUES ($1, $2, $3)
       ON CONFLICT (player_id, saturday)
       DO UPDATE SET status = EXCLUDED.status`,
      [player_id, saturday, status]
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('PUT /api/availability', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
