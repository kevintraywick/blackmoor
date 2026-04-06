import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';

interface Props {
  params: Promise<{ id: string }>;
}

export async function GET(_: Request, { params }: Props) {
  await ensureSchema();
  const { id } = await params;

  try {
    // Players who rolled initiative in this session
    const events = await query<{ payload: { player_ids?: string[] } }>(
      `SELECT payload FROM session_events WHERE session_id = $1 AND event_type = 'combat_start' ORDER BY created_at ASC`,
      [id]
    );
    const playerIdSet = new Set<string>();
    for (const e of events) {
      const ids = e.payload?.player_ids;
      if (Array.isArray(ids)) ids.forEach(pid => playerIdSet.add(pid));
    }
    // Resolve player names
    let players: { id: string; character: string }[] = [];
    if (playerIdSet.size > 0) {
      const ids = Array.from(playerIdSet);
      players = await query<{ id: string; character: string }>(
        `SELECT id, character FROM players WHERE id = ANY($1)`,
        [ids]
      );
    }

    // Boons granted in this session
    const boons = await query<{ name: string; player_id: string }>(
      `SELECT name, player_id FROM player_boons WHERE session_id = $1`,
      [id]
    );
    // Resolve boon player names
    const boonPlayerIds = new Set(boons.map(b => b.player_id));
    let boonPlayers: Record<string, string> = {};
    if (boonPlayerIds.size > 0) {
      const rows = await query<{ id: string; character: string }>(
        `SELECT id, character FROM players WHERE id = ANY($1)`,
        [Array.from(boonPlayerIds)]
      );
      boonPlayers = Object.fromEntries(rows.map(r => [r.id, r.character]));
    }

    // Poisons inflicted in this session
    const poisons = await query<{ poison_type: string; player_id: string }>(
      `SELECT poison_type, player_id FROM poison_status WHERE session_id = $1`,
      [id]
    );
    const poisonPlayerIds = new Set(poisons.map(p => p.player_id));
    let poisonPlayers: Record<string, string> = {};
    if (poisonPlayerIds.size > 0) {
      const rows = await query<{ id: string; character: string }>(
        `SELECT id, character FROM players WHERE id = ANY($1)`,
        [Array.from(poisonPlayerIds)]
      );
      poisonPlayers = Object.fromEntries(rows.map(r => [r.id, r.character]));
    }

    // NPCs killed in this session
    const killed = await query<{ payload: { npc_name?: string } }>(
      `SELECT payload FROM session_events WHERE session_id = $1 AND event_type = 'npc_killed' ORDER BY created_at ASC`,
      [id]
    );

    return NextResponse.json({
      players: players.map(p => p.character),
      boons: boons.map(b => ({ name: b.name, player: boonPlayers[b.player_id] || b.player_id })),
      poisons: poisons.map(p => ({ type: p.poison_type, player: poisonPlayers[p.player_id] || p.player_id })),
      killed: killed.map(k => k.payload?.npc_name || 'Unknown').filter((v, i, a) => a.indexOf(v) === i),
    });
  } catch (err) {
    console.error('GET /api/sessions/[id]/stats', err);
    return NextResponse.json({ players: [], boons: [], poisons: [], killed: [] });
  }
}
