import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';

interface Props {
  params: Promise<{ id: string }>;
}

// POST /api/raven-post/items/:id/read — player marks an item as read
// Body: { playerId: string }
export async function POST(req: Request, { params }: Props) {
  try {
    await ensureSchema();
    const { id } = await params;
    const body = await req.json();
    const playerId = typeof body.playerId === 'string' ? body.playerId : null;
    if (!playerId) {
      return NextResponse.json({ error: 'playerId required' }, { status: 400 });
    }
    await query(
      `INSERT INTO raven_reads (player_id, item_id) VALUES ($1, $2)
       ON CONFLICT (player_id, item_id) DO UPDATE SET read_at = now()`,
      [playerId, id],
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('POST /api/raven-post/items/[id]/read', err);
    return NextResponse.json({ error: 'mark read failed' }, { status: 500 });
  }
}
