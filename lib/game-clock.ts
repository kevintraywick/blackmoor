// Campaign-wide game clock.
//
// The clock is a singleton stored on the campaign row (id='default'). This
// module is the ONLY module that may mutate game_time_seconds or clock_paused.
// Everything else reads via getGameClock() and calls advanceGameTime() /
// pauseClock() / resumeClock() through the HTTP API.
//
// Game time is "seconds since campaign start". The presentation layer turns
// that into an in-fiction date/time with formatGameTime().

import { query } from './db';

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

// Advance the game clock by `seconds`. Rejects with ClockPausedError if the
// clock is currently paused. Entity tick fan-out is wired in by a later unit —
// this helper intentionally does nothing with world_entities yet.
export async function advanceGameTime(seconds: number): Promise<GameClock> {
  if (seconds <= 0) {
    throw new Error(`advanceGameTime: seconds must be > 0 (got ${seconds})`);
  }

  const clock = await getGameClock();
  if (clock.clock_paused) {
    throw new ClockPausedError();
  }

  const rows = await query<GameClock>(
    `UPDATE campaign
     SET game_time_seconds       = game_time_seconds + $1,
         clock_last_advanced_at  = EXTRACT(EPOCH FROM now())::bigint
     WHERE id = 'default'
     RETURNING game_time_seconds, clock_paused, clock_last_advanced_at`,
    [seconds]
  );
  return rows[0];
}

// Pure presentation helpers (formatGameTime, isNight) live in
// lib/game-clock-format.ts so client components can import them without
// dragging in lib/db.ts (and pg).
export { formatGameTime, isNight } from './game-clock-format';
