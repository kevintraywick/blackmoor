import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import { randomUUID } from 'crypto';

export async function GET() {
  try {
    await ensureSchema();
    const rows = await query('SELECT * FROM magic_catalog ORDER BY created_at DESC');
    return NextResponse.json(rows);
  } catch (err) {
    console.error('GET /api/magic/catalog', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureSchema();
    const body = await request.json();
    const { category, name, api_key, description, metadata } = body;

    if (!category || !name) {
      return NextResponse.json({ error: 'category and name required' }, { status: 400 });
    }

    const id = randomUUID();
    const rows = await query(
      `INSERT INTO magic_catalog (id, category, name, api_key, description, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [id, category, name, api_key ?? null, description ?? '', JSON.stringify(metadata ?? {})]
    );
    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) {
    console.error('POST /api/magic/catalog', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
