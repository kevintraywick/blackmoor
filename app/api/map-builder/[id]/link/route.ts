import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
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

    // Create a frozen copy in the maps table
    const mapId = crypto.randomUUID();
    await query(
      `INSERT INTO maps (id, session_id, name, grid_type, cols, rows, tile_px, hex_orientation, revealed_tiles, created_at)
       VALUES ($1, $2, $3, 'hex', $4, $5, 24, 'flat', $6, $7)`,
      [mapId, session_id, level.name, level.cols, level.rows, JSON.stringify(activeTiles), Date.now()]
    );

    return NextResponse.json({ ok: true, map_id: mapId });
  } catch (err) {
    console.error('POST /api/map-builder/[id]/link', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
