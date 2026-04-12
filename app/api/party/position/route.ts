import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';

interface PartyRow {
  party_q: number | null;
  party_r: number | null;
  party_prev_q: number | null;
  party_prev_r: number | null;
  party_moved_at: number | null;
}

export async function GET() {
  try {
    await ensureSchema();
    const rows = await query<PartyRow>(
      `SELECT party_q, party_r, party_prev_q, party_prev_r, party_moved_at FROM world_map WHERE id = 'default'`,
    );
    if (rows.length === 0) {
      return NextResponse.json({ party_q: null, party_r: null, party_prev_q: null, party_prev_r: null, party_moved_at: null });
    }
    return NextResponse.json(rows[0]);
  } catch (err) {
    console.error('GET /api/party/position', err);
    return NextResponse.json({ error: 'query failed' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await ensureSchema();
    const { q, r } = await req.json();
    if (typeof q !== 'number' || typeof r !== 'number') {
      return NextResponse.json({ error: 'q and r must be numbers' }, { status: 400 });
    }
    const now = Date.now();
    await query(
      `UPDATE world_map
       SET party_prev_q = COALESCE(party_q, $1),
           party_prev_r = COALESCE(party_r, $2),
           party_q = $1,
           party_r = $2,
           party_moved_at = $3
       WHERE id = 'default'`,
      [q, r, now],
    );
    return NextResponse.json({ party_q: q, party_r: r });
  } catch (err) {
    console.error('POST /api/party/position', err);
    return NextResponse.json({ error: 'update failed' }, { status: 500 });
  }
}
