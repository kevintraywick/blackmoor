export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import { randomUUID } from 'crypto';

// POST /api/raven-post/ads
// Body: { image_url, real_url, overlay_text }
// Inserts a new raven_ad_products row and returns the created id.
// v1 only collects real_url + overlay_text (stored as `real_copy`). DM can
// expand via a future product-directory UI.
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: 'body must be an object' }, { status: 400 });
  }

  const { image_url, real_url, overlay_text } = body as {
    image_url?: unknown;
    real_url?: unknown;
    overlay_text?: unknown;
  };

  if (typeof image_url !== 'string' || image_url.trim().length === 0) {
    return NextResponse.json({ error: 'image_url required' }, { status: 400 });
  }
  if (typeof real_url !== 'string' || real_url.trim().length === 0) {
    return NextResponse.json({ error: 'real_url required' }, { status: 400 });
  }
  const overlay = typeof overlay_text === 'string' ? overlay_text.trim() : '';

  try {
    await ensureSchema();
    const id = `ad-${randomUUID()}`;
    const rows = await query<{ id: string }>(
      `INSERT INTO raven_ad_products
         (id, name, image_url, link, tags, in_fiction_copy, real_copy, active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
       RETURNING id`,
      [
        id,
        overlay || 'Issue ad',
        image_url,
        real_url,
        'issue',
        overlay,
        overlay,
      ],
    );
    return NextResponse.json({ id: rows[0].id }, { status: 201 });
  } catch (err) {
    console.error('[raven-post/ads] POST failed', err);
    return NextResponse.json({ error: 'create failed' }, { status: 500 });
  }
}
