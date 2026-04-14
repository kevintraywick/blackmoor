export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { randomUUID } from 'crypto';
import { extname, join } from 'path';

const UPLOAD_DIR = `${process.env.DATA_DIR ?? '/data'}/uploads/raven-post/issue`;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

// POST /api/uploads/raven-post/issue — upload a hero image or ad image
// for the broadsheet editor. Returns { url } pointing at the GET handler.
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const image = formData.get('image') as File | null;
    const kind = (formData.get('kind') as string) || 'hero';

    if (!image || image.size === 0) {
      return NextResponse.json({ error: 'image required' }, { status: 400 });
    }
    if (!ALLOWED_MIME.includes(image.type)) {
      return NextResponse.json({ error: 'Image must be png, jpeg, webp, or gif' }, { status: 400 });
    }
    if (image.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: 'Image must be 4 MB or smaller' }, { status: 400 });
    }
    if (kind !== 'hero' && kind !== 'ad') {
      return NextResponse.json({ error: 'kind must be "hero" or "ad"' }, { status: 400 });
    }

    await mkdir(UPLOAD_DIR, { recursive: true });

    const ext = extname(image.name) || '.png';
    const filename = `${kind}_${randomUUID()}${ext}`;
    const filepath = join(UPLOAD_DIR, filename);

    const buffer = Buffer.from(await image.arrayBuffer());
    await writeFile(filepath, buffer);

    return NextResponse.json({ url: `/api/uploads/raven-post/issue/${filename}` });
  } catch (err) {
    console.error('[uploads/raven-post/issue] POST failed', err);
    return NextResponse.json({ error: 'upload failed' }, { status: 500 });
  }
}
