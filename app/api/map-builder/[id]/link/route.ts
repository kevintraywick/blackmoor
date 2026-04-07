import { NextResponse } from 'next/server';
import { pool, query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import type { MapBuild, MapBuildLevel } from '@/lib/types';

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

    // Fetch the builder level + parent build (need build for grid + scale metadata)
    const [build] = await query<MapBuild>('SELECT * FROM map_builds WHERE id = $1', [id]);
    if (!build) return NextResponse.json({ error: 'Build not found' }, { status: 404 });

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

    // Read grid + scale metadata from the parent build, with sensible fallbacks for
    // builds that pre-date the grid-detection feature.
    const gridType = build.grid_type === 'square' || build.grid_type === 'hex' ? build.grid_type : 'hex';
    const hexOrientation = build.hex_orientation === 'pointy' ? 'pointy' : 'flat';
    const cellSizePx = build.cell_size_px ?? null;
    const scaleValueFt = build.scale_value_ft ?? null;
    const imageWidthPx = build.image_width_px ?? null;
    const imageHeightPx = build.image_height_px ?? null;
    const imagePath = build.image_path ?? '';

    // Two-step transaction: insert frozen copy into maps, then mark the build's session_id.
    // Order matters — the frozen copy is the high-value side effect; do it first.
    const mapId = crypto.randomUUID();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO maps
           (id, session_id, name, image_path, grid_type, cols, rows, tile_px, hex_orientation,
            revealed_tiles, created_at, cell_size_px, scale_value_ft, image_width_px, image_height_px)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        [
          mapId, session_id, level.name, imagePath, gridType, level.cols, level.rows, 24, hexOrientation,
          JSON.stringify(activeTiles), Date.now(), cellSizePx, scaleValueFt, imageWidthPx, imageHeightPx,
        ]
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
