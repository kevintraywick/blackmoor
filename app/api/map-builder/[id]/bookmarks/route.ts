import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';

// GET /api/map-builder/[id]/bookmarks
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureSchema();
    const { id } = await params;
    const rows = await query(
      'SELECT * FROM map_build_bookmarks WHERE build_id = $1 ORDER BY created_at DESC',
      [id]
    );
    return NextResponse.json(rows);
  } catch (err) {
    console.error('GET /api/map-builder/[id]/bookmarks', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

// POST /api/map-builder/[id]/bookmarks — create a bookmark (snapshot all levels)
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureSchema();
    const { id } = await params;
    const body = await req.json();
    const { name, snapshot } = body;

    if (typeof name !== 'string' || !name.trim() || name.length > 200) {
      return NextResponse.json({ error: 'Invalid name' }, { status: 400 });
    }

    const bookmarkId = crypto.randomUUID();
    await query(
      `INSERT INTO map_build_bookmarks (id, build_id, name, snapshot)
       VALUES ($1, $2, $3, $4)`,
      [bookmarkId, id, name.trim(), JSON.stringify(snapshot)]
    );

    const [bookmark] = await query('SELECT * FROM map_build_bookmarks WHERE id = $1', [bookmarkId]);
    return NextResponse.json(bookmark);
  } catch (err) {
    console.error('POST /api/map-builder/[id]/bookmarks', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
