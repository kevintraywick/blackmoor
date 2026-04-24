/**
 * Launders real-world place and storm references out of any free-text string
 * that entered storage via an external feed (NOAA, Open-Meteo, SWPC, etc.).
 *
 * This must run at the ingest boundary — before the string lands in the DB —
 * not at render time. If "Hurricane Boston" reaches the cache once, it will
 * leak through some surface eventually.
 *
 * See docs/plans/2026-04-19-001-feat-ambience-v1-plan.md Unit 2 and
 * BRAINSTORM.md §9 for the "launder Earth's furniture, keep Earth's rules"
 * policy. R6 of the origin requirements doc.
 */

import {
  NOAA_PLACE_NAMES,
  NOAA_STATION_PREFIXES,
  NOAA_STORM_NAMES,
} from './raven-name-denylist';

const PLACE_PATTERN = buildWordBoundaryRegex(NOAA_PLACE_NAMES);
const STORM_PATTERN = buildWordBoundaryRegex(NOAA_STORM_NAMES);
// Matches tokens like "KATL", "EGLL", "EDDB" — 4-letter uppercase identifiers
// with a known prefix. Word-boundary anchored so it doesn't chew plain words.
const STATION_PATTERN = new RegExp(
  `\\b(${NOAA_STATION_PREFIXES.map(escapeRegex).join('|')})[A-Z0-9]{2,3}\\b`,
  'g',
);

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildWordBoundaryRegex(names: readonly string[]): RegExp {
  // Sort longest-first so "Great Britain" matches before "Britain"
  const sorted = [...names].sort((a, b) => b.length - a.length).map(escapeRegex);
  return new RegExp(`\\b(${sorted.join('|')})\\b`, 'gi');
}

/**
 * Replace every denylisted token in `s` with a generic tag.
 * - storm names → `[storm]`
 * - place names → `[place]`
 * - station IDs → `[station]`
 *
 * Idempotent. Safe to run multiple times.
 */
export function launderText(s: string): string {
  if (!s) return s;
  return s
    .replace(STORM_PATTERN, '[storm]')
    .replace(PLACE_PATTERN, '[place]')
    .replace(STATION_PATTERN, '[station]');
}

/**
 * Walk a JSON-ish object and launder every string leaf in place, returning a
 * new object. Preserves structure; non-string leaves pass through.
 */
export function launderDeep<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return launderText(value) as T;
  if (Array.isArray(value)) return value.map(launderDeep) as T;
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = launderDeep(v);
    }
    return out as T;
  }
  return value;
}
