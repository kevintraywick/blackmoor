import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';

type Params = { params: Promise<{ id: string; levelId: string }> };

// PATCH /api/map-builder/[id]/levels/[levelId] — update level data
export async function PATCH(req: Request, { params }: Params) {
  try {
    await ensureSchema();
    const { id, levelId } = await params;
    const body = await req.json();

    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;

    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || body.name.length > 200) {
        return NextResponse.json({ error: 'Invalid name' }, { status: 400 });
      }
      sets.push(`name = $${i++}`);
      vals.push(body.name.trim());
    }

    if (body.cols !== undefined) {
      sets.push(`cols = $${i++}`);
      vals.push(body.cols);
    }

    if (body.rows !== undefined) {
      sets.push(`rows = $${i++}`);
      vals.push(body.rows);
    }

    // Tiles: merge incoming sparse object into existing
    if (body.tiles !== undefined) {
      sets.push(`tiles = tiles || $${i++}::jsonb`);
      vals.push(JSON.stringify(body.tiles));
    }

    // Assets and images: replace entirely (client manages the full array)
    if (body.assets !== undefined) {
      sets.push(`assets = $${i++}::jsonb`);
      vals.push(JSON.stringify(body.assets));
    }

    if (body.images !== undefined) {
      sets.push(`images = $${i++}::jsonb`);
      vals.push(JSON.stringify(body.images));
    }

    if (sets.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    vals.push(levelId, id);
    await query(
      `UPDATE map_build_levels SET ${sets.join(', ')} WHERE id = $${i} AND build_id = $${i + 1}`,
      vals
    );

    // Update build timestamp
    await query('UPDATE map_builds SET updated_at = $1 WHERE id = $2', [Math.floor(Date.now() / 1000), id]);

    const [level] = await query('SELECT * FROM map_build_levels WHERE id = $1', [levelId]);
    return NextResponse.json(level);
  } catch (err) {
    console.error('PATCH /api/map-builder/[id]/levels/[levelId]', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

// DELETE /api/map-builder/[id]/levels/[levelId]
export async function DELETE(_req: Request, { params }: Params) {
  try {
    await ensureSchema();
    const { id, levelId } = await params;
    await query('DELETE FROM map_build_levels WHERE id = $1 AND build_id = $2', [levelId, id]);
    await query('UPDATE map_builds SET updated_at = $1 WHERE id = $2', [Math.floor(Date.now() / 1000), id]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/map-builder/[id]/levels/[levelId]', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
