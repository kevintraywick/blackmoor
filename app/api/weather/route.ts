import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import type { WeatherCondition } from '@/lib/types';

const VALID_CONDITIONS: WeatherCondition[] = [
  'clear', 'drizzle', 'light_rain', 'rain', 'heavy_rain', 'sleet', 'snow', 'hail',
  'windy', 'gale', 'calm',
  'fog', 'mist', 'haze',
  'overcast', 'hot', 'cold',
  'storm', 'thunderstorm', 'sandstorm',
  'dust', 'embers', 'fae', 'blood_moon', 'aurora',
];

// POST /api/weather — DM override (sets the 'default' row in v1)
// Body: { condition: WeatherCondition, temp_c?: number, wind_label?: string, hex_id?: string }
export async function POST(req: Request) {
  try {
    await ensureSchema();
    const body = await req.json();
    const { condition, temp_c, wind_label, hex_id } = body as Record<string, unknown>;

    if (typeof condition !== 'string' || !VALID_CONDITIONS.includes(condition as WeatherCondition)) {
      return NextResponse.json({ error: 'invalid condition' }, { status: 400 });
    }
    const id = typeof hex_id === 'string' && hex_id.length > 0 ? hex_id : 'default';
    const temp = typeof temp_c === 'number' ? Math.round(temp_c) : null;
    const wind = typeof wind_label === 'string' ? wind_label.slice(0, 40) : null;

    await query(
      `INSERT INTO raven_weather (hex_id, condition, temp_c, wind_label)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (hex_id) DO UPDATE SET
         condition = EXCLUDED.condition,
         temp_c = EXCLUDED.temp_c,
         wind_label = EXCLUDED.wind_label,
         updated_at = now()`,
      [id, condition, temp, wind],
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('POST /api/weather', err);
    return NextResponse.json({ error: 'weather update failed' }, { status: 500 });
  }
}
