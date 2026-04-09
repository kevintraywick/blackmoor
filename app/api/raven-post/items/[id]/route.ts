import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import type { RavenItem } from '@/lib/types';

interface Props {
  params: Promise<{ id: string }>;
}

// PATCH /api/raven-post/items/:id — edit an existing item (DM)
export async function PATCH(req: Request, { params }: Props) {
  try {
    await ensureSchema();
    const { id } = await params;
    const body = await req.json();

    const sets: string[] = [];
    const vals: unknown[] = [];

    if (typeof body.body === 'string') {
      sets.push(`body = $${vals.length + 1}`);
      vals.push(body.body.trim().slice(0, 2000));
    }
    if (typeof body.headline === 'string') {
      sets.push(`headline = $${vals.length + 1}`);
      vals.push(body.headline.trim().slice(0, 200));
    }
    if (typeof body.sender === 'string') {
      sets.push(`sender = $${vals.length + 1}`);
      vals.push(body.sender.trim().slice(0, 200));
    }
    if (Array.isArray(body.tags)) {
      sets.push(`tags = $${vals.length + 1}`);
      vals.push(body.tags.filter((t: unknown): t is string => typeof t === 'string').slice(0, 30));
    }
    if (typeof body.trust === 'string') {
      sets.push(`trust = $${vals.length + 1}`);
      vals.push(body.trust);
    }

    if (sets.length === 0) {
      return NextResponse.json({ error: 'no fields to update' }, { status: 400 });
    }

    vals.push(id);
    const rows = await query<RavenItem>(
      `UPDATE raven_items SET ${sets.join(', ')} WHERE id = $${vals.length} RETURNING *`,
      vals,
    );
    if (rows.length === 0) {
      return NextResponse.json({ error: 'not found' }, { status: 404 });
    }
    return NextResponse.json(rows[0]);
  } catch (err) {
    console.error('PATCH /api/raven-post/items/[id]', err);
    return NextResponse.json({ error: 'update failed' }, { status: 500 });
  }
}

// DELETE /api/raven-post/items/:id — unpublish (DM)
export async function DELETE(_req: Request, { params }: Props) {
  try {
    await ensureSchema();
    const { id } = await params;
    await query(`DELETE FROM raven_items WHERE id = $1`, [id]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/raven-post/items/[id]', err);
    return NextResponse.json({ error: 'delete failed' }, { status: 500 });
  }
}
