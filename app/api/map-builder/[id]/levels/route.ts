import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';

// GET /api/map-builder/[id]/levels — list levels for a build
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureSchema();
    const { id } = await params;
    const rows = await query(
      'SELECT * FROM map_build_levels WHERE build_id = $1 ORDER BY sort_order',
      [id]
    );
    return NextResponse.json(rows);
  } catch (err) {
    console.error('GET /api/map-builder/[id]/levels', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

// POST /api/map-builder/[id]/levels — add a new level
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureSchema();
    const { id } = await params;
    const body = await req.json();
    const { name = 'New Level' } = body;

    if (typeof name !== 'string' || name.length > 200) {
      return NextResponse.json({ error: 'Invalid name' }, { status: 400 });
    }

    // Get next sort_order
    const countRows = await query<{ max_order: number }>(
      'SELECT COALESCE(MAX(sort_order), -1)::int as max_order FROM map_build_levels WHERE build_id = $1',
      [id]
    );
    const nextOrder = (countRows[0]?.max_order ?? -1) + 1;

    const levelId = crypto.randomUUID();
    await query(
      `INSERT INTO map_build_levels (id, build_id, name, sort_order, cols, rows)
       VALUES ($1, $2, $3, $4, 100, 100)`,
      [levelId, id, name.trim(), nextOrder]
    );

    // Update build timestamp
    await query('UPDATE map_builds SET updated_at = $1 WHERE id = $2', [Math.floor(Date.now() / 1000), id]);

    const [level] = await query('SELECT * FROM map_build_levels WHERE id = $1', [levelId]);
    return NextResponse.json(level);
  } catch (err) {
    console.error('POST /api/map-builder/[id]/levels', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
