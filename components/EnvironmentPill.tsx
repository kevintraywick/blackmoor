'use client';

// Environment pill — small top-right badge on local maps that shows the
// current weather and day/night state, inherited from the parent world hex
// at the current campaign game time. Polls /api/world/hexes/.../environment
// on a 5s interval. Renders nothing if the build has no world anchor.

import { useEffect, useState } from 'react';

interface Env {
  weather: string;
  dayNight: 'day' | 'night';
  gameTime: string;
}

interface Props {
  q: number | null;
  r: number | null;
}

const WEATHER_GLYPH: Record<string, string> = {
  clear: '☀',
  storm: '⛈',
  rain: '☂',
  fog: '☁',
  snow: '❄',
};

export default function EnvironmentPill({ q, r }: Props) {
  const [env, setEnv] = useState<Env | null>(null);

  useEffect(() => {
    if (q == null || r == null) return;
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/world/hexes/${q}/${r}/environment`);
        if (!res.ok) return;
        const data: Env = await res.json();
        if (!cancelled) setEnv(data);
      } catch {
        /* ignore */
      }
    }
    load();
    const id = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [q, r]);

  if (q == null || r == null || !env) return null;

  const isNight = env.dayNight === 'night';
  const weatherGlyph =
    (env.weather && WEATHER_GLYPH[env.weather]) || (isNight ? '🌙' : '☀');

  return (
    <div
      title={`Hex (${q}, ${r}) · ${env.weather} · ${env.dayNight}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 12px',
        background: isNight ? '#0f1418' : '#1a1614',
        border: `1px solid ${isNight ? '#3a4a5a' : '#5a4632'}`,
        borderRadius: 2,
        color: '#e8dcc4',
        fontFamily: 'EB Garamond, Georgia, serif',
        fontSize: '0.78rem',
      }}
    >
      <span style={{ fontSize: '1rem', lineHeight: 1 }}>{weatherGlyph}</span>
      <span style={{ textTransform: 'capitalize' }}>{env.weather}</span>
      <span style={{ color: isNight ? '#7a8aa8' : '#c9a84c' }}>·</span>
      <span style={{ color: isNight ? '#9aaac8' : '#e8dcc4', textTransform: 'capitalize' }}>
        {env.dayNight}
      </span>
      <span
        style={{
          color: '#6a5a3c',
          fontSize: '0.62rem',
          textTransform: 'uppercase',
          letterSpacing: '0.15em',
          fontFamily: 'Geist, system-ui, sans-serif',
          marginLeft: 4,
        }}
      >
        {env.gameTime}
      </span>
    </div>
  );
}
