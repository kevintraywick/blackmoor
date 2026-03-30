import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema } from '@/lib/schema';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

const BUILDER_IMAGES_DIR = process.env.BUILDER_IMAGES_DIR ?? '/data/builder-images';
const MAX_SIZE = 20 * 1024 * 1024; // 20MB
const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const EXT_MAP: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
};

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
