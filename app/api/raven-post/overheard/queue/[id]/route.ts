import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import type { RavenTrust } from '@/lib/types';

const VALID_TRUST: RavenTrust[] = ['official', 'whispered', 'rumored', 'prophesied'];

interface Props {
  params: Promise<{ id: string }>;
}

// PATCH /api/raven-post/overheard/queue/:id
// Body: { body?: string, position?: number, trust?: string }
export async function PATCH(req: Request, { params }: Props) {
  try {
    await ensureSchema();
    const { id } = await params;
    const body = await req.json();
    const sets: string[] = [];
    const vals: unknown[] = [];

    if (typeof body.body === 'string') {
      sets.push(`body = $${vals.length + 1}`);
      vals.push(body.body.trim().slice(0, 280));
    }
    if (typeof body.position === 'number') {
      sets.push(`position = $${vals.length + 1}`);
      vals.push(Math.max(0, Math.floor(body.position)));
    }
    if (typeof body.trust === 'string') {
      if (!VALID_TRUST.includes(body.trust as RavenTrust)) {
        return NextResponse.json({ error: 'invalid trust tier' }, { status: 400 });
      }
      sets.push(`trust = $${vals.length + 1}`);
      vals.push(body.trust);
    }
    if (sets.length === 0) return NextResponse.json({ error: 'nothing to update' }, { status: 400 });

    vals.push(id);
    const rows = await query(
      `UPDATE raven_overheard_queue SET ${sets.join(', ')} WHERE id = $${vals.length} RETURNING *`,
      vals,
    );
    if (rows.length === 0) return NextResponse.json({ error: 'not found' }, { status: 404 });
    return NextResponse.json(rows[0]);
  } catch (err) {
    console.error('PATCH overheard queue', err);
    return NextResponse.json({ error: 'update failed' }, { status: 500 });
  }
}

// DELETE /api/raven-post/overheard/queue/:id
export async function DELETE(_req: Request, { params }: Props) {
  try {
    await ensureSchema();
    const { id } = await params;
    await query(`DELETE FROM raven_overheard_queue WHERE id = $1`, [id]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE overheard queue', err);
    return NextResponse.json({ error: 'delete failed' }, { status: 500 });
  }
}
