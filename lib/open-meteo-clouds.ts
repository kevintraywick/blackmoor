// Fetches current cloud-cover percentages from Open-Meteo for a list of
// hex centroids. Batched into small URL-safe chunks, fetched in parallel,
// cached in-process for 15 minutes so repeated page loads don't re-hit.
//
// Open-Meteo is already used for party-hex wind (lib/weather-seed.ts) —
// no API key, no auth, free, worldwide.

interface HexLoc {
  cell: string;
  lat: number;
  lng: number;
}

export interface CloudLayers {
  low: number;
  mid: number;
  high: number;
  total: number;
  precipMm: number;
}

const CACHE_TTL_MS = 15 * 60 * 1000;
// After Open-Meteo rate-limits us, skip further attempts for this long so
// every page load doesn't re-hit an API we know will 429.
const RATE_LIMIT_COOLDOWN_MS = 2 * 60 * 1000;
const BATCH_SIZE = 100;
const CONCURRENCY = 2;
const INTER_WAVE_DELAY_MS = 250;
const FETCH_TIMEOUT_MS = 20000;

interface Cache {
  timestamp: number;
  data: Map<string, CloudLayers>;
}
let cache: Cache | null = null;
let rateLimitedUntil = 0;

export async function fetchCloudCoverByCell(cells: HexLoc[]): Promise<Map<string, CloudLayers>> {
  if (cache && Date.now() - cache.timestamp < CACHE_TTL_MS) {
    if (cells.every(c => cache!.data.has(c.cell))) return cache.data;
  }
  if (Date.now() < rateLimitedUntil) {
    console.warn(`[open-meteo-clouds] rate-limited cooldown, returning cached/empty (${Math.ceil((rateLimitedUntil - Date.now())/1000)}s left)`);
    return cache?.data ?? new Map();
  }

  const chunks: HexLoc[][] = [];
  for (let i = 0; i < cells.length; i += BATCH_SIZE) chunks.push(cells.slice(i, i + BATCH_SIZE));

  const out = new Map<string, CloudLayers>();
  try {
    for (let waveStart = 0; waveStart < chunks.length; waveStart += CONCURRENCY) {
      if (waveStart > 0) await new Promise(r => setTimeout(r, INTER_WAVE_DELAY_MS));
      const wave = chunks.slice(waveStart, waveStart + CONCURRENCY);
      const waveResults = await Promise.all(wave.map(fetchChunk));
      waveResults.forEach((chunkLayers, wi) => {
        wave[wi].forEach((c, i) => {
          const layers = chunkLayers[i];
          if (layers) out.set(c.cell, layers);
        });
      });
    }
    cache = { timestamp: Date.now(), data: out };
  } catch (err) {
    console.error('[open-meteo-clouds] fetch failed:', err);
    if (err instanceof Error && err.message.includes('429')) {
      rateLimitedUntil = Date.now() + RATE_LIMIT_COOLDOWN_MS;
    }
  }
  return out;
}

async function fetchChunk(chunk: HexLoc[]): Promise<Array<CloudLayers | null>> {
  const lats = chunk.map(c => c.lat.toFixed(4)).join(',');
  const lngs = chunk.map(c => c.lng.toFixed(4)).join(',');
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lngs}&current=cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high,precipitation`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    console.log(`[open-meteo-clouds] GET ${chunk.length} locs (url len=${url.length})`);
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.warn(`[open-meteo-clouds] ${res.status} body: ${body.slice(0, 200)}`);
      throw new Error(`open-meteo ${res.status}`);
    }
    const data = await res.json();
    // Open-Meteo returns an array of location objects when given multiple
    // coords, a single object when given one.
    const entries: Array<{ current?: { cloud_cover?: number; cloud_cover_low?: number; cloud_cover_mid?: number; cloud_cover_high?: number; precipitation?: number } }> =
      Array.isArray(data) ? data : [data];
    return entries.map(e => {
      const c = e.current;
      if (!c) return null;
      return {
        low: typeof c.cloud_cover_low === 'number' ? c.cloud_cover_low : 0,
        mid: typeof c.cloud_cover_mid === 'number' ? c.cloud_cover_mid : 0,
        high: typeof c.cloud_cover_high === 'number' ? c.cloud_cover_high : 0,
        total: typeof c.cloud_cover === 'number' ? c.cloud_cover : 0,
        precipMm: typeof c.precipitation === 'number' ? c.precipitation : 0,
      };
    });
  } finally {
    clearTimeout(timer);
  }
}
