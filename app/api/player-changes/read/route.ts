import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';

// PATCH /api/player-changes/read — mark all unread changes as read
export async function PATCH() {
  try {
    await ensureSchema();
    await query('UPDATE player_changes SET read = true WHERE read = false');
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('PATCH /api/player-changes/read', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
