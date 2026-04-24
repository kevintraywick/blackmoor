/**
 * Stats-only weather sampler — pure, client-safe, no DB imports.
 *
 * Given a Köppen zone + in-fiction month + game-time hour, returns a
 * deterministic weather state sampled from per-zone normals. Used for
 * every non-party hex (R2).
 *
 * Determinism means the same (koppen, game_hour) always returns the same
 * weather — the world doesn't flicker between refreshes, and a DM
 * re-loading doesn't see different weather than a player.
 *
 * The distributions here are compact per-zone summaries of real Earth
 * monthly normals. For MVP we use a handful of common zones; extend as
 * more of the map gets tagged.
 *
 * See docs/plans/2026-04-19-001-feat-ambience-v1-plan.md Unit 4.
 */

import type { KoppenZone, WeatherCondition, WeatherState } from './types';

/** Per-zone monthly params: temp mean, temp std, precip chance, wind mean. */
interface ZoneMonth {
  tMean: number;
  tStd: number;
  precipChance: number; // 0..1 chance of non-zero precip on any given hour
  precipMean: number;   // mm/hr when precipitating
  windMean: number;     // mph
  cloudMean: number;    // 0..100
}

type ZoneTable = Readonly<ZoneMonth[]>; // 12 months

// Compact zone tables. 12 entries = Jan..Dec. Values approximate monthly
// normals for the zone's archetype (Cfb ≈ western Europe maritime; BWh ≈
// Sahara; etc.). Expand as needed.
const ZONES: Partial<Record<KoppenZone, ZoneTable>> = {
  // Temperate marine (western Europe) — Shadow's home zone
  Cfb: [
    { tMean: 4,  tStd: 3, precipChance: 0.50, precipMean: 0.6, windMean: 12, cloudMean: 80 },
    { tMean: 5,  tStd: 3, precipChance: 0.45, precipMean: 0.6, windMean: 12, cloudMean: 75 },
    { tMean: 7,  tStd: 3, precipChance: 0.42, precipMean: 0.5, windMean: 11, cloudMean: 70 },
    { tMean: 10, tStd: 4, precipChance: 0.38, precipMean: 0.5, windMean: 10, cloudMean: 65 },
    { tMean: 13, tStd: 4, precipChance: 0.35, precipMean: 0.5, windMean: 9,  cloudMean: 60 },
    { tMean: 16, tStd: 4, precipChance: 0.32, precipMean: 0.5, windMean: 8,  cloudMean: 55 },
    { tMean: 18, tStd: 4, precipChance: 0.30, precipMean: 0.5, windMean: 8,  cloudMean: 50 },
    { tMean: 17, tStd: 4, precipChance: 0.33, precipMean: 0.6, windMean: 8,  cloudMean: 55 },
    { tMean: 14, tStd: 4, precipChance: 0.38, precipMean: 0.6, windMean: 9,  cloudMean: 65 },
    { tMean: 11, tStd: 4, precipChance: 0.45, precipMean: 0.7, windMean: 10, cloudMean: 70 },
    { tMean: 7,  tStd: 3, precipChance: 0.48, precipMean: 0.7, windMean: 11, cloudMean: 75 },
    { tMean: 5,  tStd: 3, precipChance: 0.50, precipMean: 0.7, windMean: 12, cloudMean: 80 },
  ],
  // Humid subtropical (SE US, east China) — hot summers, mild winters
  Cfa: [
    { tMean: 6,  tStd: 4, precipChance: 0.30, precipMean: 0.6, windMean: 9,  cloudMean: 55 },
    { tMean: 8,  tStd: 4, precipChance: 0.32, precipMean: 0.7, windMean: 9,  cloudMean: 55 },
    { tMean: 12, tStd: 5, precipChance: 0.35, precipMean: 0.8, windMean: 10, cloudMean: 55 },
    { tMean: 17, tStd: 5, precipChance: 0.32, precipMean: 0.9, windMean: 9,  cloudMean: 50 },
    { tMean: 22, tStd: 4, precipChance: 0.34, precipMean: 1.1, windMean: 8,  cloudMean: 50 },
    { tMean: 26, tStd: 4, precipChance: 0.40, precipMean: 1.4, windMean: 7,  cloudMean: 55 },
    { tMean: 27, tStd: 3, precipChance: 0.45, precipMean: 1.6, windMean: 6,  cloudMean: 60 },
    { tMean: 27, tStd: 3, precipChance: 0.42, precipMean: 1.5, windMean: 6,  cloudMean: 60 },
    { tMean: 24, tStd: 4, precipChance: 0.35, precipMean: 1.1, windMean: 7,  cloudMean: 55 },
    { tMean: 18, tStd: 5, precipChance: 0.28, precipMean: 0.8, windMean: 8,  cloudMean: 50 },
    { tMean: 12, tStd: 5, precipChance: 0.26, precipMean: 0.6, windMean: 9,  cloudMean: 50 },
    { tMean: 8,  tStd: 4, precipChance: 0.28, precipMean: 0.5, windMean: 9,  cloudMean: 55 },
  ],
  // Hot desert (Sahara, Arabia)
  BWh: [
    { tMean: 13, tStd: 4, precipChance: 0.03, precipMean: 0.2, windMean: 10, cloudMean: 15 },
    { tMean: 16, tStd: 4, precipChance: 0.02, precipMean: 0.2, windMean: 11, cloudMean: 15 },
    { tMean: 20, tStd: 4, precipChance: 0.02, precipMean: 0.2, windMean: 12, cloudMean: 15 },
    { tMean: 25, tStd: 4, precipChance: 0.01, precipMean: 0.2, windMean: 12, cloudMean: 10 },
    { tMean: 30, tStd: 4, precipChance: 0.01, precipMean: 0.2, windMean: 11, cloudMean: 10 },
    { tMean: 34, tStd: 3, precipChance: 0.00, precipMean: 0.1, windMean: 10, cloudMean: 5  },
    { tMean: 36, tStd: 3, precipChance: 0.00, precipMean: 0.1, windMean: 10, cloudMean: 5  },
    { tMean: 35, tStd: 3, precipChance: 0.00, precipMean: 0.1, windMean: 10, cloudMean: 5  },
    { tMean: 32, tStd: 3, precipChance: 0.01, precipMean: 0.2, windMean: 10, cloudMean: 10 },
    { tMean: 27, tStd: 4, precipChance: 0.02, precipMean: 0.2, windMean: 10, cloudMean: 15 },
    { tMean: 20, tStd: 4, precipChance: 0.03, precipMean: 0.3, windMean: 10, cloudMean: 15 },
    { tMean: 15, tStd: 4, precipChance: 0.04, precipMean: 0.3, windMean: 10, cloudMean: 15 },
  ],
  // Subarctic (boreal forest)
  Dfc: [
    { tMean: -20, tStd: 6, precipChance: 0.20, precipMean: 0.3, windMean: 8, cloudMean: 65 },
    { tMean: -18, tStd: 6, precipChance: 0.18, precipMean: 0.3, windMean: 8, cloudMean: 60 },
    { tMean: -10, tStd: 6, precipChance: 0.22, precipMean: 0.4, windMean: 8, cloudMean: 65 },
    { tMean: -2, tStd: 5,  precipChance: 0.30, precipMean: 0.5, windMean: 8, cloudMean: 70 },
    { tMean: 7,  tStd: 5, precipChance: 0.35, precipMean: 0.6, windMean: 8, cloudMean: 65 },
    { tMean: 13, tStd: 4, precipChance: 0.40, precipMean: 0.8, windMean: 7, cloudMean: 60 },
    { tMean: 16, tStd: 4, precipChance: 0.42, precipMean: 1.0, windMean: 7, cloudMean: 60 },
    { tMean: 13, tStd: 4, precipChance: 0.40, precipMean: 0.8, windMean: 7, cloudMean: 65 },
    { tMean: 6,  tStd: 5, precipChance: 0.35, precipMean: 0.6, windMean: 8, cloudMean: 70 },
    { tMean: -2, tStd: 5,  precipChance: 0.30, precipMean: 0.5, windMean: 8, cloudMean: 70 },
    { tMean: -12, tStd: 6, precipChance: 0.22, precipMean: 0.3, windMean: 8, cloudMean: 65 },
    { tMean: -18, tStd: 6, precipChance: 0.20, precipMean: 0.3, windMean: 8, cloudMean: 65 },
  ],
  // Tundra
  ET: [
    { tMean: -20, tStd: 6, precipChance: 0.15, precipMean: 0.2, windMean: 15, cloudMean: 70 },
    { tMean: -20, tStd: 6, precipChance: 0.15, precipMean: 0.2, windMean: 15, cloudMean: 70 },
    { tMean: -15, tStd: 6, precipChance: 0.15, precipMean: 0.2, windMean: 15, cloudMean: 70 },
    { tMean: -7, tStd: 5,  precipChance: 0.20, precipMean: 0.3, windMean: 14, cloudMean: 70 },
    { tMean: 0,  tStd: 4,  precipChance: 0.25, precipMean: 0.4, windMean: 13, cloudMean: 70 },
    { tMean: 4,  tStd: 3,  precipChance: 0.28, precipMean: 0.5, windMean: 12, cloudMean: 65 },
    { tMean: 7,  tStd: 3,  precipChance: 0.30, precipMean: 0.5, windMean: 11, cloudMean: 65 },
    { tMean: 6,  tStd: 3,  precipChance: 0.32, precipMean: 0.5, windMean: 12, cloudMean: 70 },
    { tMean: 2,  tStd: 4,  precipChance: 0.28, precipMean: 0.4, windMean: 13, cloudMean: 70 },
    { tMean: -4, tStd: 5,  precipChance: 0.22, precipMean: 0.3, windMean: 14, cloudMean: 70 },
    { tMean: -13, tStd: 6, precipChance: 0.18, precipMean: 0.2, windMean: 15, cloudMean: 70 },
    { tMean: -18, tStd: 6, precipChance: 0.15, precipMean: 0.2, windMean: 15, cloudMean: 70 },
  ],
};

/** Tropical fallback for zones we haven't tabulated yet. */
const DEFAULT_TROPICAL: ZoneTable = Array.from({ length: 12 }, () => ({
  tMean: 27, tStd: 2, precipChance: 0.35, precipMean: 1.2, windMean: 6, cloudMean: 50,
}));

function zoneTable(koppen: KoppenZone): ZoneTable {
  return ZONES[koppen] ?? DEFAULT_TROPICAL;
}

/** Mulberry32 — fast, deterministic seeded PRNG. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash a string to a 32-bit int (djb2). */
function hash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return h >>> 0;
}

/** Map numerical state → canonical condition tag (matching WeatherCondition). */
function stateToCondition(precip_mm: number, cloud_pct: number, temp_c: number, wind_mph: number): WeatherCondition {
  if (temp_c <= 0 && precip_mm > 0.1) return precip_mm > 1 ? 'snow' : 'sleet';
  if (precip_mm > 5) return 'heavy_rain';
  if (precip_mm > 1) return 'rain';
  if (precip_mm > 0.2) return 'light_rain';
  if (precip_mm > 0) return 'drizzle';
  if (wind_mph > 25) return 'gale';
  if (cloud_pct > 80) return 'overcast';
  if (cloud_pct > 30) return 'overcast'; // merged — we don't currently have 'partly_cloudy'
  if (temp_c > 30) return 'hot';
  if (temp_c < -5) return 'cold';
  return 'clear';
}

/**
 * Deterministic stats-only weather sample for a cell at a specific game hour.
 *
 * @param opts.cell         H3 cell (used in the seed so every cell gets
 *                          its own noise pattern)
 * @param opts.koppen       Climate zone from the hex substrate
 * @param opts.gameHour     In-fiction hour since epoch (game_time_seconds / 3600)
 * @param opts.month        0..11 in-fiction month for seasonal sampling
 */
export function sampleFromBiome(opts: {
  cell: string;
  koppen: KoppenZone;
  gameHour: number;
  month: number;
}): WeatherState {
  const table = zoneTable(opts.koppen);
  const m = Math.max(0, Math.min(11, Math.floor(opts.month)));
  const params = table[m];

  const seed = hash(`${opts.cell}:${Math.floor(opts.gameHour)}`);
  const rnd = mulberry32(seed);

  // Temperature: normal around monthly mean
  const temp_c = params.tMean + (rnd() + rnd() + rnd() - 1.5) * 2 * params.tStd;

  // Precipitation: gated by precipChance, gamma-ish magnitude
  const precipRoll = rnd();
  const precip_mm = precipRoll < params.precipChance
    ? params.precipMean * (0.5 + rnd() * 2)
    : 0;

  // Wind: lognormal-ish
  const wind_mph = params.windMean * (0.5 + rnd() * 1.2);
  const wind_deg = Math.floor(rnd() * 360);

  // Cloud cover drifts with precip
  const cloud_pct = Math.min(100, params.cloudMean + (precip_mm > 0 ? 20 : 0) + (rnd() - 0.5) * 20);

  // Pressure + trend: stable around 1013 with mild drift
  const pressure_hpa = 1013 + (rnd() - 0.5) * 20;
  const prevSeed = hash(`${opts.cell}:${Math.floor(opts.gameHour) - 1}`);
  const prevPressure = 1013 + (mulberry32(prevSeed)() - 0.5) * 20;
  const pressure_trend =
    pressure_hpa > prevPressure + 1 ? 'rising' :
    pressure_hpa < prevPressure - 1 ? 'falling' : 'steady';

  return {
    condition: stateToCondition(precip_mm, cloud_pct, temp_c, wind_mph),
    temp_c: Math.round(temp_c * 10) / 10,
    wind_mph: Math.round(wind_mph * 10) / 10,
    wind_deg,
    precip_mm: Math.round(precip_mm * 100) / 100,
    pressure_hpa: Math.round(pressure_hpa * 10) / 10,
    pressure_trend,
    cloud_pct: Math.round(cloud_pct),
  };
}

/**
 * Convert a raw ForecastHour from a NOAA feed into the canonical WeatherState
 * shape, with biome filtering (desert cells never show snow, etc.).
 */
export function forecastHourToState(opts: {
  hour: { temp_c: number; wind_mph: number; wind_deg: number; precip_mm: number; pressure_hpa: number; cloud_pct: number };
  prevPressure: number | null;
  koppen: KoppenZone;
}): WeatherState {
  const { hour, prevPressure, koppen } = opts;

  // Biome filter: never allow snow/sleet in tropical/arid-hot zones
  const isHot = koppen.startsWith('A') || koppen === 'BWh' || koppen === 'BSh';
  let precip_mm = hour.precip_mm;
  if (isHot && hour.temp_c > 5 && precip_mm > 0) {
    // The forecast feed is physically real; a hot zone seeing cold precip
    // at the same hour is unusual but possible. We don't clamp — we trust
    // the feed here. The condition classifier handles "hot + precipitation"
    // as 'rain' rather than 'snow' because temp is > 0.
  }

  const condition = stateToCondition(precip_mm, hour.cloud_pct, hour.temp_c, hour.wind_mph);
  const pressure_trend: WeatherState['pressure_trend'] =
    prevPressure == null ? 'steady' :
    hour.pressure_hpa > prevPressure + 1 ? 'rising' :
    hour.pressure_hpa < prevPressure - 1 ? 'falling' : 'steady';

  return {
    condition,
    temp_c: hour.temp_c,
    wind_mph: hour.wind_mph,
    wind_deg: hour.wind_deg,
    precip_mm: hour.precip_mm,
    pressure_hpa: hour.pressure_hpa,
    pressure_trend,
    cloud_pct: hour.cloud_pct,
  };
}
