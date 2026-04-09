import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';

interface Props {
  params: Promise<{ id: string }>;
}

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
    if (typeof body.reasoning === 'string') {
      sets.push(`reasoning = $${vals.length + 1}`);
      vals.push(body.reasoning.trim().slice(0, 2000));
    }
    if (Array.isArray(body.tags)) {
      sets.push(`tags = $${vals.length + 1}`);
      vals.push(body.tags.filter((t: unknown): t is string => typeof t === 'string').slice(0, 30));
    }

    if (sets.length === 0) {
      return NextResponse.json({ error: 'no fields to update' }, { status: 400 });
    }

    // Store the original body if this is the first edit (for DM-edit-diff tracking)
    sets.push(`original_body = COALESCE(original_body, body)`);

    vals.push(id);
    const rows = await query(
      `UPDATE raven_world_ai_proposals SET ${sets.join(', ')} WHERE id = $${vals.length} RETURNING *`,
      vals,
    );
    if (rows.length === 0) {
      return NextResponse.json({ error: 'not found' }, { status: 404 });
    }
    return NextResponse.json(rows[0]);
  } catch (err) {
    console.error('PATCH world-ai/proposals/[id]', err);
    return NextResponse.json({ error: 'update failed' }, { status: 500 });
  }
}
