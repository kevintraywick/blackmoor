import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import type { PlayerMapRow } from '@/lib/types';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureSchema();
    const { id } = await params;
    const rows = await query<PlayerMapRow>(
      `SELECT id, session_id, name, image_path, grid_type, cols, rows,
              offset_x, offset_y, tile_px, hex_orientation, revealed_tiles,
              sort_order, created_at
       FROM maps WHERE id = $1`,
      [id]
    );
    if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(rows[0]);
  } catch (err) {
    console.error('GET /api/maps/[id]/player', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
