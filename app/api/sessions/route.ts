import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';

// GET /api/sessions — return all sessions ordered by sort_order
export async function GET() {
  await ensureSchema();
  const rows = await query(
    'SELECT * FROM sessions ORDER BY sort_order ASC, number ASC'
  );
  return NextResponse.json(rows);
}

// POST /api/sessions — create a new session
export async function POST(req: Request) {
  await ensureSchema();
  const body = await req.json();
  const { id, number, title = '', date = '' } = body;

  // Count existing sessions to set sort_order at the end
  const [{ count }] = await query<{ count: string }>(
    'SELECT COUNT(*) as count FROM sessions'
  );

  await query(
    `INSERT INTO sessions (id, number, title, date, sort_order, last_modified)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, number, title, date, parseInt(count), Date.now()]
  );

  const [session] = await query('SELECT * FROM sessions WHERE id = $1', [id]);
  return NextResponse.json(session);
}

// PATCH /api/sessions — reorder sessions (array of ids in new order)
export async function PATCH(req: Request) {
  await ensureSchema();
  const { ids } = await req.json();

  // Update sort_order for each session based on its position in the array
  await Promise.all(
    ids.map((id: string, i: number) =>
      query('UPDATE sessions SET sort_order = $1 WHERE id = $2', [i, id])
    )
  );

  return NextResponse.json({ ok: true });
}
