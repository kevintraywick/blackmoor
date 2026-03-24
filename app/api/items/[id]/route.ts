import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import { unlink } from 'fs/promises';
import { join } from 'path';

const UPLOAD_DIR = `${process.env.DATA_DIR ?? '/data'}/uploads/items`;

interface Props {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, { params }: Props) {
  try {
    await ensureSchema();
    const { id } = await params;
    const itemId = parseInt(id, 10);
    if (isNaN(itemId)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    const body = await request.json();
    const { in_marketplace } = body;

    if (typeof in_marketplace !== 'boolean') {
      return NextResponse.json({ error: 'in_marketplace must be a boolean' }, { status: 400 });
    }

    const rows = await query(
      'UPDATE items SET in_marketplace = $1 WHERE id = $2 RETURNING *',
      [in_marketplace, itemId]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    return NextResponse.json(rows[0]);
  } catch (err) {
    console.error('PATCH /api/items/[id]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: Props) {
  try {
    await ensureSchema();
    const { id } = await params;
    const itemId = parseInt(id, 10);
    if (isNaN(itemId)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
    }

    const rows = await query('DELETE FROM items WHERE id = $1 RETURNING *', [itemId]);

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    // Clean up uploaded image if present
    const imagePath = (rows[0] as { image_path: string | null }).image_path;
    if (imagePath) {
      const filename = imagePath.split('/').pop()!;
      await unlink(join(UPLOAD_DIR, filename)).catch(() => {});
    }

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error('DELETE /api/items/[id]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
