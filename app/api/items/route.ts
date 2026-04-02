import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import { writeFile, mkdir } from 'fs/promises';
import { join, extname } from 'path';
import { randomUUID } from 'crypto';

const UPLOAD_DIR = `${process.env.DATA_DIR ?? '/data'}/uploads/items`;

const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const ALLOWED_ITEM_TYPES = ['magic_item', 'scroll', 'spell'];
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
    const existingImagePath = (formData.get('existing_image_path') as string) || null;
    const title = formData.get('title') as string;
    const price = parseInt(formData.get('price') as string, 10) || 0;
    const description = (formData.get('description') as string) || null;
    const itemType = (formData.get('item_type') as string) || null;

    if (!title) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 });
    }

    if (itemType && !ALLOWED_ITEM_TYPES.includes(itemType)) {
      return NextResponse.json({ error: 'item_type must be magic_item, scroll, or spell' }, { status: 400 });
    }

    // Type-specific fields
    const attack = parseInt(formData.get('attack') as string, 10) || 0;
    const damage = parseInt(formData.get('damage') as string, 10) || 0;
    const heal = parseInt(formData.get('heal') as string, 10) || 0;
    const rarity = (formData.get('rarity') as string) || null;
    const attunement = formData.get('attunement') === 'true';
    const level = formData.get('level') ? parseInt(formData.get('level') as string, 10) : null;
    const school = (formData.get('school') as string) || null;
    const castingTime = (formData.get('casting_time') as string) || null;
    const range = (formData.get('range') as string) || null;
    const components = (formData.get('components') as string) || null;
    const duration = (formData.get('duration') as string) || null;

    let imagePath: string | null = existingImagePath;

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
      imagePath = `uploads/items/${filename}`;
    }

    const rows = await query(
      `INSERT INTO items (title, price, description, image_path, item_type,
        attack, damage, heal, rarity, attunement,
        level, school, casting_time, range, components, duration)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       RETURNING *`,
      [title, price, description, imagePath, itemType,
       attack, damage, heal, rarity, attunement,
       level, school, castingTime, range, components, duration]
    );

    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) {
    console.error('POST /api/items', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
