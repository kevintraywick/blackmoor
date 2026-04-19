import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';

// POST /api/map-builder/[id]/link — link a builder to a session.
//
// Body: { session_id: string, level_id?: string }
//   level_id is accepted but ignored — kept for call-site compatibility with
//   the legacy frozen-copy flow (removed 2026-04-19 when the `maps` subsystem
//   was retired). Linkage is now a single field update on map_builds.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureSchema();
    const { id } = await params;
    const body = await req.json();
    const { session_id } = body;

    if (!session_id) {
      return NextResponse.json({ error: 'session_id required' }, { status: 400 });
    }

    const [build] = await query<{ id: string }>('SELECT id FROM map_builds WHERE id = $1', [id]);
    if (!build) return NextResponse.json({ error: 'Build not found' }, { status: 404 });

    await query(
      `UPDATE map_builds SET session_id = $1, updated_at = $2 WHERE id = $3`,
      [session_id, Math.floor(Date.now() / 1000), id],
    );

    return NextResponse.json({ ok: true, build_id: id, session_id });
  } catch (err) {
    console.error('POST /api/map-builder/[id]/link', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
