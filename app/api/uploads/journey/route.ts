import { NextResponse } from 'next/server';
import { writeFile, mkdir, readdir, unlink } from 'fs/promises';
import { join, extname } from 'path';

const UPLOAD_DIR = `${process.env.DATA_DIR ?? '/data'}/uploads/journey`;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

// GET /api/uploads/journey — list available journey images
export async function GET() {
  try {
    await mkdir(UPLOAD_DIR, { recursive: true });
    const files = await readdir(UPLOAD_DIR);
    const images: Record<string, string> = {};
    for (const f of files) {
      // Match s{n}_circle.* or s{n}_bg.*
      const m = f.match(/^(s\d+_(circle|bg))\.\w+$/);
      if (m) images[m[1]] = `/api/uploads/journey/${f}`;
    }
    return NextResponse.json({ images });
  } catch {
    return NextResponse.json({ images: {} });
  }
}

// POST /api/uploads/journey — upload a session image
export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const sessionNumber = formData.get('session_number') as string;
    const slot = formData.get('slot') as string;
    const image = formData.get('image') as File | null;

    if (!sessionNumber || !slot) return NextResponse.json({ error: 'session_number and slot required' }, { status: 400 });
    if (!['circle', 'bg'].includes(slot)) return NextResponse.json({ error: 'slot must be "circle" or "bg"' }, { status: 400 });
    if (!image || image.size === 0) return NextResponse.json({ error: 'image required' }, { status: 400 });
    if (!ALLOWED_MIME.includes(image.type)) return NextResponse.json({ error: 'Image must be png, jpeg, webp, or gif' }, { status: 400 });
    if (image.size > MAX_IMAGE_BYTES) return NextResponse.json({ error: 'Image must be 4 MB or smaller' }, { status: 400 });

    await mkdir(UPLOAD_DIR, { recursive: true });

    // Delete any existing file for this slot (handles extension changes)
    const prefix = `s${sessionNumber}_${slot}.`;
    const existing = await readdir(UPLOAD_DIR);
    for (const f of existing) {
      if (f.startsWith(prefix)) {
        await unlink(join(UPLOAD_DIR, f));
      }
    }

    const ext = extname(image.name) || '.png';
    const filename = `s${sessionNumber}_${slot}${ext}`;
    const buffer = Buffer.from(await image.arrayBuffer());
    await writeFile(join(UPLOAD_DIR, filename), buffer);

    const path = `/api/uploads/journey/${filename}`;
    return NextResponse.json({ path });
  } catch (err) {
    console.error('POST /api/uploads/journey', err);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
