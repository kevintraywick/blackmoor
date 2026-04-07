import { NextResponse } from 'next/server';
import { ensureSchema } from '@/lib/schema';
import { getHex, listEntitiesAtHex } from '@/lib/world';
import { getGameClock } from '@/lib/game-clock';
import { formatGameTime, isNight } from '@/lib/game-clock-format';

// GET /api/world/hexes/[q]/[r]/environment
// Returns the current weather + day/night state for a hex, derived from
// the world map at the current campaign game time. Used by local maps
// anchored to this hex to render their environment pill.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ q: string; r: string }> }
) {
  try {
    await ensureSchema();
    const { q: qStr, r: rStr } = await params;
    const q = Number(qStr);
    const r = Number(rStr);
    if (!Number.isFinite(q) || !Number.isFinite(r)) {
      return NextResponse.json({ error: 'q and r must be numbers' }, { status: 400 });
    }

    const [hex, entities, clock] = await Promise.all([
      getHex(q, r),
      listEntitiesAtHex(q, r),
      getGameClock(),
    ]);

    // Weather: hex.weather_override wins, otherwise the most recent storm
    // entity at this hex, otherwise 'clear'.
    let weather = 'clear';
    if (hex?.weather_override) {
      weather = hex.weather_override;
    } else {
      const storm = entities.find((e) => e.kind === 'storm');
      if (storm) weather = 'storm';
    }

    const dayNight: 'day' | 'night' = isNight(clock.game_time_seconds) ? 'night' : 'day';
    const gameTime = formatGameTime(clock.game_time_seconds);

    return NextResponse.json({ weather, dayNight, gameTime, q, r });
  } catch (err) {
    console.error('GET /api/world/hexes/[q]/[r]/environment', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
