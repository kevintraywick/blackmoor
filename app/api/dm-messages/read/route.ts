import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';

// PATCH /api/dm-messages/read — mark all unread messages for a player as read
export async function PATCH(req: Request) {
  try {
    await ensureSchema();
    const { player_id } = await req.json();

    if (!player_id) {
      return NextResponse.json({ error: 'player_id required' }, { status: 400 });
    }

    await query(
      `UPDATE dm_messages SET read = true WHERE player_id = $1 AND read = false`,
      [player_id]
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('PATCH /api/dm-messages/read', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
