import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';

// GET /api/map-builder — list all map builds (joined with sessions for grouping)
export async function GET() {
  try {
    await ensureSchema();
    const rows = await query(
      `SELECT b.*, s.number AS session_number, s.title AS session_title
       FROM map_builds b
       LEFT JOIN sessions s ON s.id = b.session_id
       ORDER BY s.number NULLS FIRST, b.updated_at DESC`
    );
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
    const { name = 'Untitled Map', session_id = null, map_role = 'local_map' } = body;

    if (typeof name !== 'string' || name.length > 200) {
      return NextResponse.json({ error: 'Invalid name' }, { status: 400 });
    }
    if (session_id !== null && typeof session_id !== 'string') {
      return NextResponse.json({ error: 'Invalid session_id' }, { status: 400 });
    }
    if (map_role !== 'local_map' && map_role !== 'world_addition' && map_role !== 'regional') {
      return NextResponse.json({ error: 'Invalid map_role' }, { status: 400 });
    }

    const buildId = crypto.randomUUID();
    const levelId = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);

    await query(
      `INSERT INTO map_builds (id, name, session_id, map_role, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6)`,
      [buildId, name.trim(), session_id, map_role, now, now]
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
