import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import { randomUUID } from 'crypto';

const VALID_CATEGORIES = ['spell', 'scroll', 'magic_item', 'other'];

export async function POST(request: Request) {
  try {
    await ensureSchema();
    const body = await request.json();
    const { category, name, api_key, description, metadata } = body;

    if (typeof category !== 'string' || typeof name !== 'string' || !category || !name) {
      return NextResponse.json({ error: 'category and name required' }, { status: 400 });
    }
    if (!VALID_CATEGORIES.includes(category)) {
      return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
    }
    if (name.length > 200 || (typeof description === 'string' && description.length > 10000)) {
      return NextResponse.json({ error: 'Input too long' }, { status: 400 });
    }

    const id = randomUUID();
    const descStr = typeof description === 'string' ? description : '';
    const metaStr = JSON.stringify(metadata && typeof metadata === 'object' ? metadata : {});

    // Upsert: if same category + api_key already exists, update description/metadata
    const upsertSql = api_key
      ? `INSERT INTO magic_catalog (id, category, name, api_key, description, metadata)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (category, api_key) WHERE api_key IS NOT NULL
         DO UPDATE SET description = EXCLUDED.description, metadata = EXCLUDED.metadata,
                       created_at = (EXTRACT(EPOCH FROM now())::bigint)
         RETURNING *`
      : `INSERT INTO magic_catalog (id, category, name, api_key, description, metadata)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`;

    const rows = await query(upsertSql, [id, category, name, api_key ?? null, descStr, metaStr]);
    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) {
    console.error('POST /api/magic/catalog', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
