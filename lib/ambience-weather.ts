/**
 * Server-side ambience weather layer — session-scoped forecast cache + reader.
 *
 * At session start (from `app/api/sessions/[id]/route.ts`), pull the
 * 7-day NOAA GFS forecast for the current party hex and cache it keyed on
 * `session_id`. Throughout the session, any weather read goes through
 * `getCurrentState()` which reads the cache + advances along the game clock.
 *
 * Replaces `lib/weather-seed.ts`.
 *
 * See docs/plans/2026-04-19-001-feat-ambience-v1-plan.md Unit 3.
 */

import { pool, query } from './db';
import { ensureSchema } from './schema';
import { cellToBigInt, bigIntToCell, cellToLatLng, isPentagon, type H3Cell } from './h3';
import { fetchForecast } from './noaa-gfs';
import { getGameClock } from './game-clock';
import { getSubstrate } from './ambience-substrate';
import { sampleFromBiome, forecastHourToState } from './ambience-stats';
import type { ForecastHour, AmbienceSessionCache, WeatherState, KoppenZone } from './types';

interface CacheRow {
  session_id: string;
  party_h3_cell: string;
  fetched_at_real: string;
  session_game_start: string; // bigint as string
  forecast: ForecastHour[];
}

function rowToCache(row: CacheRow): AmbienceSessionCache {
  return {
    session_id: row.session_id,
    party_h3_cell: bigIntToCell(BigInt(row.party_h3_cell)),
    fetched_at_real: row.fetched_at_real,
    session_game_start: Number(row.session_game_start),
    forecast: row.forecast,
  };
}

/**
 * Seed the ambience cache for a session. Pulls a forecast for the party
 * hex's lat/lng and upserts it. Silently no-ops on any failure so session
 * start never fails because of a weather miss.
 *
 * Pentagon cells (astral voids) skip the GFS pull entirely — no real-world
 * coordinate for a void. Read path will fall back to stats-only in that case.
 */
export async function seedSessionAmbience(session_id: string, partyCell: H3Cell): Promise<void> {
  try {
    await ensureSchema();
    if (isPentagon(partyCell)) return;

    const [lat, lng] = cellToLatLng(partyCell);
    const forecast = await fetchForecast(lat, lng);
    if (!forecast) return;

    const clock = await getGameClock();
    await query(
      `INSERT INTO ambience_session_cache
         (session_id, party_h3_cell, fetched_at_real, session_game_start, forecast)
       VALUES ($1, $2, now(), $3, $4::jsonb)
       ON CONFLICT (session_id) DO UPDATE
         SET party_h3_cell      = EXCLUDED.party_h3_cell,
             fetched_at_real    = EXCLUDED.fetched_at_real,
             session_game_start = EXCLUDED.session_game_start,
             forecast           = EXCLUDED.forecast`,
      [session_id, cellToBigInt(partyCell).toString(), clock.game_time_seconds, JSON.stringify(forecast)],
    );
  } catch (err) {
    console.error('seedSessionAmbience error:', err instanceof Error ? err.message : err);
  }
}

/** Load the cache row for a session, or null if missing. */
export async function getSessionForecast(session_id: string): Promise<AmbienceSessionCache | null> {
  await ensureSchema();
  const { rows } = await pool.query<CacheRow>(
    `SELECT session_id, party_h3_cell::text AS party_h3_cell,
            fetched_at_real, session_game_start::text AS session_game_start, forecast
     FROM ambience_session_cache WHERE session_id = $1`,
    [session_id],
  );
  return rows[0] ? rowToCache(rows[0]) : null;
}

/** Find the most recent active session (started_at DESC, not ended). */
async function getMostRecentSessionId(): Promise<string | null> {
  const rows = await query<{ id: string }>(
    `SELECT id FROM sessions
     WHERE started_at IS NOT NULL AND ended_at IS NULL
     ORDER BY started_at DESC LIMIT 1`,
  );
  return rows[0]?.id ?? null;
}

/**
 * Resolve the *current* weather state for a hex, given the current game clock.
 *
 * If `cell` is the party hex of the currently-active session, returns the
 * playback-forward state from that session's forecast cache. Otherwise
 * falls back to the biome stats-only sampler (still deterministic per
 * (cell, game_hour)).
 */
export async function getCurrentState(opts: {
  cell: H3Cell;
  gameTimeSeconds: number;
}): Promise<WeatherState | null> {
  await ensureSchema();
  const { cell, gameTimeSeconds } = opts;

  // Try the active session's cache first
  const sessionId = await getMostRecentSessionId();
  if (sessionId) {
    const cache = await getSessionForecast(sessionId);
    if (cache && cache.party_h3_cell === cell) {
      // Playback index = hours since session start, clamped to [0, 167]
      const deltaHours = Math.floor((gameTimeSeconds - cache.session_game_start) / 3600);
      const idx = Math.max(0, Math.min(cache.forecast.length - 1, deltaHours));
      const hour = cache.forecast[idx];
      // prevPressure from previous forecast index (for trend)
      const prev = idx > 0 ? cache.forecast[idx - 1].pressure_hpa : null;
      const substrate = await getSubstrate(cell);
      return forecastHourToState({
        hour,
        prevPressure: prev,
        koppen: (substrate?.koppen ?? 'Cfb') as KoppenZone,
      });
    }
  }

  // Stats-only fallback
  const substrate = await getSubstrate(cell);
  if (!substrate) return null;

  // In-fiction month derived from gameTimeSeconds. For v1 we treat the
  // game clock as tracking real time (origin doc Q7), so the real-now
  // month is a reasonable proxy. Long-term this maps through a CW
  // calendar helper (BRAINSTORM.md §5 — Common Year).
  const month = new Date().getUTCMonth();

  return sampleFromBiome({
    cell,
    koppen: substrate.koppen,
    gameHour: gameTimeSeconds / 3600,
    month,
  });
}
