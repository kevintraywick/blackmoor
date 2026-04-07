import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join, extname } from 'path';
import { randomUUID } from 'crypto';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';

const UPLOAD_DIR = `${process.env.DATA_DIR ?? '/data'}/uploads/players`;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

export async function POST(request: Request) {
  try {
    await ensureSchema();

    const formData = await request.formData();
    const playerId = formData.get('player_id') as string;
    const image = formData.get('image') as File | null;

    if (!playerId) return NextResponse.json({ error: 'player_id required' }, { status: 400 });
    if (!image || image.size === 0) return NextResponse.json({ error: 'image required' }, { status: 400 });
    if (!ALLOWED_MIME.includes(image.type)) return NextResponse.json({ error: 'Image must be png, jpeg, webp, or gif' }, { status: 400 });
    if (image.size > MAX_IMAGE_BYTES) return NextResponse.json({ error: 'Image must be 4 MB or smaller' }, { status: 400 });

    await mkdir(UPLOAD_DIR, { recursive: true });
    const ext = extname(image.name) || '.png';
    const filename = `${randomUUID()}${ext}`;
    const buffer = Buffer.from(await image.arrayBuffer());
    await writeFile(join(UPLOAD_DIR, filename), buffer);

    const imgPath = `/api/uploads/players/${filename}`;
    await query('UPDATE players SET img = $1 WHERE id = $2', [imgPath, playerId]);

    return NextResponse.json({ img: imgPath });
  } catch (err) {
    console.error('POST /api/uploads/players', err);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
