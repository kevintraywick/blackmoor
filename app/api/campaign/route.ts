import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';

// GET /api/campaign — return the single campaign row
export async function GET() {
  try {
    await ensureSchema();
    const [row] = await query('SELECT * FROM campaign LIMIT 1');
    return NextResponse.json(row ?? { id: 'default', name: '', world: '' });
  } catch (err) {
    console.error('GET /api/campaign', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

// PATCH /api/campaign — update campaign fields
export async function PATCH(req: Request) {
  try {
    await ensureSchema();
    const body = await req.json();
    const { name, world, quorum, dm_email } = body;

    const sets: string[] = [];
    const vals: unknown[] = [];

    if (typeof name === 'string') {
      sets.push(`name = $${vals.length + 1}`);
      vals.push(name.trim().slice(0, 200));
    }

    if (typeof world === 'string') {
      sets.push(`world = $${vals.length + 1}`);
      vals.push(world.trim().slice(0, 200));
    }

    if (quorum !== undefined) {
      const q = parseInt(quorum, 10);
      if (Number.isFinite(q) && q >= 1 && q <= 10) {
        sets.push(`quorum = $${vals.length + 1}`);
        vals.push(q);
      }
    }

    if (typeof dm_email === 'string') {
      sets.push(`dm_email = $${vals.length + 1}`);
      vals.push(dm_email.trim().slice(0, 200));
    }

    if (typeof body.description === 'string') {
      sets.push(`description = $${vals.length + 1}`);
      vals.push(body.description.trim().slice(0, 300));
    }

    if (typeof body.background === 'string') {
      sets.push(`background = $${vals.length + 1}`);
      vals.push(body.background.trim());
    }

    if (typeof body.narrative_notes === 'string') {
      sets.push(`narrative_notes = $${vals.length + 1}`);
      vals.push(body.narrative_notes.trim());
    }

    if (typeof body.audio_url === 'string') {
      sets.push(`audio_url = $${vals.length + 1}`);
      vals.push(body.audio_url.trim().slice(0, 500));
    }

    if (sets.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    await query(
      `UPDATE campaign SET ${sets.join(', ')} WHERE id = 'default'`,
      vals
    );

    const [row] = await query('SELECT * FROM campaign WHERE id = $1', ['default']);
    return NextResponse.json(row);
  } catch (err) {
    console.error('PATCH /api/campaign', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
