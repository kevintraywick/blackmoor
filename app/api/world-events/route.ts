// Aggregates current natural-event data from two free, no-key sources:
//   - NASA EONET v3 (wildfires, severe storms, volcanoes, ice, etc.)
//   - USGS earthquakes feed (past week, mag ≥ 4.5)
// Normalized to { id, type, lat, lng, title }. Cached 30 min in process.
import { NextResponse } from 'next/server';

export interface EventMarker {
  id: string;
  type: string; // category key, e.g. "wildfires", "earthquake", "volcanoes"
  lat: number;
  lng: number;
  title: string;
}

const CACHE_TTL_MS = 30 * 60 * 1000;
const FETCH_TIMEOUT_MS = 15000;
let cached: { timestamp: number; data: EventMarker[] } | null = null;

interface EonetGeometry {
  type?: string;
  coordinates?: unknown;
}
interface EonetEvent {
  id?: string;
  title?: string;
  categories?: Array<{ title?: string }>;
  geometry?: EonetGeometry[];
}
interface UsgsFeature {
  id?: string;
  properties?: { title?: string; mag?: number };
  geometry?: { coordinates?: number[] };
}

function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
}

function pointFromGeometry(g: EonetGeometry | undefined): [number, number] | null {
  if (!g) return null;
  if (g.type === 'Point' && Array.isArray(g.coordinates) && g.coordinates.length >= 2) {
    const lng = g.coordinates[0];
    const lat = g.coordinates[1];
    if (typeof lat === 'number' && typeof lng === 'number') return [lat, lng];
  }
  if (g.type === 'Polygon' && Array.isArray(g.coordinates)) {
    const ring = (g.coordinates as unknown[])[0];
    if (Array.isArray(ring) && ring.length > 0) {
      const first = ring[0];
      if (Array.isArray(first) && first.length >= 2) {
        const lng = first[0];
        const lat = first[1];
        if (typeof lat === 'number' && typeof lng === 'number') return [lat, lng];
      }
    }
  }
  return null;
}

export async function GET() {
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return NextResponse.json({ events: cached.data, cached: true });
  }

  const events: EventMarker[] = [];

  try {
    const r = await fetchWithTimeout('https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=300');
    if (r.ok) {
      const data = await r.json() as { events?: EonetEvent[] };
      for (const e of data.events ?? []) {
        const cat = (e.categories?.[0]?.title ?? 'other').toLowerCase().replace(/\s+/g, '');
        const lastGeom = e.geometry?.[e.geometry.length - 1];
        const point = pointFromGeometry(lastGeom);
        if (point && e.id) {
          events.push({
            id: `eonet:${e.id}`,
            type: cat,
            lat: point[0],
            lng: point[1],
            title: e.title ?? cat,
          });
        }
      }
    } else {
      console.warn(`[world-events] EONET ${r.status}`);
    }
  } catch (err) {
    console.error('[world-events] EONET failed:', err);
  }

  try {
    const r = await fetchWithTimeout('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_week.geojson');
    if (r.ok) {
      const data = await r.json() as { features?: UsgsFeature[] };
      for (const f of data.features ?? []) {
        const coords = f.geometry?.coordinates;
        if (!Array.isArray(coords) || coords.length < 2) continue;
        const lng = coords[0];
        const lat = coords[1];
        if (typeof lat !== 'number' || typeof lng !== 'number') continue;
        events.push({
          id: `usgs:${f.id ?? `${lat}_${lng}`}`,
          type: 'earthquake',
          lat,
          lng,
          title: f.properties?.title ?? `M${f.properties?.mag ?? '?'}`,
        });
      }
    } else {
      console.warn(`[world-events] USGS ${r.status}`);
    }
  } catch (err) {
    console.error('[world-events] USGS failed:', err);
  }

  console.log(`[world-events] cached ${events.length} markers`);
  cached = { timestamp: Date.now(), data: events };
  return NextResponse.json({ events, cached: false });
}
