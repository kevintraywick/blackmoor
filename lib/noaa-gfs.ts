/**
 * NOAA GFS forecast fetcher.
 *
 * Pulls a 7-day (168h) hourly weather forecast for a given lat/lng via
 * Open-Meteo's `gfs_seamless` model endpoint. Open-Meteo is chosen over
 * direct NOAA NOMADS GRIB2 (heavy parsing) and over api.weather.gov
 * (US-only — doesn't cover the Common World anchor at Blaen Hafren, Wales).
 *
 * Open-Meteo is free, globally available, requires no API key, and wraps
 * GFS seamlessly. Rate limits are generous (10k requests/day, non-commercial).
 *
 * See docs/plans/2026-04-19-001-feat-ambience-v1-plan.md Unit 2.
 */

import type { ForecastHour } from './types';
import { canSpend, record } from './spend';
import { withRetry } from './retry';
import { launderDeep } from './raven-name-filter';

const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';
const FORECAST_HOURS = 168;
const TIMEOUT_MS = 20_000;

interface OpenMeteoResponse {
  hourly: {
    time: string[];
    temperature_2m: number[];
    relative_humidity_2m: number[];
    precipitation: number[];
    wind_speed_10m: number[];
    wind_direction_10m: number[];
    pressure_msl: number[];
    cloud_cover: number[];
  };
}

/**
 * Fetch a 168-hour forecast starting from now for the given coordinates.
 * Returns null on any failure path (bad env, budget paused, network, parse).
 */
export async function fetchForecast(lat: number, lng: number): Promise<ForecastHour[] | null> {
  if (!(await canSpend('noaa_gfs'))) return null;

  const params = new URLSearchParams({
    latitude: lat.toFixed(4),
    longitude: lng.toFixed(4),
    hourly: [
      'temperature_2m',
      'relative_humidity_2m',
      'precipitation',
      'wind_speed_10m',
      'wind_direction_10m',
      'pressure_msl',
      'cloud_cover',
    ].join(','),
    wind_speed_unit: 'mph',
    forecast_days: '7',
    models: 'gfs_seamless',
  });

  const url = `${OPEN_METEO_URL}?${params.toString()}`;

  try {
    const raw = await withRetry(async () => {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { 'User-Agent': 'Blackmoor/Ambience (kevintraywick@gmail.com)' },
      });
      if (!res.ok) throw new Error(`open-meteo ${res.status}`);
      return (await res.json()) as OpenMeteoResponse;
    });

    // Run the ingest name filter over the entire payload. Open-Meteo doesn't
    // include place/station names in the shape we query, but the filter is
    // defensive — if any name ever leaks in, it's caught here.
    const filtered = launderDeep(raw);
    const h = filtered.hourly;
    if (!h || !Array.isArray(h.time) || h.time.length < FORECAST_HOURS) {
      return null;
    }

    const forecast: ForecastHour[] = [];
    for (let i = 0; i < FORECAST_HOURS; i++) {
      // Validate every numeric field — any NaN triggers a silent abort
      const hour: ForecastHour = {
        offset_hours: i,
        temp_c: numberAt(h.temperature_2m, i),
        humidity_pct: numberAt(h.relative_humidity_2m, i),
        precip_mm: numberAt(h.precipitation, i),
        wind_mph: numberAt(h.wind_speed_10m, i),
        wind_deg: numberAt(h.wind_direction_10m, i),
        pressure_hpa: numberAt(h.pressure_msl, i),
        cloud_pct: numberAt(h.cloud_cover, i),
      };
      if (Object.values(hour).some((v) => typeof v !== 'number' || Number.isNaN(v))) return null;
      forecast.push(hour);
    }

    // Record spend (free API, but ledger visibility + kill-switch parity)
    await record({
      service: 'noaa_gfs',
      amount_usd: 0,
      units: 1,
      unit_kind: 'fetch',
      details: { lat, lng, hours: FORECAST_HOURS },
    });

    return forecast;
  } catch (err) {
    console.error('fetchForecast error:', err instanceof Error ? err.message : err);
    return null;
  }
}

function numberAt(arr: unknown[] | undefined, i: number): number {
  if (!Array.isArray(arr)) return NaN;
  const v = arr[i];
  return typeof v === 'number' ? v : NaN;
}
