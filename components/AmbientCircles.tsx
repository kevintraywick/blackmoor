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
          <circle cx="20" cy="20" r="6" fill="#c9a84c" />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => {
            const rad = (angle * Math.PI) / 180;
            const x1 = 20 + Math.cos(rad) * 9;
            const y1 = 20 + Math.sin(rad) * 9;
            const x2 = 20 + Math.cos(rad) * 13;
            const y2 = 20 + Math.sin(rad) * 13;
            return (
              <line key={angle} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#c9a84c" strokeWidth="1.2" strokeLinecap="round" />
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
            <circle cx="20" cy="20" r="10" />
          </clipPath>
        </defs>
        <circle cx="20" cy="20" r="10" fill="#d4c9a8" />
        {phase !== 'full_moon' && (
          <circle
            cx={isWaning ? 20 + shadowOffset : 20 - shadowOffset}
            cy="20"
            r={phase === 'new_moon' ? 10 : 10}
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
            <line x1="20" y1="6" x2="20" y2="34" stroke="#5a6a7a" strokeWidth="1" />
            <polygon points="20,4 16,14 24,14" fill="#7aafc9" stroke="none" />
            <circle cx="20" cy="20" r="2" fill="#5a6a7a" />
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
        <text x="20" y="7" textAnchor="middle" fill="#c9a84c" fontSize="5" fontFamily="sans-serif" fontWeight="bold">N</text>
        <text x="20" y="38" textAnchor="middle" fill="#5a4f46" fontSize="4" fontFamily="sans-serif">S</text>
        <text x="36" y="22" textAnchor="middle" fill="#5a4f46" fontSize="4" fontFamily="sans-serif">E</text>
        <text x="4" y="22" textAnchor="middle" fill="#5a4f46" fontSize="4" fontFamily="sans-serif">W</text>
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
            <polygon points="20,1 17,20 23,20" fill="#c04040" />
            <polygon points="20,39 17,20 23,20" fill="#5a4f46" />
            <circle cx="20" cy="20" r="2.5" fill="#5a4f46" stroke="#c9a84c" strokeWidth="0.5" />
          </svg>
        </div>
      </div>
    </CircleRing>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function AmbientCircles({ celestial, wind, compass, size = 52 }: Props) {
  return (
    <>
      <style>{KEYFRAMES}</style>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: size < 40 ? 6 : 10,
          pointerEvents: 'none',
        }}
      >
        <CelestialCircle celestial={celestial} size={size} />
        <WindCircle wind={wind} size={size} />
        <CompassCircle compass={compass} size={size} />
      </div>
    </>
  );
}
