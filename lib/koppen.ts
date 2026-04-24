/**
 * Köppen-Geiger climate classification from monthly temperature and
 * precipitation normals.
 *
 * Pure function — given 12 months of mean temperature (°C) and total
 * precipitation (mm), returns the Köppen zone code. Based on the classic
 * Köppen-Geiger decision tree (Kottek et al. 2006, Peel et al. 2007).
 *
 * We classify once at seed time and store the result. No runtime recomputation.
 */

import type { KoppenZone } from './types';

export interface MonthlyNormals {
  /** Mean temperature per month in °C, January=0 ... December=11. */
  temp_c: number[];
  /** Total precipitation per month in mm. */
  precip_mm: number[];
}

/** Determine if a climate is in the northern or southern hemisphere for season cycling. */
function summerMonths(isNorthern: boolean): number[] {
  return isNorthern ? [3, 4, 5, 6, 7, 8] : [9, 10, 11, 0, 1, 2];
}
function winterMonths(isNorthern: boolean): number[] {
  return isNorthern ? [9, 10, 11, 0, 1, 2] : [3, 4, 5, 6, 7, 8];
}

function mean(arr: number[]): number {
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

export function classifyKoppen(normals: MonthlyNormals, latitude: number): KoppenZone {
  const T = normals.temp_c;
  const P = normals.precip_mm;
  const isNorthern = latitude >= 0;

  const tMax = Math.max(...T);
  const tMin = Math.min(...T);
  const tAnn = mean(T);
  const pAnn = P.reduce((s, v) => s + v, 0);

  // Count months with mean ≥ 10°C and months with mean ≥ 0°C
  const monthsAbove10 = T.filter(t => t >= 10).length;
  const monthsAbove0 = T.filter(t => t >= 0).length;

  const summerMo = summerMonths(isNorthern);
  const winterMo = winterMonths(isNorthern);
  const pSummer = summerMo.reduce((s, m) => s + P[m], 0);
  const pWinter = winterMo.reduce((s, m) => s + P[m], 0);
  const pSummerMax = Math.max(...summerMo.map(m => P[m]));
  const pWinterMin = Math.min(...winterMo.map(m => P[m]));
  const pSummerMin = Math.min(...summerMo.map(m => P[m]));
  const pWinterMax = Math.max(...winterMo.map(m => P[m]));

  // ── E: Polar ────────────────────────────────────────────────────────────
  if (tMax < 10) {
    return tMax < 0 ? 'EF' : 'ET';
  }

  // ── B: Arid ─────────────────────────────────────────────────────────────
  // Dryness threshold. Summer precip ratio determines the offset:
  //   if pWinter > 70% of total → +0
  //   if pSummer > 70% of total → +280
  //   otherwise → +140
  // Threshold (mm/yr) = 20 × tAnn + offset
  let offset = 140;
  if (pWinter / pAnn > 0.7) offset = 0;
  else if (pSummer / pAnn > 0.7) offset = 280;
  const dryThreshold = 20 * tAnn + offset;

  if (pAnn < dryThreshold) {
    const isHot = tAnn >= 18;
    if (pAnn < 0.5 * dryThreshold) {
      // W (desert)
      return isHot ? 'BWh' : 'BWk';
    } else {
      // S (steppe)
      return isHot ? 'BSh' : 'BSk';
    }
  }

  // ── A: Tropical ─────────────────────────────────────────────────────────
  if (tMin >= 18) {
    const pMin = Math.min(...P);
    if (pMin >= 60) return 'Af';
    // Monsoon: annual precip ≥ 25*(100 - pMin_in_cm) using Peel
    // Simplified: Am if pMin_mm ≥ (100 - pAnn_cm/25)
    const threshold_mm = 100 - pAnn / 25;
    return pMin >= threshold_mm ? 'Am' : 'Aw';
  }

  // ── C: Temperate, D: Continental ────────────────────────────────────────
  // C: coldest month 0–18°C, hottest ≥ 10°C
  // D: coldest month < 0°C, hottest ≥ 10°C
  const isC = tMin >= -3 && tMin < 18 && tMax >= 10;
  const isD = tMin < -3 && tMax >= 10;

  if (!isC && !isD) {
    // Fallback — shouldn't happen if the rest of the tree is exhaustive
    return tMin >= 0 ? 'Cfb' : 'Dfb';
  }

  // Seasonality:
  //   s (dry summer): pSummerMin < 40 AND pSummerMin < pWinterMax/3
  //   w (dry winter): pWinterMin < pSummerMax/10
  //   f (no dry season)
  const isDrySummer = pSummerMin < 40 && pSummerMin < pWinterMax / 3;
  const isDryWinter = pWinterMin < pSummerMax / 10;

  let seasonChar: 'f' | 's' | 'w';
  if (isDrySummer) seasonChar = 's';
  else if (isDryWinter) seasonChar = 'w';
  else seasonChar = 'f';

  // Temperature sub-class:
  //   a (hot summer): tMax ≥ 22
  //   b (warm summer): tMax < 22 and monthsAbove10 ≥ 4
  //   c (cool summer): monthsAbove10 < 4
  //   d (very cold winter, D only): tMin < -38
  let tempChar: 'a' | 'b' | 'c' | 'd';
  if (isD && tMin < -38) tempChar = 'd';
  else if (tMax >= 22) tempChar = 'a';
  else if (monthsAbove10 >= 4) tempChar = 'b';
  else tempChar = 'c';

  const prefix = isC ? 'C' : 'D';
  return `${prefix}${seasonChar}${tempChar}` as KoppenZone;
}
