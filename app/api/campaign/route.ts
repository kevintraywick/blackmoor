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
    const { name, world, quorum } = body;

    if (typeof name !== 'string' || typeof world !== 'string') {
      return NextResponse.json({ error: 'name and world must be strings' }, { status: 400 });
    }
    if (name.length > 200 || world.length > 200) {
      return NextResponse.json({ error: 'Fields must be under 200 characters' }, { status: 400 });
    }

    const sets = ['name = $1', 'world = $2'];
    const vals: unknown[] = [name.trim(), world.trim()];

    if (quorum !== undefined) {
      const q = parseInt(quorum, 10);
      if (Number.isFinite(q) && q >= 1 && q <= 10) {
        sets.push(`quorum = $${vals.length + 1}`);
        vals.push(q);
      }
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
