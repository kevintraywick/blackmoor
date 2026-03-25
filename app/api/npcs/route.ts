import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import { writeFile, mkdir } from 'fs/promises';
import { join, extname } from 'path';
import { randomUUID } from 'crypto';

const UPLOAD_DIR = `${process.env.DATA_DIR ?? '/data'}/uploads/npcs`;
const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

export async function GET() {
  try {
    await ensureSchema();
    const rows = await query('SELECT * FROM npcs ORDER BY created_at ASC');
    return NextResponse.json(rows);
  } catch (err) {
    console.error('GET /api/npcs', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureSchema();

    let id: string;
    let imagePath: string | null = null;

    const contentType = request.headers.get('content-type') ?? '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      id = formData.get('id') as string;
      const image = formData.get('image') as File | null;

      if (image && image.size > 0) {
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
        imagePath = `uploads/npcs/${filename}`;
      }
    } else {
      const body = await request.json();
      id = body.id;
    }

    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const rows = await query(
      `INSERT INTO npcs (id, image_path) VALUES ($1, $2) RETURNING *`,
      [id, imagePath]
    );
    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) {
    console.error('POST /api/npcs', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
