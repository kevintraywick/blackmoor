import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';

/**
 * POST /api/players/snapshot-hp
 *
 * Default: snapshots every active player's `hp` into `current_hp` and `max_hp`.
 * Called at session start and combat start so the ring has a stable max
 * even if the player edits their HP mid-session.
 *
 * ?mode=heal: resets `current_hp = max_hp` (full heal, long rest).
 * Does not re-snapshot max from the player's editable `hp`.
 */
export async function POST(req: NextRequest) {
  try {
    await ensureSchema();
    const mode = req.nextUrl.searchParams.get('mode');
    if (mode === 'heal') {
      await query(
        `UPDATE player_sheets SET current_hp = max_hp WHERE status != 'removed' AND max_hp != ''`
      );
    } else {
      await query(
        `UPDATE player_sheets SET current_hp = hp, max_hp = hp WHERE status != 'removed'`
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('POST /api/players/snapshot-hp', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
