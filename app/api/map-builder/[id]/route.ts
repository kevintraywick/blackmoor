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

// PATCH /api/map-builder/[id] — update build name and/or session_id
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureSchema();
    const { id } = await params;
    const body = await req.json();

    const sets: string[] = [];
    const vals: unknown[] = [];

    if (typeof body.name === 'string') {
      if (body.name.length > 200) return NextResponse.json({ error: 'Invalid name' }, { status: 400 });
      sets.push(`name = $${vals.length + 1}`);
      vals.push(body.name.trim());
    }
    if ('session_id' in body) {
      if (body.session_id !== null && typeof body.session_id !== 'string') {
        return NextResponse.json({ error: 'Invalid session_id' }, { status: 400 });
      }
      sets.push(`session_id = $${vals.length + 1}`);
      vals.push(body.session_id);
    }

    if (sets.length === 0) {
      return NextResponse.json({ error: 'No updatable fields provided' }, { status: 400 });
    }

    sets.push(`updated_at = $${vals.length + 1}`);
    vals.push(Math.floor(Date.now() / 1000));
    vals.push(id);

    await query(`UPDATE map_builds SET ${sets.join(', ')} WHERE id = $${vals.length}`, vals);

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
