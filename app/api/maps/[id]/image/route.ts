import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { join } from 'path';
import type { MapRow } from '@/lib/types';

const MAPS_DIR = process.env.MAPS_DIR ?? '/data/maps';
const MAX_SIZE = 20 * 1024 * 1024; // 20MB
const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const EXT_MAP: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
};

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureSchema();
    const { id } = await params;

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'file field required' }, { status: 400 });

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: 'Only PNG, JPEG, WEBP allowed' }, { status: 415 });
    }

    // Read buffer first so we can check the authoritative size (file.size can be spoofed)
    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.byteLength > MAX_SIZE) {
      return NextResponse.json({ error: 'File too large (max 20MB)' }, { status: 413 });
    }

    // Ensure directory exists
    await mkdir(MAPS_DIR, { recursive: true });

    const [map] = await query<MapRow>('SELECT image_path FROM maps WHERE id = $1', [id]);
    if (!map) return NextResponse.json({ error: 'Map not found' }, { status: 404 });

    // Write new file first — if this fails, nothing has changed
    const filename = `${crypto.randomUUID()}${EXT_MAP[file.type]}`;
    await writeFile(join(MAPS_DIR, filename), buffer);

    // Delete old image after new file is safely written (orphan on failure is harmless)
    if (map.image_path) {
      try { await unlink(join(MAPS_DIR, map.image_path)); } catch { /* already gone */ }
    }

    await query('UPDATE maps SET image_path = $1 WHERE id = $2', [filename, id]);

    return NextResponse.json({ ok: true, image_path: filename });
  } catch (err) {
    console.error('POST /api/maps/[id]/image', err);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
