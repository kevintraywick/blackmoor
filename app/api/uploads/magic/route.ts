import { NextResponse } from 'next/server';
import { writeFile, mkdir, readdir, unlink } from 'fs/promises';
import { join, extname } from 'path';
import { query } from '@/lib/db';

const UPLOAD_DIR = `${process.env.DATA_DIR ?? '/data'}/uploads/magic`;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

// POST /api/uploads/magic — upload card art for a magic_catalog row.
// formData: { id: string, image: File }
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const id = formData.get('id') as string | null;
    const image = formData.get('image') as File | null;

    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    if (!image || image.size === 0) return NextResponse.json({ error: 'image required' }, { status: 400 });
    if (!ALLOWED_MIME.includes(image.type)) {
      return NextResponse.json({ error: 'Image must be png, jpeg, webp, or gif' }, { status: 400 });
    }
    if (image.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: 'Image must be 4 MB or smaller' }, { status: 400 });
    }

    // Sanitize id for filesystem use — alphanumerics, dash, underscore only.
    const safeId = id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
    if (!safeId) return NextResponse.json({ error: 'invalid id' }, { status: 400 });

    await mkdir(UPLOAD_DIR, { recursive: true });

    // Remove any existing image for this id (covers extension changes).
    const prefix = `${safeId}.`;
    const existing = await readdir(UPLOAD_DIR).catch(() => [] as string[]);
    for (const f of existing) {
      if (f.startsWith(prefix)) {
        await unlink(join(UPLOAD_DIR, f)).catch(() => {});
      }
    }

    const ext = extname(image.name) || '.png';
    const filename = `${safeId}${ext}`;
    const buffer = Buffer.from(await image.arrayBuffer());
    await writeFile(join(UPLOAD_DIR, filename), buffer);

    const path = `/api/uploads/magic/${filename}?v=${Date.now()}`;

    await query(
      'UPDATE magic_catalog SET image_path = $1 WHERE id = $2',
      [path, id]
    );

    return NextResponse.json({ path });
  } catch (err) {
    console.error('POST /api/uploads/magic', err);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
