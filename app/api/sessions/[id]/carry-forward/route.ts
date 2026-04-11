import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import type { MenagerieEntry } from '@/lib/types';

/**
 * POST /api/sessions/[id]/carry-forward
 *
 * Carries surviving NPCs from this session into the next session.
 * Body: { survivors: number[] } — menagerie indices to carry forward.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await ensureSchema();
    const { id } = await params;
    const { survivors }: { survivors: number[] } = await req.json();

    // Read current session
    const [session] = await query<{
      number: number;
      npc_ids: string[];
      menagerie: MenagerieEntry[];
    }>('SELECT number, npc_ids, menagerie FROM sessions WHERE id = $1', [id]);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const menagerie: MenagerieEntry[] = Array.isArray(session.menagerie) ? session.menagerie : [];

    // Filter to selected survivors
    const carried = survivors
      .filter(idx => idx >= 0 && idx < menagerie.length)
      .map(idx => menagerie[idx]);

    if (carried.length === 0) {
      return NextResponse.json({ ok: true, survivorCount: 0 });
    }

    // Find or create next session
    const nextNumber = session.number + 1;
    let [nextSession] = await query<{
      id: string;
      npc_ids: string[];
      menagerie: MenagerieEntry[];
    }>('SELECT id, npc_ids, menagerie FROM sessions WHERE number = $1', [nextNumber]);

    if (!nextSession) {
      // Create next session
      const newId = Date.now().toString(36);
      const count = await query<{ count: number }>('SELECT COUNT(*)::int as count FROM sessions');
      await query(
        `INSERT INTO sessions (id, number, title, date, sort_order, last_modified)
         VALUES ($1, $2, '', '', $3, $4)`,
        [newId, nextNumber, count[0]?.count ?? 0, Date.now()],
      );
      nextSession = { id: newId, npc_ids: [], menagerie: [] };
    }

    const existingIds: string[] = Array.isArray(nextSession.npc_ids) ? nextSession.npc_ids : [];
    const existingMenagerie: MenagerieEntry[] = Array.isArray(nextSession.menagerie) ? nextSession.menagerie : [];

    // Merge survivors — skip duplicates (match by npc_id + label)
    const existingKeys = new Set(existingMenagerie.map(e => `${e.npc_id}::${e.label}`));
    const newEntries = carried.filter(e => !existingKeys.has(`${e.npc_id}::${e.label}`));

    const mergedIds = [...existingIds, ...newEntries.map(e => e.npc_id)];
    const mergedMenagerie = [...existingMenagerie, ...newEntries];

    await query(
      `UPDATE sessions SET npc_ids = $1::jsonb, menagerie = $2::jsonb, last_modified = $3
       WHERE id = $4`,
      [JSON.stringify(mergedIds), JSON.stringify(mergedMenagerie), Date.now(), nextSession.id],
    );

    return NextResponse.json({
      ok: true,
      nextSessionId: nextSession.id,
      survivorCount: newEntries.length,
    });
  } catch (err) {
    console.error('POST /api/sessions/[id]/carry-forward', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
