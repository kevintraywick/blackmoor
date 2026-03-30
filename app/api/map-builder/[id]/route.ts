import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';

// GET /api/map-builder/[id] — get a build with all its levels
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureSchema();
    const { id } = await params;
    const [build] = await query('SELECT * FROM map_builds WHERE id = $1', [id]);
    if (!build) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const levels = await query(
      'SELECT * FROM map_build_levels WHERE build_id = $1 ORDER BY sort_order',
      [id]
    );

    return NextResponse.json({ ...build, levels });
  } catch (err) {
    console.error('GET /api/map-builder/[id]', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

// PATCH /api/map-builder/[id] — update build name
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureSchema();
    const { id } = await params;
    const body = await req.json();
    const { name } = body;

    if (typeof name !== 'string' || name.length > 200) {
      return NextResponse.json({ error: 'Invalid name' }, { status: 400 });
    }

    const now = Math.floor(Date.now() / 1000);
    await query(
      'UPDATE map_builds SET name = $1, updated_at = $2 WHERE id = $3',
      [name.trim(), now, id]
    );

    const [build] = await query('SELECT * FROM map_builds WHERE id = $1', [id]);
    return NextResponse.json(build);
  } catch (err) {
    console.error('PATCH /api/map-builder/[id]', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

// DELETE /api/map-builder/[id] — delete build and all levels/bookmarks (cascade)
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureSchema();
    const { id } = await params;
    await query('DELETE FROM map_builds WHERE id = $1', [id]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/map-builder/[id]', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
