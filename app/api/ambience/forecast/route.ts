import { NextResponse } from 'next/server';
import { ensureSchema } from '@/lib/schema';
import { getGameClock } from '@/lib/game-clock';
import { getSessionForecast } from '@/lib/ambience-weather';
import { getSubstrate } from '@/lib/ambience-substrate';
import { renderProse } from '@/lib/ambience-prose';
import { forecastHourToState, sampleFromBiome } from '@/lib/ambience-stats';
import { query } from '@/lib/db';
import { qrToH3Cell } from '@/lib/world-hex-mapping';
import { SHADOW_ANCHOR_CELL } from '@/lib/world-anchor-constants';
import type { KoppenZone } from '@/lib/types';

/**
 * GET /api/ambience/forecast
 *
 * Returns three prose lines for the Raven Post broadsheet's forecast column:
 * today (now), tomorrow (+24h), day after (+48h). All sourced from the
 * active session's cached 7-day forecast, converted to prose via the
 * template library. If no active session or cache, returns null.
 *
 * Response shape: { lines: [{ label, prose }, ...] } | { lines: null }
 */
export async function GET() {
  try {
    await ensureSchema();

    const clock = await getGameClock();

    // Preferred path: active session's cached forecast.
    const sessRows = await query<{ id: string }>(
      `SELECT id FROM sessions WHERE started_at IS NOT NULL AND ended_at IS NULL
       ORDER BY started_at DESC LIMIT 1`,
    );
    const sessionId = sessRows[0]?.id;
    const cache = sessionId ? await getSessionForecast(sessionId) : null;

    // Target cell for substrate lookup: party hex if known, else anchor.
    let targetCell = cache?.party_h3_cell ?? null;
    if (!targetCell) {
      const worldRows = await query<{ party_q: number | null; party_r: number | null }>(
        `SELECT party_q, party_r FROM world_map WHERE id = 'default'`,
      );
      const wm = worldRows[0];
      targetCell = wm?.party_q != null && wm?.party_r != null
        ? qrToH3Cell(wm.party_q, wm.party_r)
        : SHADOW_ANCHOR_CELL;
    }
    const substrate = await getSubstrate(targetCell);
    const koppen = (substrate?.koppen ?? 'Cfb') as KoppenZone;

    const offsets = [
      { label: 'Today', hours: 0 },
      { label: 'Tomorrow', hours: 24 },
      { label: 'The day after', hours: 48 },
    ];
    const month = new Date().getUTCMonth();

    const lines = offsets.map(({ label, hours }) => {
      let prose: string;
      if (cache) {
        // Forecast playback path
        const deltaHours = Math.floor((clock.game_time_seconds - cache.session_game_start) / 3600) + hours;
        const idx = Math.max(0, Math.min(cache.forecast.length - 1, deltaHours));
        const hour = cache.forecast[idx];
        const prev = idx > 0 ? cache.forecast[idx - 1].pressure_hpa : null;
        const state = forecastHourToState({ hour, prevPressure: prev, koppen });
        prose = renderProse({
          koppen,
          state,
          gameHour: (clock.game_time_seconds / 3600) + hours,
        });
      } else {
        // Stats-only fallback — pure deterministic sample per (cell, hour)
        const gameHour = (clock.game_time_seconds / 3600) + hours;
        const state = sampleFromBiome({
          cell: targetCell!,
          koppen,
          gameHour,
          month,
        });
        prose = renderProse({ koppen, state, gameHour });
      }
      return { label, prose };
    });

    return NextResponse.json({ lines });
  } catch (err) {
    console.error('GET /api/ambience/forecast', err);
    return NextResponse.json({ lines: null }, { status: 500 });
  }
}
