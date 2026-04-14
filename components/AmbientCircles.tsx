'use client';

import type { MoonPhase } from '@/lib/lunar';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface CelestialProps {
  kind: 'sun' | 'moon';
  altitudeDeg?: number;
  moonPhase?: MoonPhase;
  illumination?: number;
}

export type WindIntensity = 'calm' | 'breezy' | 'windy' | 'gale' | 'storm';

export interface WindProps {
  dirDeg: number;
  intensity: WindIntensity;
}

export interface CompassProps {
  bearingDeg: number;
  stationary: boolean;
}

interface Props {
  celestial: CelestialProps;
  wind: WindProps;
  compass: CompassProps;
  tempC?: number | null;
  size?: number;
}

// ── Wind intensity resolver ────────────────────────────────────────────────────

export function resolveWindIntensity(
  condition: string,
  windSpeedMph: number | null,
): WindIntensity {
  if (condition === 'storm' || condition === 'thunderstorm') return 'storm';
  if (condition === 'gale') return 'gale';
  const speed = windSpeedMph ?? 0;
  if (speed >= 30) return 'gale';
  if (speed >= 15) return 'windy';
  if (speed >= 5) return 'breezy';
  return 'calm';
}

// ── Keyframes ──────────────────────────────────────────────────────────────────

const KEYFRAMES = `
@keyframes ac-wind-calm {
  0%, 100% { transform: rotate(-2deg); }
  50% { transform: rotate(2deg); }
}
@keyframes ac-wind-breezy {
  0%, 100% { transform: rotate(-5deg); }
  50% { transform: rotate(5deg); }
}
@keyframes ac-wind-windy {
  0%, 100% { transform: rotate(-10deg); }
  50% { transform: rotate(10deg); }
}
@keyframes ac-wind-gale {
  0%, 100% { transform: rotate(-12deg); }
  50% { transform: rotate(12deg); }
}
@keyframes ac-wind-gust {
  0%, 80%, 100% { transform: rotate(0deg); }
  85% { transform: rotate(15deg); }
  90% { transform: rotate(-8deg); }
  95% { transform: rotate(10deg); }
}
@keyframes ac-wind-storm {
  0%, 100% { transform: rotate(-15deg); }
  25% { transform: rotate(12deg); }
  50% { transform: rotate(-15deg); }
  75% { transform: rotate(15deg); }
}
@keyframes ac-wind-shear {
  0%, 70%, 100% { transform: rotate(0deg); }
  75% { transform: rotate(30deg); }
  80% { transform: rotate(-20deg); }
  85% { transform: rotate(15deg); }
  90% { transform: rotate(0deg); }
}
@keyframes ac-sway {
  0%, 100% { transform: rotate(-2deg); }
  50% { transform: rotate(2deg); }
}
`;

const WIND_ANIMATIONS: Record<WindIntensity, string> = {
  calm: 'ac-wind-calm 4s ease-in-out infinite',
  breezy: 'ac-wind-breezy 2s ease-in-out infinite',
  windy: 'ac-wind-windy 1s ease-in-out infinite',
  gale: 'ac-wind-gale 0.6s ease-in-out infinite, ac-wind-gust 4s ease-in-out infinite',
  storm: 'ac-wind-storm 0.5s ease-in-out infinite, ac-wind-shear 3s ease-in-out infinite',
};

// ── Ring ───────────────────────────────────────────────────────────────────────

function CircleRing({ size, children }: { size: number; children: React.ReactNode }) {
  return (
    <div
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        border: '1.5px solid rgba(201,168,76,0.4)',
        background: 'rgba(26,22,20,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {children}
    </div>
  );
}

// ── Celestial ──────────────────────────────────────────────────────────────────

function CelestialCircle({ celestial, size }: { celestial: CelestialProps; size: number }) {
  const inner = size * 0.65;

  if (celestial.kind === 'sun') {
    const alt = celestial.altitudeDeg ?? 30;
    const normalizedAlt = Math.max(0, Math.min(90, alt)) / 90;
    const yOffset = (1 - normalizedAlt) * (size * 0.25);
    return (
      <CircleRing size={size}>
        <svg width={inner} height={inner} viewBox="0 0 40 40" style={{ marginTop: yOffset }}>
          <circle cx="20" cy="20" r="8" fill="#d4b44c" />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => {
            const rad = (angle * Math.PI) / 180;
            const x1 = 20 + Math.cos(rad) * 11;
            const y1 = 20 + Math.sin(rad) * 11;
            const x2 = 20 + Math.cos(rad) * 16;
            const y2 = 20 + Math.sin(rad) * 16;
            return (
              <line key={angle} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#d4b44c" strokeWidth="2" strokeLinecap="round" />
            );
          })}
        </svg>
      </CircleRing>
    );
  }

  const illum = celestial.illumination ?? 0.5;
  const shadowOffset = (1 - illum) * 16;
  const phase = celestial.moonPhase ?? 'full_moon';
  const isWaning = phase.startsWith('waning') || phase === 'last_quarter';

  return (
    <CircleRing size={size}>
      <svg width={inner} height={inner} viewBox="0 0 40 40">
        <defs>
          <clipPath id="moon-clip">
            <circle cx="20" cy="20" r="13" />
          </clipPath>
        </defs>
        <circle cx="20" cy="20" r="13" fill="#e0d8b8" />
        {phase !== 'full_moon' && (
          <circle
            cx={isWaning ? 20 + shadowOffset : 20 - shadowOffset}
            cy="20"
            r={13}
            fill="rgba(26,22,20,0.85)"
            clipPath="url(#moon-clip)"
          />
        )}
      </svg>
    </CircleRing>
  );
}

// ── Wind ───────────────────────────────────────────────────────────────────────

function WindCircle({ wind, size }: { wind: WindProps; size: number }) {
  const inner = size * 0.65;
  return (
    <CircleRing size={size}>
      {/* Outer: rotates to wind direction */}
      <div style={{ transform: `rotate(${wind.dirDeg}deg)`, width: inner, height: inner, position: 'absolute' }}>
        {/* Inner: sways per intensity */}
        <div style={{ animation: WIND_ANIMATIONS[wind.intensity], width: '100%', height: '100%' }}>
          <svg width={inner} height={inner} viewBox="0 0 40 40">
            {/* Arrow pointing up (0° = north in the rotated frame) */}
            <line x1="20" y1="8" x2="20" y2="34" stroke="#7a8a9a" strokeWidth="2" />
            <polygon points="20,2 14,14 26,14" fill="#90c8e0" stroke="none" />
            <circle cx="20" cy="20" r="3" fill="#7a8a9a" />
          </svg>
        </div>
      </div>
    </CircleRing>
  );
}

// ── Compass ────────────────────────────────────────────────────────────────────

function CompassCircle({ compass, size }: { compass: CompassProps; size: number }) {
  const inner = size * 0.65;
  return (
    <CircleRing size={size}>
      {/* Cardinal markers */}
      <svg
        width={inner}
        height={inner}
        viewBox="0 0 40 40"
        style={{ position: 'absolute' }}
      >
        <text x="20" y="8" textAnchor="middle" fill="#d4b44c" fontSize="7" fontFamily="sans-serif" fontWeight="bold">N</text>
        <text x="20" y="38" textAnchor="middle" fill="#7a6a5a" fontSize="5" fontFamily="sans-serif">S</text>
        <text x="36" y="23" textAnchor="middle" fill="#7a6a5a" fontSize="5" fontFamily="sans-serif">E</text>
        <text x="4" y="23" textAnchor="middle" fill="#7a6a5a" fontSize="5" fontFamily="sans-serif">W</text>
      </svg>
      {/* Needle */}
      <div
        style={{
          transform: `rotate(${compass.bearingDeg}deg)`,
          transition: 'transform 1.2s cubic-bezier(0.22, 1, 0.36, 1)',
          width: inner,
          height: inner,
          position: 'absolute',
        }}
      >
        <div style={{ animation: compass.stationary ? 'ac-sway 5s ease-in-out infinite' : 'none', width: '100%', height: '100%' }}>
          <svg width={inner} height={inner} viewBox="0 0 40 40">
            <polygon points="20,1 16,20 24,20" fill="#d04040" />
            <polygon points="20,39 16,20 24,20" fill="#7a6a5a" />
            <circle cx="20" cy="20" r="3" fill="#7a6a5a" stroke="#d4b44c" strokeWidth="1" />
          </svg>
        </div>
      </div>
    </CircleRing>
  );
}

// ── Temperature ───────────────────────────────────────────────────────────────
// Visual temperature: icicles (cold) → nothing (mild) → heat shimmer (warm) → flames (hot)
// Ranges (Celsius): ≤0 freezing, 1-10 cold, 11-20 mild, 21-30 warm, 31+ hot

type TempBand = 'freezing' | 'cold' | 'mild' | 'warm' | 'hot';

function getTempBand(c: number): TempBand {
  if (c <= 0) return 'freezing';
  if (c <= 10) return 'cold';
  if (c <= 20) return 'mild';
  if (c <= 30) return 'warm';
  return 'hot';
}

function TempCircle({ tempC, size }: { tempC: number; size: number }) {
  const band = getTempBand(tempC);
  const inner = size * 0.65;

  return (
    <CircleRing size={size}>
      <svg width={inner} height={inner} viewBox="0 0 40 40">
        {band === 'freezing' && (
          <>
            {/* Icicle cluster — bold */}
            <path d="M10 6 L12 24 L8 24 Z" fill="rgba(160,220,255,0.9)" />
            <path d="M17 3 L19.5 27 L14.5 27 Z" fill="rgba(180,230,255,1)" />
            <path d="M24 5 L26 23 L22 23 Z" fill="rgba(160,220,255,0.85)" />
            <path d="M30 8 L32 20 L28 20 Z" fill="rgba(140,210,255,0.8)" />
            {/* Frost sparkle */}
            <circle cx="20" cy="33" r="2.5" fill="rgba(200,235,255,0.8)" />
            <circle cx="12" cy="30" r="1.5" fill="rgba(200,235,255,0.6)" />
            <circle cx="28" cy="31" r="1.5" fill="rgba(200,235,255,0.7)" />
          </>
        )}
        {band === 'cold' && (
          <>
            {/* Frost crystals — bold */}
            <path d="M20 6 v12 M14 12 h12 M15 7 l10 10 M25 7 l-10 10" stroke="rgba(160,210,255,0.9)" strokeWidth="1.5" fill="none" />
            <path d="M10 24 v8 M7 28 h6" stroke="rgba(160,210,255,0.7)" strokeWidth="1.2" fill="none" />
            <path d="M30 22 v8 M27 26 h6" stroke="rgba(160,210,255,0.7)" strokeWidth="1.2" fill="none" />
            <circle cx="20" cy="32" r="2" fill="rgba(180,220,255,0.6)" />
          </>
        )}
        {band === 'mild' && (
          <>
            {/* Gentle breeze lines — bolder */}
            <path d="M8 14 Q16 10 24 14 Q30 18 34 14" stroke="rgba(200,190,160,0.7)" strokeWidth="1.5" fill="none" />
            <path d="M6 22 Q14 18 22 22 Q28 26 36 22" stroke="rgba(200,190,160,0.6)" strokeWidth="1.5" fill="none" />
            <path d="M8 30 Q16 26 24 30 Q30 34 34 30" stroke="rgba(200,190,160,0.5)" strokeWidth="1.5" fill="none" />
          </>
        )}
        {band === 'warm' && (
          <>
            {/* Heat shimmer waves — bolder */}
            <path d="M8 12 Q14 6 20 12 Q26 18 32 12" stroke="rgba(240,200,80,0.75)" strokeWidth="1.8" fill="none" />
            <path d="M6 20 Q13 14 20 20 Q27 26 34 20" stroke="rgba(240,180,60,0.7)" strokeWidth="1.8" fill="none" />
            <path d="M8 28 Q14 22 20 28 Q26 34 32 28" stroke="rgba(220,160,40,0.65)" strokeWidth="1.8" fill="none" />
          </>
        )}
        {band === 'hot' && (
          <>
            {/* Flame licks — bolder */}
            <path d="M12 36 Q10 24 15 16 Q17 10 13 4 Q20 12 18 22 Q16 30 18 36 Z" fill="rgba(255,120,30,0.85)" />
            <path d="M19 36 Q16 26 20 18 Q23 10 19 2 Q28 10 24 22 Q21 30 23 36 Z" fill="rgba(255,80,20,0.9)" />
            <path d="M26 36 Q24 26 28 20 Q30 14 27 8 Q32 16 29 26 Q28 32 30 36 Z" fill="rgba(255,140,40,0.75)" />
            {/* Inner bright core */}
            <path d="M17 36 Q16 28 20 22 Q23 28 22 36 Z" fill="rgba(255,220,100,0.8)" />
          </>
        )}
      </svg>
    </CircleRing>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function AmbientCircles({ celestial, wind, compass, tempC, size = 52 }: Props) {
  return (
    <>
      <style>{KEYFRAMES}</style>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: size < 40 ? 4 : 6,
          pointerEvents: 'none',
        }}
      >
        <CelestialCircle celestial={celestial} size={size} />
        <WindCircle wind={wind} size={size} />
        <CompassCircle compass={compass} size={size} />
        {tempC != null && <TempCircle tempC={tempC} size={size} />}
      </div>
    </>
  );
}
