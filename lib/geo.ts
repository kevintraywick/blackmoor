// Pure geography helpers — hoisted from app/ar/AREncounter.tsx so the
// Raven Post Overheard watcher and (eventually) the AR encounter share
// one source. Currently only the Raven Post side uses this — the AR
// encounter is parked at .tsx.disabled during the sprint and will be
// updated to import from here when it's restored.

/** Distance in meters between two lat/lng pairs (haversine). */
export function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Forward bearing in degrees (0 = N, 90 = E) from (lat1,lng1) toward (lat2,lng2). */
export function bearingDeg(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

const COMPASS_POINTS = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'] as const;

export function compassWord(deg: number): string {
  const idx = Math.round(deg / 45) % 8;
  return COMPASS_POINTS[idx];
}
