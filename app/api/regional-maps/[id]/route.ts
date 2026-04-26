import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';

/**
 * PATCH /api/regional-maps/[id]
 * Update a regional map's editable fields. Body subset:
 *   { name?, mirror_horizontal? }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await ensureSchema();
    const { id } = await params;
    const body = await req.json();
    const sets: string[] = [];
    const vals: unknown[] = [];
    let i = 1;
    if (typeof body.name === 'string' && body.name.length <= 200) {
      sets.push(`name = $${i++}`);
      vals.push(body.name.trim());
    }
    if (typeof body.mirror_horizontal === 'boolean') {
      sets.push(`mirror_horizontal = $${i++}`);
      vals.push(body.mirror_horizontal);
    }
    if (sets.length === 0) return NextResponse.json({ ok: true });
    sets.push(`updated_at = EXTRACT(EPOCH FROM now())::bigint`);
    vals.push(id);
    await query(
      `UPDATE map_builds SET ${sets.join(', ')} WHERE id = $${i} AND map_role = 'regional'`,
      vals,
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('PATCH /api/regional-maps/[id]', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
