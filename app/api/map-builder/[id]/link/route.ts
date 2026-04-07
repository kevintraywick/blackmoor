import { NextResponse } from 'next/server';
import { pool, query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import type { MapBuildLevel } from '@/lib/types';

// POST /api/map-builder/[id]/link — link a builder level to a session as a frozen map copy
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureSchema();
    const { id } = await params;
    const body = await req.json();
    const { level_id, session_id } = body;

    if (!level_id || !session_id) {
      return NextResponse.json({ error: 'level_id and session_id required' }, { status: 400 });
    }

    // Fetch the builder level
    const [level] = await query<MapBuildLevel>(
      'SELECT * FROM map_build_levels WHERE id = $1 AND build_id = $2',
      [level_id, id]
    );
    if (!level) return NextResponse.json({ error: 'Level not found' }, { status: 404 });

    // Convert active tiles to revealed_tiles format for the session map
    const activeTiles: [number, number][] = [];
    if (level.tiles && typeof level.tiles === 'object') {
      for (const [key, val] of Object.entries(level.tiles)) {
        if ((val as { visible?: boolean }).visible) {
          const [c, r] = key.split(',').map(Number);
          activeTiles.push([c, r]);
        }
      }
    }

    // Two-step transaction: insert frozen copy into maps, then mark the build's session_id.
    // Order matters — the frozen copy is the high-value side effect; do it first.
    const mapId = crypto.randomUUID();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO maps (id, session_id, name, grid_type, cols, rows, tile_px, hex_orientation, revealed_tiles, created_at)
         VALUES ($1, $2, $3, 'hex', $4, $5, 24, 'flat', $6, $7)`,
        [mapId, session_id, level.name, level.cols, level.rows, JSON.stringify(activeTiles), Date.now()]
      );
      await client.query(
        `UPDATE map_builds SET session_id = $1, updated_at = $2 WHERE id = $3`,
        [session_id, Math.floor(Date.now() / 1000), id]
      );
      await client.query('COMMIT');
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }

    return NextResponse.json({ ok: true, map_id: mapId });
  } catch (err) {
    console.error('POST /api/map-builder/[id]/link', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
