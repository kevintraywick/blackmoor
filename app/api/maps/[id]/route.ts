import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import { unlink } from 'fs/promises';
import { join } from 'path';
import type { MapRow } from '@/lib/types';

const MAPS_DIR = process.env.MAPS_DIR ?? '/data/maps';

type Params = { params: Promise<{ id: string }> };

// GET /api/maps/[id] — DM full view (includes dm_notes)
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    await ensureSchema();
    const { id } = await params;
    const [map] = await query<MapRow>('SELECT * FROM maps WHERE id = $1', [id]);
    if (!map) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(map);
  } catch (err) {
    console.error('GET /api/maps/[id]', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

// PATCH /api/maps/[id] — update metadata / grid settings
const PATCH_FIELDS: Record<string, string> = {
  name: 'name',
  grid_type: 'grid_type',
  cols: 'cols',
  rows: 'rows',
  offset_x: 'offset_x',
  offset_y: 'offset_y',
  tile_px: 'tile_px',
  hex_orientation: 'hex_orientation',
};

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    await ensureSchema();
    const { id } = await params;
    const body = await req.json();
    const keys = Object.keys(body).filter(k => k in PATCH_FIELDS);
    if (keys.length === 0) {
      return NextResponse.json({ error: 'No valid fields' }, { status: 400 });
    }
    const setClauses = keys.map((k, i) => `${PATCH_FIELDS[k]} = $${i + 2}`).join(', ');
    const values = keys.map(k => body[k]);
    await query(`UPDATE maps SET ${setClauses} WHERE id = $1`, [id, ...values]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('PATCH /api/maps/[id]', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

// DELETE /api/maps/[id] — delete row + image file
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    await ensureSchema();
    const { id } = await params;
    const [map] = await query<{ image_path: string }>('DELETE FROM maps WHERE id = $1 RETURNING image_path', [id]);
    if (map?.image_path) {
      try {
        await unlink(join(MAPS_DIR, map.image_path));
      } catch (e) {
        console.error('Failed to delete image file (non-fatal):', e);
      }
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/maps/[id]', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
