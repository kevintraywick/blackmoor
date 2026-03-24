import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';

export async function GET() {
  try {
    await ensureSchema();
    const rows = await query('SELECT * FROM npcs ORDER BY created_at ASC');
    return NextResponse.json(rows);
  } catch (err) {
    console.error('GET /api/npcs', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureSchema();
    const { id, name = '' } = await request.json();
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const rows = await query(
      `INSERT INTO npcs (id, name) VALUES ($1, $2) RETURNING *`,
      [id, name]
    );
    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) {
    console.error('POST /api/npcs', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
