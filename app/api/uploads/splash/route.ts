import { NextResponse } from 'next/server';
import { writeFile, mkdir, readdir } from 'fs/promises';
import { join, extname } from 'path';
import { query } from '@/lib/db';

// Home-art upload endpoint. Three slots:
//   splash → becomes the home page backdrop, campaign.home_splash_path updated
//   banner → becomes the DM Campaign page banner, campaign.home_banner_path updated
//   other  → filed as-is for future DM use, no campaign row change
//
// Splash and banner uploads are saved as `splash_{N}.{ext}` / `banner_{N}.{ext}`
// so prior uploads remain in place and can be recovered manually. `other`
// uploads keep a sanitized original filename, with a collision-safe `_N` suffix.

const UPLOAD_DIR = `${process.env.DATA_DIR ?? '/data'}/uploads/splash`;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const VALID_SLOTS = new Set(['splash', 'banner', 'other']);

// GET /api/uploads/splash — list all files in the folder
export async function GET() {
  try {
    await mkdir(UPLOAD_DIR, { recursive: true });
    const files = await readdir(UPLOAD_DIR);
    return NextResponse.json({
      files: files.sort().map((f) => ({
        name: f,
        path: `/api/uploads/splash/${f}`,
      })),
    });
  } catch {
    return NextResponse.json({ files: [] });
  }
}

// Next numeric suffix for a given prefix. If files are `splash_1.png`,
// `splash_3.webp`, returns 4. Missing/non-numeric suffixes are ignored.
function nextSuffix(files: string[], prefix: string): number {
  let max = 0;
  for (const f of files) {
    if (!f.startsWith(`${prefix}_`)) continue;
    const body = f.slice(prefix.length + 1);
    const dot = body.lastIndexOf('.');
    const numPart = dot < 0 ? body : body.slice(0, dot);
    const n = parseInt(numPart, 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return max + 1;
}

// Strip path separators and odd characters from a user-supplied filename.
function sanitizeOriginal(name: string): string {
  const base = name.replace(/^.*[\\/]/, '');
  return base.replace(/[^a-zA-Z0-9._-]/g, '_') || 'file';
}

// Append `_N` before the extension if `target` already exists in the folder.
function withCollisionSuffix(files: Set<string>, target: string): string {
  if (!files.has(target)) return target;
  const dot = target.lastIndexOf('.');
  const stem = dot < 0 ? target : target.slice(0, dot);
  const ext = dot < 0 ? '' : target.slice(dot);
  for (let i = 2; i < 1000; i++) {
    const candidate = `${stem}_${i}${ext}`;
    if (!files.has(candidate)) return candidate;
  }
  return `${stem}_${Date.now()}${ext}`;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const image = formData.get('image') as File | null;
    const slot = formData.get('slot') as string | null;

    if (!image || image.size === 0) {
      return NextResponse.json({ error: 'image required' }, { status: 400 });
    }
    if (!ALLOWED_MIME.includes(image.type)) {
      return NextResponse.json(
        { error: 'Image must be png, jpeg, webp, or gif' },
        { status: 400 },
      );
    }
    if (image.size > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { error: 'Image must be 4 MB or smaller. Resize with `magick src.png -resize 1024x1024 out.png`.' },
        { status: 400 },
      );
    }
    if (!slot || !VALID_SLOTS.has(slot)) {
      return NextResponse.json(
        { error: 'slot must be "splash", "banner", or "other"' },
        { status: 400 },
      );
    }

    await mkdir(UPLOAD_DIR, { recursive: true });
    const existing = await readdir(UPLOAD_DIR);
    const existingSet = new Set(existing);
    const ext = (extname(image.name) || '.png').toLowerCase();

    let filename: string;
    if (slot === 'splash' || slot === 'banner') {
      const n = nextSuffix(existing, slot);
      filename = `${slot}_${n}${ext}`;
    } else {
      filename = withCollisionSuffix(existingSet, sanitizeOriginal(image.name));
    }

    const buffer = Buffer.from(await image.arrayBuffer());
    await writeFile(join(UPLOAD_DIR, filename), buffer);

    const publicPath = `/api/uploads/splash/${filename}`;

    // Update the active-slot column for splash / banner uploads.
    if (slot === 'splash') {
      await query(
        `UPDATE campaign SET home_splash_path = $1 WHERE id = 'default'`,
        [publicPath],
      );
    } else if (slot === 'banner') {
      await query(
        `UPDATE campaign SET home_banner_path = $1 WHERE id = 'default'`,
        [publicPath],
      );
    }

    return NextResponse.json({ path: publicPath, filename, slot });
  } catch (err) {
    console.error('POST /api/uploads/splash', err);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
