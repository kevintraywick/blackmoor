'use client';

import { useState, useEffect, useMemo } from 'react';
import type { RavenWeatherRow, WeatherCondition } from '@/lib/types';
import RavenWeatherPill from './RavenWeatherPill';

// ── Two-layer weather overlay system ─────────────────────────────────────────
// Layer 1: CSS gradient/tint atmosphere (mood, lighting, visibility)
// Layer 2: SVG sprite particles (rain, snow, leaves, embers, etc.)
// Both layers stack over the player banner with pointer-events: none.

// ── Keyframes ────────────────────────────────────────────────────────────────

const KEYFRAMES = `
@keyframes wx-fall { 0% { transform: translateY(-60px); } 100% { transform: translateY(280px); } }
@keyframes wx-fall-fast { 0% { transform: translateY(-60px); } 100% { transform: translateY(280px); } }
@keyframes wx-fall-diagonal { 0% { transform: translate(-30px,-60px); } 100% { transform: translate(40px,280px); } }
@keyframes wx-drift-down { 0% { transform: translateY(-40px) translateX(0) rotate(0deg); } 100% { transform: translateY(260px) translateX(30px) rotate(180deg); } }
@keyframes wx-drift-right { 0% { transform: translateX(-80px) translateY(0) rotate(0deg); } 100% { transform: translateX(calc(100vw + 80px)) translateY(20px) rotate(360deg); } }
@keyframes wx-rise { 0% { transform: translateY(0) scale(1); opacity: 0.8; } 100% { transform: translateY(-200px) scale(0.3); opacity: 0; } }
@keyframes wx-float { 0% { transform: translateY(0) translateX(0); } 50% { transform: translateY(-8px) translateX(5px); } 100% { transform: translateY(0) translateX(0); } }
@keyframes wx-shimmer { 0%, 100% { opacity: 0.15; } 50% { opacity: 0.4; } }
@keyframes wx-flicker { 0%, 93%, 100% { opacity: 0; } 94%, 97% { opacity: 0.7; } }
@keyframes wx-pulse-glow { 0%, 100% { opacity: 0.2; } 50% { opacity: 0.5; } }
@keyframes wx-aurora { 0% { transform: translateX(-20%); opacity: 0.3; } 50% { transform: translateX(10%); opacity: 0.5; } 100% { transform: translateX(-20%); opacity: 0.3; } }
`;

// ── SVG Sprites ──────────────────────────────────────────────────────────────
// Inline SVG data URIs for particle shapes. Small, simple, fast to render.

const SPRITES = {
  raindrop: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='4' height='16'%3E%3Cline x1='2' y1='0' x2='2' y2='16' stroke='rgba(160,200,255,0.5)' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")`,
  raindropHeavy: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='4' height='20'%3E%3Cline x1='2' y1='0' x2='2' y2='20' stroke='rgba(160,200,255,0.7)' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E")`,
  snowflake: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8'%3E%3Ccircle cx='4' cy='4' r='2.5' fill='rgba(255,255,255,0.85)'/%3E%3C/svg%3E")`,
  snowflakeLarge: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12'%3E%3Cpath d='M6 1v10M1 6h10M3 3l6 6M9 3l-6 6' stroke='rgba(255,255,255,0.7)' stroke-width='0.8' fill='none'/%3E%3C/svg%3E")`,
  leaf: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='10'%3E%3Cpath d='M1 8Q7 -2 13 5Q7 12 1 8Z' fill='rgba(160,100,30,0.7)'/%3E%3Cpath d='M3 7Q7 2 11 5' stroke='rgba(120,70,20,0.5)' stroke-width='0.5' fill='none'/%3E%3C/svg%3E")`,
  leafGreen: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='10'%3E%3Cpath d='M1 8Q7 -2 13 5Q7 12 1 8Z' fill='rgba(80,140,60,0.6)'/%3E%3Cpath d='M3 7Q7 2 11 5' stroke='rgba(50,100,40,0.4)' stroke-width='0.5' fill='none'/%3E%3C/svg%3E")`,
  dandelion: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12'%3E%3Ccircle cx='6' cy='6' r='2' fill='rgba(255,255,240,0.6)'/%3E%3Cline x1='6' y1='1' x2='6' y2='4' stroke='rgba(255,255,240,0.4)' stroke-width='0.5'/%3E%3Cline x1='2' y1='3' x2='4.5' y2='5' stroke='rgba(255,255,240,0.4)' stroke-width='0.5'/%3E%3Cline x1='10' y1='3' x2='7.5' y2='5' stroke='rgba(255,255,240,0.4)' stroke-width='0.5'/%3E%3Cline x1='1' y1='7' x2='4' y2='6' stroke='rgba(255,255,240,0.4)' stroke-width='0.5'/%3E%3Cline x1='11' y1='7' x2='8' y2='6' stroke='rgba(255,255,240,0.4)' stroke-width='0.5'/%3E%3C/svg%3E")`,
  ember: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='6' height='6'%3E%3Ccircle cx='3' cy='3' r='2' fill='rgba(255,140,40,0.8)'/%3E%3Ccircle cx='3' cy='3' r='1' fill='rgba(255,200,80,0.9)'/%3E%3C/svg%3E")`,
  ash: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='6' height='6'%3E%3Ccircle cx='3' cy='3' r='2' fill='rgba(120,110,100,0.5)'/%3E%3C/svg%3E")`,
  sparkle: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8'%3E%3Cpath d='M4 0L4.8 3.2L8 4L4.8 4.8L4 8L3.2 4.8L0 4L3.2 3.2Z' fill='rgba(180,140,255,0.7)'/%3E%3C/svg%3E")`,
  sleetPellet: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='4' height='8'%3E%3Cellipse cx='2' cy='4' rx='1.5' ry='3' fill='rgba(200,220,255,0.6)'/%3E%3C/svg%3E")`,
  hailstone: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='8'%3E%3Ccircle cx='4' cy='4' r='3' fill='rgba(220,235,255,0.7)' stroke='rgba(180,200,230,0.5)' stroke-width='0.5'/%3E%3C/svg%3E")`,
  sand: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='4' height='4'%3E%3Ccircle cx='2' cy='2' r='1.2' fill='rgba(200,170,100,0.6)'/%3E%3C/svg%3E")`,
  frost: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10'%3E%3Cpath d='M5 0v10M0 5h10M2 2l6 6M8 2l-6 6' stroke='rgba(180,220,255,0.3)' stroke-width='0.5' fill='none'/%3E%3C/svg%3E")`,
};

// ── Particle layer configs ───────────────────────────────────────────────────
// Each condition maps to 1-3 particle layer definitions. On mount, one variant
// is chosen at random to keep the overlays from feeling stale.

interface ParticleLayer {
  sprite: string;
  count: number; // how many copies scattered across the banner
  animation: string;
  size: { w: number; h: number };
}

type VariantSet = ParticleLayer[][];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const PARTICLE_VARIANTS: Partial<Record<WeatherCondition, VariantSet>> = {
  drizzle: [
    [{ sprite: SPRITES.raindrop, count: 8, animation: 'wx-fall 1.8s linear infinite', size: { w: 4, h: 16 } }],
    [{ sprite: SPRITES.raindrop, count: 6, animation: 'wx-fall-diagonal 2s linear infinite', size: { w: 4, h: 16 } }],
  ],
  light_rain: [
    [{ sprite: SPRITES.raindrop, count: 14, animation: 'wx-fall 1.2s linear infinite', size: { w: 4, h: 16 } }],
    [{ sprite: SPRITES.raindrop, count: 12, animation: 'wx-fall-diagonal 1.4s linear infinite', size: { w: 4, h: 16 } }],
  ],
  rain: [
    [{ sprite: SPRITES.raindrop, count: 22, animation: 'wx-fall 0.7s linear infinite', size: { w: 4, h: 16 } }],
    [{ sprite: SPRITES.raindropHeavy, count: 18, animation: 'wx-fall 0.8s linear infinite', size: { w: 4, h: 20 } }],
  ],
  heavy_rain: [
    [
      { sprite: SPRITES.raindropHeavy, count: 30, animation: 'wx-fall-fast 0.4s linear infinite', size: { w: 4, h: 20 } },
      { sprite: SPRITES.raindrop, count: 15, animation: 'wx-fall 0.5s linear infinite', size: { w: 4, h: 16 } },
    ],
  ],
  sleet: [
    [
      { sprite: SPRITES.sleetPellet, count: 16, animation: 'wx-fall-diagonal 0.9s linear infinite', size: { w: 4, h: 8 } },
      { sprite: SPRITES.raindrop, count: 8, animation: 'wx-fall 0.8s linear infinite', size: { w: 4, h: 16 } },
    ],
  ],
  snow: [
    [{ sprite: SPRITES.snowflake, count: 18, animation: 'wx-drift-down 5s linear infinite', size: { w: 8, h: 8 } }],
    [
      { sprite: SPRITES.snowflake, count: 12, animation: 'wx-drift-down 6s linear infinite', size: { w: 8, h: 8 } },
      { sprite: SPRITES.snowflakeLarge, count: 5, animation: 'wx-drift-down 8s linear infinite', size: { w: 12, h: 12 } },
    ],
    [{ sprite: SPRITES.snowflakeLarge, count: 8, animation: 'wx-drift-down 7s linear infinite', size: { w: 12, h: 12 } }],
  ],
  hail: [
    [
      { sprite: SPRITES.hailstone, count: 12, animation: 'wx-fall-fast 0.5s linear infinite', size: { w: 8, h: 8 } },
      { sprite: SPRITES.raindrop, count: 10, animation: 'wx-fall 0.7s linear infinite', size: { w: 4, h: 16 } },
    ],
  ],
  windy: [
    [{ sprite: SPRITES.leaf, count: 8, animation: 'wx-drift-right 4s linear infinite', size: { w: 14, h: 10 } }],
    [{ sprite: SPRITES.dandelion, count: 6, animation: 'wx-drift-right 6s linear infinite', size: { w: 12, h: 12 } }],
    [
      { sprite: SPRITES.leaf, count: 5, animation: 'wx-drift-right 3.5s linear infinite', size: { w: 14, h: 10 } },
      { sprite: SPRITES.leafGreen, count: 4, animation: 'wx-drift-right 5s linear infinite', size: { w: 14, h: 10 } },
    ],
  ],
  gale: [
    [
      { sprite: SPRITES.leaf, count: 14, animation: 'wx-drift-right 2s linear infinite', size: { w: 14, h: 10 } },
      { sprite: SPRITES.ash, count: 8, animation: 'wx-drift-right 1.8s linear infinite', size: { w: 6, h: 6 } },
    ],
  ],
  calm: [
    [{ sprite: SPRITES.dandelion, count: 3, animation: 'wx-float 8s ease-in-out infinite', size: { w: 12, h: 12 } }],
    [{ sprite: SPRITES.leafGreen, count: 2, animation: 'wx-float 10s ease-in-out infinite', size: { w: 14, h: 10 } }],
  ],
  storm: [
    [{ sprite: SPRITES.raindropHeavy, count: 25, animation: 'wx-fall-fast 0.45s linear infinite', size: { w: 4, h: 20 } }],
  ],
  thunderstorm: [
    [{ sprite: SPRITES.raindropHeavy, count: 28, animation: 'wx-fall-fast 0.4s linear infinite', size: { w: 4, h: 20 } }],
  ],
  sandstorm: [
    [{ sprite: SPRITES.sand, count: 30, animation: 'wx-drift-right 1.5s linear infinite', size: { w: 4, h: 4 } }],
  ],
  embers: [
    [{ sprite: SPRITES.ember, count: 10, animation: 'wx-rise 4s linear infinite', size: { w: 6, h: 6 } }],
    [
      { sprite: SPRITES.ember, count: 7, animation: 'wx-rise 3.5s linear infinite', size: { w: 6, h: 6 } },
      { sprite: SPRITES.ash, count: 6, animation: 'wx-drift-down 5s linear infinite', size: { w: 6, h: 6 } },
    ],
  ],
  fae: [
    [{ sprite: SPRITES.sparkle, count: 8, animation: 'wx-float 6s ease-in-out infinite', size: { w: 8, h: 8 } }],
    [
      { sprite: SPRITES.sparkle, count: 5, animation: 'wx-float 7s ease-in-out infinite', size: { w: 8, h: 8 } },
      { sprite: SPRITES.dandelion, count: 3, animation: 'wx-rise 10s linear infinite', size: { w: 12, h: 12 } },
    ],
  ],
  cold: [
    [{ sprite: SPRITES.frost, count: 6, animation: 'wx-shimmer 5s ease-in-out infinite', size: { w: 10, h: 10 } }],
  ],
  dust: [
    [{ sprite: SPRITES.sand, count: 12, animation: 'wx-drift-right 3s linear infinite', size: { w: 4, h: 4 } }],
  ],
};

// ── Atmosphere layer configs ─────────────────────────────────────────────────
// CSS gradient/tint that sets the mood. No animation needed for most.

function atmosphereStyle(condition: WeatherCondition): React.CSSProperties {
  switch (condition) {
    case 'drizzle':
      return { background: 'linear-gradient(180deg, rgba(100,120,150,0.15) 0%, rgba(100,120,150,0.08) 100%)' };
    case 'light_rain':
      return { background: 'linear-gradient(180deg, rgba(80,100,140,0.2) 0%, rgba(80,100,140,0.1) 100%)' };
    case 'rain':
      return { background: 'linear-gradient(180deg, rgba(60,80,120,0.3) 0%, rgba(60,80,120,0.15) 100%)' };
    case 'heavy_rain':
      return { background: 'linear-gradient(180deg, rgba(40,60,100,0.45) 0%, rgba(40,60,100,0.25) 100%)' };
    case 'sleet':
      return { background: 'linear-gradient(180deg, rgba(100,110,130,0.3) 0%, rgba(180,190,210,0.15) 100%)' };
    case 'snow':
      return { background: 'linear-gradient(180deg, rgba(200,210,230,0.2) 0%, rgba(220,225,240,0.1) 100%)' };
    case 'hail':
      return { background: 'linear-gradient(180deg, rgba(60,70,100,0.4) 0%, rgba(60,70,100,0.2) 100%)' };
    case 'windy':
      return {}; // particles only
    case 'gale':
      return { background: 'linear-gradient(90deg, rgba(80,70,60,0.15) 0%, transparent 40%, rgba(80,70,60,0.1) 100%)' };
    case 'calm':
      return {}; // particles only, or nothing
    case 'fog':
      return { background: 'linear-gradient(0deg, rgba(200,200,210,0.8) 0%, rgba(200,200,210,0.55) 40%, rgba(200,200,210,0.2) 75%, transparent 100%)' };
    case 'mist':
      return { background: 'linear-gradient(0deg, rgba(220,220,230,0.45) 0%, rgba(220,220,230,0.25) 50%, transparent 85%)' };
    case 'haze':
      return { background: 'linear-gradient(180deg, rgba(200,180,140,0.25) 0%, rgba(200,180,140,0.1) 100%)' };
    case 'overcast':
      return { background: 'linear-gradient(180deg, rgba(80,80,90,0.35) 0%, rgba(80,80,90,0.15) 100%)' };
    case 'hot':
      return { background: 'linear-gradient(180deg, rgba(220,160,60,0.2) 0%, rgba(220,160,60,0.08) 100%)' };
    case 'cold':
      return { background: 'linear-gradient(180deg, rgba(140,180,220,0.25) 0%, rgba(180,200,230,0.35) 100%)' };
    case 'storm':
      return { background: 'linear-gradient(180deg, rgba(30,30,50,0.45) 0%, rgba(30,30,50,0.2) 100%)' };
    case 'thunderstorm':
      return { background: 'linear-gradient(180deg, rgba(20,15,40,0.5) 0%, rgba(40,30,60,0.25) 100%)' };
    case 'sandstorm':
      return { background: 'linear-gradient(90deg, rgba(180,150,90,0.5) 0%, rgba(180,150,90,0.3) 100%)' };
    case 'dust':
      return { background: 'linear-gradient(180deg, rgba(180,140,80,0.25), rgba(180,140,80,0.05) 70%)' };
    case 'embers':
      return { background: 'linear-gradient(0deg, rgba(220,80,30,0.2) 0%, rgba(220,80,30,0.05) 60%, transparent 100%)' };
    case 'fae':
      return { background: 'linear-gradient(180deg, rgba(100,60,180,0.15) 0%, rgba(60,40,120,0.08) 100%)' };
    case 'blood_moon':
      return { background: 'linear-gradient(180deg, rgba(120,20,20,0.35) 0%, rgba(120,20,20,0.15) 100%)' };
    case 'aurora':
      return { background: 'linear-gradient(160deg, rgba(40,180,100,0.15) 0%, rgba(80,60,200,0.15) 40%, rgba(40,180,100,0.1) 70%, transparent 100%)' };
    case 'clear':
    default:
      return {};
  }
}

// Conditions that get a lightning flicker overlay
const LIGHTNING_CONDITIONS: WeatherCondition[] = ['storm', 'thunderstorm'];

// Conditions that get the aurora sweep animation
const AURORA_CONDITIONS: WeatherCondition[] = ['aurora'];

// ── Component ────────────────────────────────────────────────────────────────

interface Props {
  playerId: string;
}

export default function PlayerBannerWeather({ playerId }: Props) {
  const [weather, setWeather] = useState<RavenWeatherRow | null>(null);

  useEffect(() => {
    fetch(`/api/weather/current?playerId=${encodeURIComponent(playerId)}`)
      .then(r => r.ok ? r.json() : null)
      .then(setWeather)
      .catch(() => {});
  }, [playerId]);

  // Pick a random variant on mount so repeated visits feel fresh
  const particles = useMemo(() => {
    if (!weather) return [];
    const variants = PARTICLE_VARIANTS[weather.condition];
    if (!variants || variants.length === 0) return [];
    return pickRandom(variants);
  }, [weather]);

  if (!weather || weather.condition === 'clear') return null;

  const atmo = atmosphereStyle(weather.condition);
  const hasLightning = LIGHTNING_CONDITIONS.includes(weather.condition);
  const hasAurora = AURORA_CONDITIONS.includes(weather.condition);

  return (
    <>
      <style>{KEYFRAMES}</style>

      {/* Layer 1: Atmosphere tint */}
      {Object.keys(atmo).length > 0 && (
        <div aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', ...atmo }} />
      )}

      {/* Layer 2: Sprite particles */}
      {particles.map((layer, li) => (
        <div key={li} aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
          {Array.from({ length: layer.count }).map((_, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                left: `${(i * 97 + li * 31) % 100}%`,
                top: `${(i * 71 + li * 43) % 80}%`,
                width: layer.size.w,
                height: layer.size.h,
                backgroundImage: layer.sprite,
                backgroundSize: 'contain',
                backgroundRepeat: 'no-repeat',
                animation: layer.animation,
                animationDelay: `${(i * 0.37 + li * 0.5) % 3}s`,
              }}
            />
          ))}
        </div>
      ))}

      {/* Lightning flicker */}
      {hasLightning && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            background: '#fff',
            pointerEvents: 'none',
            animation: 'wx-flicker 7s linear infinite',
            mixBlendMode: 'overlay',
          }}
        />
      )}

      {/* Aurora sweep */}
      {hasAurora && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background: 'linear-gradient(120deg, rgba(40,220,120,0.2) 0%, rgba(100,60,220,0.25) 30%, rgba(40,200,180,0.15) 60%, transparent 100%)',
            animation: 'wx-aurora 12s ease-in-out infinite',
          }}
        />
      )}

      {/* Weather pill */}
      <div style={{ position: 'absolute', top: 14, right: 16 }}>
        <RavenWeatherPill condition={weather.condition} temp_c={weather.temp_c} wind_label={weather.wind_label} />
      </div>
    </>
  );
}
