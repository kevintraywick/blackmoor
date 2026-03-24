import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import { writeFile, mkdir } from 'fs/promises';
import { join, extname } from 'path';
import { randomUUID } from 'crypto';

const UPLOAD_DIR = '/data/uploads/items';

const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const ALLOWED_STAT_TYPES = ['heal', 'magic', 'attack'];
const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // 4 MB

export async function GET() {
  try {
    await ensureSchema();
    const rows = await query('SELECT * FROM items ORDER BY created_at DESC');
    return NextResponse.json(rows);
  } catch (err) {
    console.error('GET /api/items', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureSchema();
    const formData = await request.formData();

    const image = formData.get('image') as File | null;
    const title = formData.get('title') as string;
    const price = parseInt(formData.get('price') as string, 10);
    const description = (formData.get('description') as string) || null;
    const statType = (formData.get('stat_type') as string) || null;
    const statValue = formData.get('stat_value')
      ? parseInt(formData.get('stat_value') as string, 10)
      : null;

    if (!title || isNaN(price)) {
      return NextResponse.json({ error: 'title and price are required' }, { status: 400 });
    }

    if (statType !== null && !ALLOWED_STAT_TYPES.includes(statType)) {
      return NextResponse.json(
        { error: 'stat_type must be one of: heal, magic, attack' },
        { status: 400 }
      );
    }

    let imagePath: string | null = null;

    if (image && image.size > 0) {
      if (!ALLOWED_MIME_TYPES.includes(image.type)) {
        return NextResponse.json(
          { error: 'image must be png, jpeg, webp, or gif' },
          { status: 400 }
        );
      }

      if (image.size > MAX_IMAGE_BYTES) {
        return NextResponse.json(
          { error: 'Image must be 4 MB or smaller' },
          { status: 400 }
        );
      }

      await mkdir(UPLOAD_DIR, { recursive: true });
      const ext = extname(image.name) || '.png';
      const filename = `${randomUUID()}${ext}`;
      const buffer = Buffer.from(await image.arrayBuffer());
      await writeFile(join(UPLOAD_DIR, filename), buffer);
      imagePath = `uploads/items/${filename}`;
    }

    const rows = await query(
      `INSERT INTO items (title, price, description, stat_type, stat_value, image_path)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [title, price, description, statType || null, statValue, imagePath]
    );

    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) {
    console.error('POST /api/items', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
