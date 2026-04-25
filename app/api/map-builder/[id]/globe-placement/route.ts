import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import { isValidCell, getResolution } from 'h3-js';

/**
 * POST /api/map-builder/[id]/globe-placement
 *
 * Anchors a map build to an H3 cell on the globe (typically res-4 — the
 * Globe3D's "campaign hex" tier) and records the snap-grid offset within
 * that hex.
 *
 * Body: { cell: string, offset_col?: number, offset_row?: number, clear?: boolean }
 *
 * Distinct from /world-location which writes the legacy axial q/r system at
 * res-6 for the old /dm/world page.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await ensureSchema();
    const { id } = await params;
    const body = await req.json();

    const [build] = await query<{ id: string; map_role: string | null }>(
      `SELECT id, map_role FROM map_builds WHERE id = $1`,
      [id],
    );
    if (!build) return NextResponse.json({ error: 'Build not found' }, { status: 404 });
    if (build.map_role === 'world_addition') {
      return NextResponse.json(
        { error: 'World additions cannot be placed on the globe' },
        { status: 400 },
      );
    }

    if (body.clear === true) {
      await query(
        `UPDATE map_builds
         SET h3_cell = NULL, h3_res = NULL,
             placement_offset_col = 0, placement_offset_row = 0,
             placement_offset_km_x = 0, placement_offset_km_y = 0, placement_scale = 1,
             updated_at = EXTRACT(EPOCH FROM now())::bigint
         WHERE id = $1`,
        [id],
      );
      return NextResponse.json({ ok: true });
    }

    const {
      cell,
      offset_col = 0,
      offset_row = 0,
      offset_km_x = 0,
      offset_km_y = 0,
      scale = 1,
    } = body;
    if (typeof cell !== 'string' || !isValidCell(cell)) {
      return NextResponse.json({ error: 'cell must be a valid H3 cell' }, { status: 400 });
    }
    if (typeof offset_col !== 'number' || typeof offset_row !== 'number') {
      return NextResponse.json({ error: 'offsets must be numbers' }, { status: 400 });
    }
    if (
      typeof offset_km_x !== 'number' ||
      typeof offset_km_y !== 'number' ||
      typeof scale !== 'number'
    ) {
      return NextResponse.json({ error: 'km offsets and scale must be numbers' }, { status: 400 });
    }
    if (!isFinite(offset_km_x) || !isFinite(offset_km_y) || !isFinite(scale) || scale <= 0) {
      return NextResponse.json({ error: 'km offsets and scale must be finite; scale > 0' }, { status: 400 });
    }
    const res = getResolution(cell);

    // h3_cell is BIGINT in Postgres; h3-js gives a 15-char hex string. Convert.
    const cellBig = BigInt('0x' + cell).toString();

    await query(
      `UPDATE map_builds
       SET h3_cell = $1, h3_res = $2,
           placement_offset_col = $3, placement_offset_row = $4,
           placement_offset_km_x = $5, placement_offset_km_y = $6, placement_scale = $7,
           updated_at = EXTRACT(EPOCH FROM now())::bigint
       WHERE id = $8`,
      [cellBig, res, Math.round(offset_col), Math.round(offset_row), offset_km_x, offset_km_y, scale, id],
    );

    return NextResponse.json({
      ok: true,
      cell,
      h3_res: res,
      offset_col: Math.round(offset_col),
      offset_row: Math.round(offset_row),
      offset_km_x,
      offset_km_y,
      scale,
    });
  } catch (err) {
    console.error('POST /api/map-builder/[id]/globe-placement', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
