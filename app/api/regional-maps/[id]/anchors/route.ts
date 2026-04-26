import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';

/**
 * POST /api/regional-maps/[id]/anchors
 * Upsert an anchor by feature_name. Body:
 *   {
 *     feature_name: string,
 *     image_px_x?: number | null,
 *     image_px_y?: number | null,
 *     real_lat?: number,
 *     real_lng?: number,
 *     sort_order?: number,
 *   }
 *
 * If a row with the same (build_id, feature_name) exists, updates its fields.
 * Otherwise inserts a new row. Image px may be null until the DM clicks to set.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await ensureSchema();
    const { id: buildId } = await params;
    const body = await req.json();
    const featureName: string = body.feature_name;
    if (typeof featureName !== 'string' || !featureName.trim()) {
      return NextResponse.json({ error: 'feature_name required' }, { status: 400 });
    }

    // Validate optional numerics.
    const px = body.image_px_x;
    const py = body.image_px_y;
    if (px != null && (typeof px !== 'number' || !isFinite(px))) {
      return NextResponse.json({ error: 'image_px_x must be a number' }, { status: 400 });
    }
    if (py != null && (typeof py !== 'number' || !isFinite(py))) {
      return NextResponse.json({ error: 'image_px_y must be a number' }, { status: 400 });
    }

    const existing = await query<{ id: string }>(
      `SELECT id FROM regional_map_anchors WHERE build_id = $1 AND feature_name = $2`,
      [buildId, featureName.trim()],
    );

    if (existing.length > 0) {
      const sets: string[] = [];
      const vals: unknown[] = [];
      let i = 1;
      if (px !== undefined) { sets.push(`image_px_x = $${i++}`); vals.push(px === null ? null : Math.round(px)); }
      if (py !== undefined) { sets.push(`image_px_y = $${i++}`); vals.push(py === null ? null : Math.round(py)); }
      if (typeof body.real_lat === 'number') { sets.push(`real_lat = $${i++}`); vals.push(body.real_lat); }
      if (typeof body.real_lng === 'number') { sets.push(`real_lng = $${i++}`); vals.push(body.real_lng); }
      if (typeof body.sort_order === 'number') { sets.push(`sort_order = $${i++}`); vals.push(body.sort_order); }
      if (sets.length > 0) {
        vals.push(existing[0].id);
        await query(
          `UPDATE regional_map_anchors SET ${sets.join(', ')} WHERE id = $${i}`,
          vals,
        );
      }
      return NextResponse.json({ ok: true, id: existing[0].id });
    }

    if (typeof body.real_lat !== 'number' || typeof body.real_lng !== 'number') {
      return NextResponse.json(
        { error: 'real_lat + real_lng required to create a new anchor' },
        { status: 400 },
      );
    }
    const id = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);
    await query(
      `INSERT INTO regional_map_anchors
         (id, build_id, feature_name, image_px_x, image_px_y, real_lat, real_lng, sort_order, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        id,
        buildId,
        featureName.trim(),
        px == null ? null : Math.round(px),
        py == null ? null : Math.round(py),
        body.real_lat,
        body.real_lng,
        typeof body.sort_order === 'number' ? body.sort_order : 0,
        now,
      ],
    );
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    console.error('POST /api/regional-maps/[id]/anchors', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
