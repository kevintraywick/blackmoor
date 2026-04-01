import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import type { Session, MenagerieEntry } from '@/lib/types';

// POST /api/sessions/:id/long-rest — omnibus long rest
// Restores NPC HP, expires long-rest boons, clears long-rest poisons, logs event
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureSchema();
    const { id } = await params;
    const now = Date.now();

    // 1. Restore menagerie HP
    const [session] = await query<Session>('SELECT menagerie FROM sessions WHERE id = $1', [id]);
    let restoredNpcs = 0;
    if (session?.menagerie?.length) {
      const restored: MenagerieEntry[] = session.menagerie.map(entry => {
        if (entry.maxHp && entry.hp < entry.maxHp) {
          restoredNpcs++;
          return { ...entry, hp: entry.maxHp };
        }
        return entry;
      });
      await query(
        'UPDATE sessions SET menagerie = $1 WHERE id = $2',
        [JSON.stringify(restored), id]
      );
    }

    // 2. Expire long-rest boons (and short-rest boons, since long rest covers both)
    const boonResult = await query(
      `UPDATE player_boons SET active = false
       WHERE active = true AND expiry_type IN ('long_rest', 'short_rest')
       RETURNING id`
    ).catch(() => []);
    const expiredBoons = Array.isArray(boonResult) ? boonResult.length : 0;

    // 3. Clear long-rest poisons
    const poisonResult = await query(
      `UPDATE poison_status SET active = false
       WHERE active = true AND duration = 'long_rest'
       RETURNING id`
    ).catch(() => []);
    const clearedPoisons = Array.isArray(poisonResult) ? poisonResult.length : 0;

    // 4. Log event
    const payload = { restored_npcs: restoredNpcs, expired_boons: expiredBoons, cleared_poisons: clearedPoisons };
    await query(
      `INSERT INTO session_events (id, session_id, event_type, payload, created_at)
       VALUES (gen_random_uuid()::text, $1, 'long_rest', $2, $3)`,
      [id, JSON.stringify(payload), now]
    );

    return NextResponse.json({ ok: true, ...payload });
  } catch (err) {
    console.error('POST /api/sessions/[id]/long-rest', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
