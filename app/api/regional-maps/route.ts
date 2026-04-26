import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';

/**
 * POST /api/regional-maps
 * Create a new map_builds row with map_role='regional'.
 *
 * Body: { name: string, mirror_horizontal?: boolean }
 *
 * The actual image upload still goes through POST /api/map-builder/[id]/image
 * — same plumbing the rest of the builder uses, which writes to Railway's
 * /data volume in production (no split-brain).
 */
export async function POST(req: NextRequest) {
  try {
    await ensureSchema();
    const body = await req.json();
    const name: string = body.name ?? 'Untitled Regional Map';
    const mirrorHorizontal: boolean = body.mirror_horizontal === true;
    if (typeof name !== 'string' || name.length > 200) {
      return NextResponse.json({ error: 'Invalid name' }, { status: 400 });
    }

    const id = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);
    await query(
      `INSERT INTO map_builds (id, name, map_role, mirror_horizontal, created_at, updated_at)
       VALUES ($1, $2, 'regional', $3, $4, $4)`,
      [id, name.trim(), mirrorHorizontal, now],
    );
    return NextResponse.json({ ok: true, id });
  } catch (err) {
    console.error('POST /api/regional-maps', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
