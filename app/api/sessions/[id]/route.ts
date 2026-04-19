import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import { pauseClock, resumeClock } from '@/lib/game-clock';
import { seedSessionWeather } from '@/lib/weather-seed';
import { seedSessionAmbience } from '@/lib/ambience-weather';
import { qrToH3Cell } from '@/lib/world-hex-mapping';
import { SHADOW_ANCHOR_CELL } from '@/lib/world-anchor-constants';
import { broadcast } from '@/lib/events';

// Static mapping prevents user-supplied strings from ever touching the query template
const SESSION_COLUMNS: Record<string, string> = {
  title: 'title', date: 'date', goal: 'goal', scenes: 'scenes',
  npcs: 'npcs', locations: 'locations', loose_ends: 'loose_ends', notes: 'notes',
  npc_ids: 'npc_ids', menagerie: 'menagerie',
  started_at: 'started_at', ended_at: 'ended_at',
  journal: 'journal', journal_public: 'journal_public', narrative_notes: 'narrative_notes',
};

// JSONB columns need JSON.stringify before passing to pg
const JSONB_COLUMNS = new Set(['npc_ids', 'menagerie']);

// GET /api/sessions/:id — fetch a single session
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const [session] = await query('SELECT * FROM sessions WHERE id = $1', [id]);
    if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(session);
  } catch (err) {
    console.error('GET /api/sessions/[id]', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

// DELETE /api/sessions/:id — remove a session
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await query('DELETE FROM sessions WHERE id = $1', [id]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/sessions/[id]', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

// PATCH /api/sessions/:id — update session fields
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    // Only update fields that exist in the static column map
    const updates = Object.entries(body)
      .filter(([k]) => SESSION_COLUMNS[k] !== undefined)
      .map(([k, v]) => [SESSION_COLUMNS[k], JSONB_COLUMNS.has(k) ? JSON.stringify(v) : v] as [string, unknown]);
    if (!updates.length) return NextResponse.json({ ok: true });

    const setClause = updates.map(([col], i) => `${col} = $${i + 1}`).join(', ');
    const values = updates.map(([, v]) => v);

    await query(
      `UPDATE sessions SET ${setClause}, last_modified = $${values.length + 1} WHERE id = $${values.length + 2}`,
      [...values, Date.now(), id]
    );

    const [session] = await query('SELECT * FROM sessions WHERE id = $1', [id]);
    return NextResponse.json(session);
  } catch (err) {
    console.error('PATCH /api/sessions/[id]', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

// POST /api/sessions/:id — session lifecycle actions (start, end)
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureSchema();
    const { id } = await params;
    const { action } = await req.json();
    const now = Date.now();

    if (action === 'start') {
      await query('UPDATE sessions SET started_at = $1, ended_at = NULL WHERE id = $2', [now, id]);
      await query(
        `INSERT INTO session_events (id, session_id, event_type, payload, created_at)
         VALUES (gen_random_uuid()::text, $1, 'session_start', '{}', $2)`,
        [id, now]
      );
      // Resume the campaign-wide game clock so weather/horde ticks can advance
      await resumeClock().catch(() => {});
      // Legacy single-row weather seed — kept until the three surfaces cut
      // over. Still drives the existing PlayerBannerWeather atmosphere.
      await seedSessionWeather().catch(() => {});
      // New ambience cache (Unit 3). Party hex resolves from
      // world_map.party_q/party_r if set, otherwise falls back to the
      // world anchor (Blaen Hafren). Multi-party v19 supersedes this.
      const [worldMap] = await query<{ party_q: number | null; party_r: number | null }>(
        `SELECT party_q, party_r FROM world_map WHERE id = 'default'`,
      );
      const partyCell = worldMap?.party_q != null && worldMap?.party_r != null
        ? qrToH3Cell(worldMap.party_q, worldMap.party_r)
        : SHADOW_ANCHOR_CELL;
      await seedSessionAmbience(id, partyCell).catch(() => {});
      broadcast('game_clock', 'default', 'patch');
    } else if (action === 'end') {
      await query('UPDATE sessions SET ended_at = $1 WHERE id = $2', [now, id]);
      await query(
        `INSERT INTO session_events (id, session_id, event_type, payload, created_at)
         VALUES (gen_random_uuid()::text, $1, 'session_pause', '{}', $2)`,
        [id, now]
      );
      // Pause the campaign-wide game clock alongside the session
      await pauseClock().catch(() => {});
      broadcast('game_clock', 'default', 'patch');
    } else {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

    const [session] = await query('SELECT * FROM sessions WHERE id = $1', [id]);
    return NextResponse.json(session);
  } catch (err) {
    console.error('POST /api/sessions/[id]', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
