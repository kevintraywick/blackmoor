import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';

type Params = { params: Promise<{ id: string; bookmarkId: string }> };

// DELETE /api/map-builder/[id]/bookmarks/[bookmarkId]
export async function DELETE(_req: Request, { params }: Params) {
  try {
    await ensureSchema();
    const { id, bookmarkId } = await params;
    await query(
      'DELETE FROM map_build_bookmarks WHERE id = $1 AND build_id = $2',
      [bookmarkId, id]
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/map-builder/[id]/bookmarks/[bookmarkId]', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
