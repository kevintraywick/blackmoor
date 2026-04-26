import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema } from '@/lib/schema';
import { query } from '@/lib/db';
import { writeFile, mkdir, readFile } from 'fs/promises';
import { join } from 'path';

// Honors the project-wide DATA_DIR convention (set in .env.local for dev,
// `/data` on Railway). Legacy BUILDER_IMAGES_DIR override still wins if set.
const BUILDER_IMAGES_DIR =
  process.env.BUILDER_IMAGES_DIR ?? `${process.env.DATA_DIR ?? '/data'}/builder-images`;
const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};
const MAX_SIZE = 20 * 1024 * 1024; // 20MB
const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const EXT_MAP: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
};

// GET /api/map-builder/[id]/image — serve the uploaded map image bytes.
// Looks up the build's image_path then streams the file from disk.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureSchema();
    const { id } = await params;
    const [row] = await query<{ image_path: string | null }>(
      'SELECT image_path FROM map_builds WHERE id = $1',
      [id],
    );
    if (!row?.image_path) {
      return NextResponse.json({ error: 'No image' }, { status: 404 });
    }
    const filename = row.image_path;
    if (filename.includes('/') || filename.includes('..')) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
    }
    const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
    const contentType = CONTENT_TYPE_BY_EXT[ext] ?? 'application/octet-stream';
    const buffer = await readFile(join(BUILDER_IMAGES_DIR, filename));
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (err) {
    console.error('GET /api/map-builder/[id]/image', err);
    return NextResponse.json({ error: 'Read failed' }, { status: 500 });
  }
}

// POST /api/map-builder/[id]/image — upload a map image for the builder
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureSchema();
    await params; // validate route param exists

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'file field required' }, { status: 400 });

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: 'Only PNG, JPEG, WEBP allowed' }, { status: 415 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.byteLength > MAX_SIZE) {
      return NextResponse.json({ error: 'File too large (max 20MB)' }, { status: 413 });
    }

    await mkdir(BUILDER_IMAGES_DIR, { recursive: true });

    const filename = `${crypto.randomUUID()}${EXT_MAP[file.type]}`;
    await writeFile(join(BUILDER_IMAGES_DIR, filename), buffer);

    // Return both the filename and the base64 for Mappy analysis
    const base64 = buffer.toString('base64');

    return NextResponse.json({
      ok: true,
      image_path: filename,
      base64,
      media_type: file.type,
    });
  } catch (err) {
    console.error('POST /api/map-builder/[id]/image', err);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
