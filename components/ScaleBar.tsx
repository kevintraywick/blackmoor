'use client';

import { PX_PER_FT } from '@/lib/map-scale';
import { kmToMi, pickRoundKmForBar } from '@/lib/screen-scale';

/**
 * Persistent canonical scale bar. Lives on every map surface so the user
 * never has to mentally convert px → real distance. Shows a horizontal bar
 * of a meaningful round length, labeled with primary and secondary units.
 *
 * Three usage modes:
 *  - mode="combat"   — fixed: 5 ft / 1.5 m at the canonical 60 px (PX_PER_FT × 5)
 *  - mode="overland" — fixed: 1 mi / 1.6 km at canonical width
 *  - mode="globe"    — dynamic: caller supplies kmPerPx (from the live camera)
 *                      and the bar picks a round 1/2/5×10ⁿ km length that fits
 *                      `targetWidthPx`.
 *
 * Visual register matches the "vivid" brand direction (CLAUDE.md): white
 * bar with crisp tick caps, soft shadow for legibility on any background.
 */

interface CombatProps {
  mode: 'combat';
  /** Override the canonical 60 px width if a surface needs a smaller bar. */
  targetWidthPx?: number;
}

interface OverlandProps {
  mode: 'overland';
  targetWidthPx?: number;
}

interface GlobeProps {
  mode: 'globe';
  /** Live km-per-screen-pixel from `kmPerScreenPxAtSurface`. */
  kmPerPx: number;
  /** Pixels we'd like the bar to be at most; shrinks to the picked round km. */
  targetWidthPx?: number;
}

type Props = CombatProps | OverlandProps | GlobeProps;

export default function ScaleBar(props: Props) {
  const targetWidthPx = props.targetWidthPx ?? 120;

  let widthPx: number;
  let primary: string;
  let secondary: string;

  if (props.mode === 'combat') {
    // Canonical: 5 ft = 60 px. Honor targetWidthPx by snapping to a
    // multiple of 5 ft that fits.
    const ftPerPx = 1 / PX_PER_FT;
    const targetFt = targetWidthPx * ftPerPx;
    const roundedFt = Math.max(5, Math.floor(targetFt / 5) * 5);
    widthPx = roundedFt * PX_PER_FT;
    primary = `${roundedFt} ft`;
    const meters = roundedFt * 0.3048;
    secondary = `${meters < 10 ? meters.toFixed(1) : Math.round(meters)} m`;
  } else if (props.mode === 'overland') {
    // Canonical overland: a hex covers 6 mi at PX_PER_FT × 5280 ft/mi
    // would be enormous — instead pick the largest round mile count that
    // fits the requested width at the same PX_PER_FT.
    const miPerPx = 1 / (PX_PER_FT * 5280);
    const targetMi = targetWidthPx * miPerPx;
    // 1-2-5 progression in miles, but never below 1 mi.
    const exponent = Math.floor(Math.log10(Math.max(targetMi, 1)));
    const base = Math.pow(10, exponent);
    const mantissa = targetMi / base;
    const choices = [1, 2, 5, 10];
    let chosen = choices[0];
    for (const c of choices) if (c <= mantissa) chosen = c;
    const mi = Math.max(1, chosen * base);
    widthPx = mi * PX_PER_FT * 5280;
    primary = `${mi} mi`;
    const km = mi * 1.609344;
    secondary = `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
  } else {
    const { km, widthPx: w } = pickRoundKmForBar({
      kmPerPx: props.kmPerPx,
      targetWidthPx,
    });
    widthPx = w;
    if (km >= 1) {
      primary = km >= 1000 ? `${(km / 1000).toLocaleString()} ×1000 km` : `${km.toLocaleString()} km`;
      const mi = kmToMi(km);
      secondary = `${mi < 10 ? mi.toFixed(1) : Math.round(mi).toLocaleString()} mi`;
    } else {
      const m = Math.round(km * 1000);
      primary = `${m} m`;
      const ft = Math.round(km * 1000 * 3.28084);
      secondary = `${ft.toLocaleString()} ft`;
    }
  }

  if (widthPx <= 0 || !isFinite(widthPx)) return null;

  return (
    <div
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 3,
        userSelect: 'none',
        pointerEvents: 'none',
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        textShadow: '0 1px 2px rgba(0,0,0,0.85), 0 0 4px rgba(0,0,0,0.6)',
      }}
      aria-label={`Scale: ${primary} (${secondary})`}
    >
      {/* The bar itself: thin white line with vertical end caps. */}
      <svg
        width={widthPx + 2}
        height={10}
        viewBox={`0 0 ${widthPx + 2} 10`}
        style={{ display: 'block', overflow: 'visible' }}
      >
        <line x1={1} y1={1} x2={1} y2={9} stroke="#ffffff" strokeWidth={1.5} />
        <line x1={widthPx + 1} y1={1} x2={widthPx + 1} y2={9} stroke="#ffffff" strokeWidth={1.5} />
        <line x1={1} y1={5} x2={widthPx + 1} y2={5} stroke="#ffffff" strokeWidth={1.5} />
      </svg>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, color: '#ffffff' }}>
        <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.04em' }}>{primary}</span>
        <span style={{ fontSize: 10, opacity: 0.75, letterSpacing: '0.04em' }}>{secondary}</span>
      </div>
    </div>
  );
}
