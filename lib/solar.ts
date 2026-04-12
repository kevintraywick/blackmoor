// Solar position calculation — pure math, no dependencies.
// Simplified NOAA algorithm, accurate to ~1° for dates 2000–2099.
// Good enough for in-fiction "is it day or night" and sun altitude on the arc.

export const SHADOW_ANCHOR_LAT = 36.34289;
export const SHADOW_ANCHOR_LNG = -88.85022;

export interface SolarPosition {
  altitudeDeg: number;
  azimuthDeg: number;
  isDay: boolean;
}

function toRad(d: number) { return (d * Math.PI) / 180; }
function toDeg(r: number) { return (r * 180) / Math.PI; }

export function getSolarPosition(
  date: Date = new Date(),
  lat: number = SHADOW_ANCHOR_LAT,
  lng: number = SHADOW_ANCHOR_LNG,
): SolarPosition {
  const jd = date.getTime() / 86400000 + 2440587.5;
  const n = jd - 2451545.0;
  const L = (280.46 + 0.9856474 * n) % 360;
  const g = toRad((357.528 + 0.9856003 * n) % 360);
  const eclipticLng = toRad(L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g));
  const obliquity = toRad(23.439 - 0.0000004 * n);

  const sinDec = Math.sin(obliquity) * Math.sin(eclipticLng);
  const dec = Math.asin(sinDec);
  const cosDec = Math.cos(dec);

  const eqTime = (L - toDeg(Math.atan2(Math.cos(obliquity) * Math.sin(eclipticLng), Math.cos(eclipticLng)))) * 4;
  const utcMinutes = date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60;
  const solarTime = utcMinutes + eqTime + 4 * lng;
  const ha = toRad((solarTime / 4) - 180);

  const latRad = toRad(lat);
  const sinAlt = Math.sin(latRad) * Math.sin(dec) + Math.cos(latRad) * cosDec * Math.cos(ha);
  const altitude = Math.asin(Math.max(-1, Math.min(1, sinAlt)));

  const cosAz = (Math.sin(dec) - Math.sin(altitude) * Math.sin(latRad)) / (Math.cos(altitude) * Math.cos(latRad));
  let azimuth = Math.acos(Math.max(-1, Math.min(1, cosAz)));
  if (ha > 0) azimuth = 2 * Math.PI - azimuth;

  const altDeg = toDeg(altitude);
  return {
    altitudeDeg: Math.round(altDeg * 100) / 100,
    azimuthDeg: Math.round(toDeg(azimuth) * 100) / 100,
    isDay: altDeg > 0,
  };
}
