import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';

const ALLOWED_FIELDS = new Set(['name', 'species', 'cr', 'hp', 'ac', 'speed', 'attacks', 'traits', 'actions', 'notes']);

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureSchema();
    const { id } = await params;
    const body = await request.json();

    const updates = Object.entries(body).filter(([k]) => ALLOWED_FIELDS.has(k));
    if (updates.length === 0) {
      return NextResponse.json({ error: 'No valid fields' }, { status: 400 });
    }

    const setClauses = updates.map(([k], i) => `${k} = $${i + 2}`).join(', ');
    const values = [id, ...updates.map(([, v]) => v)];

    const rows = await query(
      `UPDATE npcs SET ${setClauses} WHERE id = $1 RETURNING *`,
      values
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json(rows[0]);
  } catch (err) {
    console.error('PATCH /api/npcs/[id]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureSchema();
    const { id } = await params;
    await query('DELETE FROM npcs WHERE id = $1', [id]);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error('DELETE /api/npcs/[id]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
