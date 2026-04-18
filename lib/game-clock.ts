// Campaign-wide game clock.
//
// The clock is a singleton stored on the campaign row (id='default'). This
// module is the ONLY module that may mutate game_time_seconds or clock_paused.
// Everything else reads via getGameClock() and calls advanceGameTime() /
// pauseClock() / resumeClock() through the HTTP API.
//
// Game time is "seconds since campaign start". The presentation layer turns
// that into an in-fiction date/time with formatGameTime().

import { query, withTransaction } from './db';
import { H3_RES } from './h3';
import { qrToH3BigInt } from './world-hex-mapping';

export interface GameClock {
  game_time_seconds: number;
  clock_paused: boolean;
  clock_last_advanced_at: number;
}

export async function getGameClock(): Promise<GameClock> {
  const rows = await query<GameClock>(
    `SELECT game_time_seconds, clock_paused, clock_last_advanced_at
     FROM campaign WHERE id = 'default'`
  );
  if (rows.length === 0) {
    throw new Error('campaign singleton missing — did ensureSchema run?');
  }
  return rows[0];
}

export async function pauseClock(): Promise<GameClock> {
  const rows = await query<GameClock>(
    `UPDATE campaign SET clock_paused = true
     WHERE id = 'default'
     RETURNING game_time_seconds, clock_paused, clock_last_advanced_at`
  );
  return rows[0];
}

export async function resumeClock(): Promise<GameClock> {
  const rows = await query<GameClock>(
    `UPDATE campaign SET clock_paused = false
     WHERE id = 'default'
     RETURNING game_time_seconds, clock_paused, clock_last_advanced_at`
  );
  return rows[0];
}

export class ClockPausedError extends Error {
  constructor() {
    super('Cannot advance game clock while paused');
    this.name = 'ClockPausedError';
  }
}

// Advance the game clock by `seconds` and tick every world_entity along its
// waypoint path. The clock write and the entity ticks happen inside one
// transaction so the world is never half-advanced.
//
// Rejects with ClockPausedError if the clock is currently paused.
export async function advanceGameTime(seconds: number): Promise<GameClock> {
  if (seconds <= 0) {
    throw new Error(`advanceGameTime: seconds must be > 0 (got ${seconds})`);
  }

  return withTransaction(async (client) => {
    // Lock the campaign row so a concurrent advance cannot interleave
    const lockRes = await client.query(
      `SELECT game_time_seconds, clock_paused FROM campaign WHERE id = 'default' FOR UPDATE`
    );
    if (lockRes.rows.length === 0) {
      throw new Error('campaign singleton missing');
    }
    if (lockRes.rows[0].clock_paused) {
      throw new ClockPausedError();
    }

    // Advance the clock
    const advRes = await client.query(
      `UPDATE campaign
       SET game_time_seconds       = game_time_seconds + $1,
           clock_last_advanced_at  = EXTRACT(EPOCH FROM now())::bigint
       WHERE id = 'default'
       RETURNING game_time_seconds, clock_paused, clock_last_advanced_at`,
      [seconds]
    );
    const newClock = advRes.rows[0] as GameClock;

    // Tick every entity that has a waypoint path. For each, advance
    // waypoint_index by floor(seconds / seconds_per_step), capped at the
    // last waypoint, and set current_q/r to the new waypoint.
    const entRes = await client.query(
      `SELECT id, waypoints, waypoint_index, seconds_per_step
       FROM world_entities
       WHERE jsonb_array_length(waypoints) > 0`
    );
    for (const ent of entRes.rows) {
      const waypoints = ent.waypoints as Array<{ q: number; r: number }>;
      if (!Array.isArray(waypoints) || waypoints.length === 0) continue;
      const stepsPossible = Math.floor(seconds / Number(ent.seconds_per_step));
      if (stepsPossible <= 0) continue;
      const lastIndex = waypoints.length - 1;
      const newIndex = Math.min(ent.waypoint_index + stepsPossible, lastIndex);
      if (newIndex === ent.waypoint_index) continue;
      const target = waypoints[newIndex];
      if (!target || typeof target.q !== 'number' || typeof target.r !== 'number') continue;
      // H3 dual-write (v3 item #50): step-advance updates both legacy
      // (current_q, current_r) and the derived H3 cell.
      await client.query(
        `UPDATE world_entities
         SET waypoint_index = $1,
             current_q      = $2,
             current_r      = $3,
             h3_cell        = $4,
             h3_res         = $5,
             updated_at     = EXTRACT(EPOCH FROM now())::bigint
         WHERE id = $6`,
        [newIndex, target.q, target.r, qrToH3BigInt(target.q, target.r).toString(), H3_RES.DM_HEX, ent.id]
      );
    }

    return newClock;
  });
}


// Pure presentation helpers (formatGameTime, isNight) live in
// lib/game-clock-format.ts so client components can import them without
// dragging in lib/db.ts (and pg).
export { formatGameTime, isNight } from './game-clock-format';
