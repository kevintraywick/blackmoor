import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import { writeFile, mkdir } from 'fs/promises';
import { join, extname } from 'path';
import { randomUUID } from 'crypto';

const UPLOAD_DIR = `${process.env.DATA_DIR ?? '/data'}/uploads/npcs`;
const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const ALLOWED_FIELDS = new Set(['name', 'species', 'cr', 'hp', 'ac', 'speed', 'attacks', 'traits', 'actions', 'notes', 'image_path']);

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureSchema();
    const { id } = await params;
    const contentType = request.headers.get('content-type') ?? '';

    // Image upload via multipart
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const image = formData.get('image') as File | null;

      if (!image || image.size === 0) {
        return NextResponse.json({ error: 'No image provided' }, { status: 400 });
      }
      if (!ALLOWED_MIME_TYPES.includes(image.type)) {
        return NextResponse.json({ error: 'image must be png, jpeg, webp, or gif' }, { status: 400 });
      }
      if (image.size > MAX_IMAGE_BYTES) {
        return NextResponse.json({ error: 'Image must be 4 MB or smaller' }, { status: 400 });
      }

      await mkdir(UPLOAD_DIR, { recursive: true });
      const ext = extname(image.name) || '.png';
      const filename = `${randomUUID()}${ext}`;
      const buffer = Buffer.from(await image.arrayBuffer());
      await writeFile(join(UPLOAD_DIR, filename), buffer);
      const imagePath = `uploads/npcs/${filename}`;

      const rows = await query(
        'UPDATE npcs SET image_path = $1 WHERE id = $2 RETURNING *',
        [imagePath, id]
      );
      if (rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json(rows[0]);
    }

    // Field update via JSON
    const body = await request.json();
    const updates = Object.entries(body).filter(([k]) => ALLOWED_FIELDS.has(k));
    if (updates.length === 0) {
      return NextResponse.json({ error: 'No valid fields' }, { status: 400 });
    }

    const setClauses = updates.map(([k], i) => `${k} = $${i + 2}`).join(', ');
    const values = [id, ...updates.map(([, v]) => v)];

    const rows = await query(
      `UPDATE npcs SET ${setClauses} WHERE id = $1 RETURNING *`,
      values
    );
    if (rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(rows[0]);
  } catch (err) {
    console.error('PATCH /api/npcs/[id]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureSchema();
    const { id } = await params;
    await query('DELETE FROM npcs WHERE id = $1', [id]);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error('DELETE /api/npcs/[id]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
