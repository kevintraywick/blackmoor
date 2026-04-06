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
      // Match s{n}_circle.*, s{n}_bg.*, or campaign_bg.*
      const m = f.match(/^(s\d+_(circle|bg)|campaign_bg|journal_bg)\.\w+$/);
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
    const image = formData.get('image') as File | null;

    if (!image || image.size === 0) return NextResponse.json({ error: 'image required' }, { status: 400 });
    if (!ALLOWED_MIME.includes(image.type)) return NextResponse.json({ error: 'Image must be png, jpeg, webp, or gif' }, { status: 400 });
    if (image.size > MAX_IMAGE_BYTES) return NextResponse.json({ error: 'Image must be 4 MB or smaller' }, { status: 400 });

    // Determine file key — either session-based or a named key (e.g. campaign_bg)
    const namedKey = formData.get('key') as string | null;
    const sessionNumber = formData.get('session_number') as string;
    const slot = formData.get('slot') as string;

    let fileKey: string;
    if (namedKey === 'campaign_bg' || namedKey === 'journal_bg') {
      fileKey = namedKey;
    } else {
      if (!sessionNumber || !slot) return NextResponse.json({ error: 'session_number and slot required' }, { status: 400 });
      if (!['circle', 'bg'].includes(slot)) return NextResponse.json({ error: 'slot must be "circle" or "bg"' }, { status: 400 });
      fileKey = `s${sessionNumber}_${slot}`;
    }

    await mkdir(UPLOAD_DIR, { recursive: true });

    // Delete any existing file for this key (handles extension changes)
    const prefix = `${fileKey}.`;
    const existing = await readdir(UPLOAD_DIR);
    for (const f of existing) {
      if (f.startsWith(prefix)) {
        await unlink(join(UPLOAD_DIR, f));
      }
    }

    const ext = extname(image.name) || '.png';
    const filename = `${fileKey}${ext}`;
    const buffer = Buffer.from(await image.arrayBuffer());
    await writeFile(join(UPLOAD_DIR, filename), buffer);

    const path = `/api/uploads/journey/${filename}`;
    return NextResponse.json({ path });
  } catch (err) {
    console.error('POST /api/uploads/journey', err);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
