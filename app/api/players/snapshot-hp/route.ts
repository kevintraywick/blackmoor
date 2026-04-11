import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';

/**
 * POST /api/players/snapshot-hp
 *
 * Snapshots every active player's `hp` into `current_hp` and `max_hp`.
 * Called at session start and combat start so the ring has a stable max
 * even if the player edits their HP mid-session.
 */
export async function POST() {
  try {
    await ensureSchema();
    await query(
      `UPDATE player_sheets SET current_hp = hp, max_hp = hp WHERE status != 'removed'`
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('POST /api/players/snapshot-hp', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
