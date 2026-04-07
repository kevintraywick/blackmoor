import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import { setHexLocalMap, clearHexLocalMap } from '@/lib/world';

// POST /api/map-builder/[id]/world-location
// Body: { q: number, r: number } — anchor this build to a world hex.
// Body: { clear: true }            — remove the build's world location.
//
// Atomic: writes both map_builds.world_hex_q/r AND the world_hexes row's
// reveal_state='mapped' / local_map_id. Any prior hex claiming this build
// is cleared by setHexLocalMap.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureSchema();
    const { id } = await params;
    const body = await req.json();

    // Verify the build exists and is a local_map
    const [build] = await query<{ id: string; map_role: string | null; world_hex_q: number | null; world_hex_r: number | null }>(
      `SELECT id, map_role, world_hex_q, world_hex_r FROM map_builds WHERE id = $1`,
      [id]
    );
    if (!build) {
      return NextResponse.json({ error: 'Build not found' }, { status: 404 });
    }
    if (build.map_role === 'world_addition') {
      return NextResponse.json(
        { error: 'World additions cannot be anchored to a hex' },
        { status: 400 }
      );
    }

    if (body.clear === true) {
      if (build.world_hex_q != null && build.world_hex_r != null) {
        await clearHexLocalMap(build.world_hex_q, build.world_hex_r);
      }
      await query(
        `UPDATE map_builds
         SET world_hex_q = NULL, world_hex_r = NULL,
             updated_at = EXTRACT(EPOCH FROM now())::bigint
         WHERE id = $1`,
        [id]
      );
      return NextResponse.json({ ok: true, world_hex_q: null, world_hex_r: null });
    }

    const { q, r } = body;
    if (typeof q !== 'number' || typeof r !== 'number') {
      return NextResponse.json({ error: 'q and r must be numbers' }, { status: 400 });
    }

    const hex = await setHexLocalMap(q, r, id);

    await query(
      `UPDATE map_builds
       SET world_hex_q = $1, world_hex_r = $2,
           updated_at = EXTRACT(EPOCH FROM now())::bigint
       WHERE id = $3`,
      [q, r, id]
    );

    return NextResponse.json({ ok: true, hex, world_hex_q: q, world_hex_r: r });
  } catch (err) {
    console.error('POST /api/map-builder/[id]/world-location', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
