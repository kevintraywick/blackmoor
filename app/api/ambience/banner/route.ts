import { NextResponse } from 'next/server';
import { ensureSchema } from '@/lib/schema';
import { getGameClock } from '@/lib/game-clock';
import { getCurrentState } from '@/lib/ambience-weather';
import { getSubstrate } from '@/lib/ambience-substrate';
import { renderProse } from '@/lib/ambience-prose';
import { query } from '@/lib/db';
import { qrToH3Cell } from '@/lib/world-hex-mapping';
import { SHADOW_ANCHOR_CELL } from '@/lib/world-anchor-constants';
import type { KoppenZone } from '@/lib/types';

/**
 * GET /api/ambience/banner
 *
 * Single ambience read endpoint used by all three render surfaces (player
 * sheet banner, SCB DM chip, broadsheet forecast column). Returns both the
 * structured state (DM/chip can show numbers on hover) and the prose line
 * (players see this).
 *
 * Query:
 *   ?cell=<h3_cell_hex>  — optional. If omitted, uses the campaign's party
 *                          hex (world_map.party_q/r → h3_cell) or the
 *                          world anchor as fallback.
 *
 * Response shape:
 *   { cell, koppen, state, prose, gameTimeSeconds }
 */
export async function GET(req: Request) {
  try {
    await ensureSchema();
    const url = new URL(req.url);
    const cellParam = url.searchParams.get('cell');

    let cell: string;
    if (cellParam && /^[0-9a-f]{15}$/i.test(cellParam)) {
      cell = cellParam;
    } else {
      const worldRows = await query<{ party_q: number | null; party_r: number | null }>(
        `SELECT party_q, party_r FROM world_map WHERE id = 'default'`,
      );
      const wm = worldRows[0];
      cell = wm?.party_q != null && wm?.party_r != null
        ? qrToH3Cell(wm.party_q, wm.party_r)
        : SHADOW_ANCHOR_CELL;
    }

    const clock = await getGameClock();
    const substrate = await getSubstrate(cell);
    const state = await getCurrentState({ cell, gameTimeSeconds: clock.game_time_seconds });

    if (!state || !substrate) {
      return NextResponse.json(
        { error: 'No ambience data for this cell yet', cell },
        { status: 404 },
      );
    }

    const prose = renderProse({
      koppen: substrate.koppen as KoppenZone,
      state,
      gameHour: clock.game_time_seconds / 3600,
    });

    return NextResponse.json({
      cell,
      koppen: substrate.koppen,
      state,
      prose,
      gameTimeSeconds: clock.game_time_seconds,
    });
  } catch (err) {
    console.error('GET /api/ambience/banner', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
