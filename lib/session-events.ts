// Session event log helpers.
//
// Local map actions publish events into session_events during play. A future
// session report UI reads them. This module is the only writer for
// session_events. Keep publish calls best-effort: a publish failure must
// never block the user-facing action that triggered it.

import { query } from './db';
import { getGameClock } from './game-clock';

export interface SessionEvent {
  id: string;
  session_id: string;
  game_time_seconds: number;
  kind: string;
  local_map_id: string | null;
  world_hex_q: number | null;
  world_hex_r: number | null;
  payload: Record<string, unknown>;
  created_at: number;
}

export interface PublishSessionEventInput {
  sessionId: string;
  kind: string;
  localMapId?: string | null;
  q?: number | null;
  r?: number | null;
  payload?: Record<string, unknown>;
}

export async function publishSessionEvent(
  input: PublishSessionEventInput
): Promise<SessionEvent> {
  const clock = await getGameClock();
  const rows = await query<SessionEvent>(
    `INSERT INTO session_events
       (id, session_id, game_time_seconds, kind, local_map_id, world_hex_q, world_hex_r, payload)
     VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7::jsonb)
     RETURNING id, session_id, game_time_seconds, kind, local_map_id,
               world_hex_q, world_hex_r, payload, created_at`,
    [
      input.sessionId,
      clock.game_time_seconds,
      input.kind,
      input.localMapId ?? null,
      input.q ?? null,
      input.r ?? null,
      JSON.stringify(input.payload ?? {}),
    ]
  );
  return rows[0];
}

export async function listSessionEvents(
  sessionId: string,
  limit = 50
): Promise<SessionEvent[]> {
  return query<SessionEvent>(
    `SELECT id, session_id, game_time_seconds, kind, local_map_id,
            world_hex_q, world_hex_r, payload, created_at
     FROM session_events
     WHERE session_id = $1
     ORDER BY game_time_seconds DESC, id DESC
     LIMIT $2`,
    [sessionId, limit]
  );
}
