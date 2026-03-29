import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';

// GET /api/map-builder — list all map builds
export async function GET() {
  try {
    await ensureSchema();
    const rows = await query('SELECT * FROM map_builds ORDER BY updated_at DESC');
    return NextResponse.json(rows);
  } catch (err) {
    console.error('GET /api/map-builder', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

// POST /api/map-builder — create a new map build with a default level
export async function POST(req: Request) {
  try {
    await ensureSchema();
    const body = await req.json();
    const { name = 'Untitled Map' } = body;

    if (typeof name !== 'string' || name.length > 200) {
      return NextResponse.json({ error: 'Invalid name' }, { status: 400 });
    }

    const buildId = crypto.randomUUID();
    const levelId = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);

    await query(
      `INSERT INTO map_builds (id, name, created_at, updated_at) VALUES ($1, $2, $3, $4)`,
      [buildId, name.trim(), now, now]
    );

    // Create default first level
    await query(
      `INSERT INTO map_build_levels (id, build_id, name, sort_order, cols, rows)
       VALUES ($1, $2, 'Level 1', 0, 100, 100)`,
      [levelId, buildId]
    );

    const [build] = await query('SELECT * FROM map_builds WHERE id = $1', [buildId]);
    const levels = await query('SELECT * FROM map_build_levels WHERE build_id = $1 ORDER BY sort_order', [buildId]);

    return NextResponse.json({ ...build, levels });
  } catch (err) {
    console.error('POST /api/map-builder', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
