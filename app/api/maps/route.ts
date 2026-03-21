import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import type { MapRow } from '@/lib/types';

// GET /api/maps?session_id=X
export async function GET(req: NextRequest) {
  try {
    await ensureSchema();
    const session_id = req.nextUrl.searchParams.get('session_id');
    if (!session_id) {
      return NextResponse.json({ error: 'session_id required' }, { status: 400 });
    }
    const rows = await query<MapRow>(
      'SELECT * FROM maps WHERE session_id = $1 ORDER BY sort_order ASC, created_at ASC',
      [session_id]
    );
    return NextResponse.json(rows);
  } catch (err) {
    console.error('GET /api/maps', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

// POST /api/maps — create map metadata
export async function POST(req: NextRequest) {
  try {
    await ensureSchema();
    const { session_id, name, grid_type = 'square' } = await req.json();
    if (!session_id || !name) {
      return NextResponse.json({ error: 'session_id and name required' }, { status: 400 });
    }
    const VALID_GRID_TYPES = new Set(['square', 'hex']);
    if (!VALID_GRID_TYPES.has(grid_type)) {
      return NextResponse.json({ error: 'Invalid grid_type' }, { status: 400 });
    }

    const id = crypto.randomUUID();
    const now = Date.now();

    await query(
      `INSERT INTO maps (id, session_id, name, grid_type, sort_order, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, session_id, name, grid_type, now, now]
    );

    const [map] = await query<MapRow>('SELECT * FROM maps WHERE id = $1', [id]);
    return NextResponse.json(map);
  } catch (err) {
    console.error('POST /api/maps', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
