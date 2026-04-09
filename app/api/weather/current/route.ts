import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import type { RavenWeatherRow } from '@/lib/types';

// GET /api/weather/current?playerId=X
// v1: returns the 'default' hex weather. Future versions resolve playerId
// to a current world hex and look up the per-hex row.
export async function GET(_req: Request) {
  try {
    await ensureSchema();
    const rows = await query<RavenWeatherRow>(
      `SELECT * FROM raven_weather WHERE hex_id = 'default'`,
    );
    if (rows.length === 0) {
      return NextResponse.json({
        hex_id: 'default',
        condition: 'clear',
        temp_c: null,
        wind_label: null,
        updated_at: new Date().toISOString(),
      } as RavenWeatherRow);
    }
    return NextResponse.json(rows[0]);
  } catch (err) {
    console.error('GET /api/weather/current', err);
    return NextResponse.json({ error: 'weather query failed' }, { status: 500 });
  }
}
