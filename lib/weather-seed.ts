import { query } from '@/lib/db';
import type { RavenWeatherRow } from '@/lib/types';

const STORM_CONDITIONS = new Set(['storm', 'thunderstorm', 'gale']);
const LAT = 36.34289;
const LNG = -88.85022;
const TIMEOUT_MS = 5000;

export async function seedSessionWeather(): Promise<void> {
  try {
    const rows = await query<RavenWeatherRow>(
      `SELECT condition, wind_dir_deg, wind_speed_mph FROM raven_weather WHERE hex_id = 'default'`,
    );
    const current = rows[0];
    if (current && STORM_CONDITIONS.has(current.condition)) return;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LNG}&current=wind_speed_10m,wind_direction_10m,temperature_2m`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (!res.ok) return;
    const data = await res.json();
    const c = data?.current;
    if (!c || typeof c.wind_direction_10m !== 'number' || typeof c.wind_speed_10m !== 'number') return;

    const rawDir = c.wind_direction_10m as number;
    const rawSpeedKmh = c.wind_speed_10m as number;
    const rawTempC = typeof c.temperature_2m === 'number' ? Math.round(c.temperature_2m) : null;

    const jitterDir = (Math.random() - 0.5) * 30;
    const jitterSpeed = (Math.random() - 0.5) * 6;

    const dir = Math.round(((rawDir + jitterDir) % 360 + 360) % 360);
    const speedMph = Math.max(0, Math.round(rawSpeedKmh * 0.621371 + jitterSpeed));

    await query(
      `UPDATE raven_weather SET wind_dir_deg = $1, wind_speed_mph = $2, temp_c = COALESCE(temp_c, $3), updated_at = now() WHERE hex_id = 'default'`,
      [dir, speedMph, rawTempC],
    );
  } catch {
    // silent degrade
  }
}
