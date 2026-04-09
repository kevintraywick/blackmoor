'use client';

import { useState, useEffect } from 'react';
import type { RavenWeatherRow, WeatherCondition } from '@/lib/types';
import RavenWeatherPill from './RavenWeatherPill';

// CSS-only animated weather overlays. The keyframes live inline so this
// component is self-contained.

const RAIN_KEYFRAMES = `
@keyframes raven-rain {
  0%   { transform: translateY(-80px); }
  100% { transform: translateY(220px); }
}
@keyframes raven-snow {
  0%   { transform: translateY(-50px) translateX(0); }
  100% { transform: translateY(220px) translateX(20px); }
}
@keyframes raven-flicker {
  0%, 95%, 100% { opacity: 0; }
  96%, 98% { opacity: 0.6; }
}`;

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

  if (!weather || weather.condition === 'clear') return null;

  return (
    <>
      <style>{RAIN_KEYFRAMES}</style>
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          ...weatherLayerStyle(weather.condition),
        }}
      />
      {weather.condition === 'storm' && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            background: '#fff',
            pointerEvents: 'none',
            animation: 'raven-flicker 7s linear infinite',
            mixBlendMode: 'overlay',
          }}
        />
      )}
      <div style={{ position: 'absolute', top: 14, right: 16 }}>
        <RavenWeatherPill condition={weather.condition} temp_c={weather.temp_c} wind_label={weather.wind_label} />
      </div>
    </>
  );
}

function weatherLayerStyle(condition: WeatherCondition): React.CSSProperties {
  switch (condition) {
    case 'rain':
    case 'storm':
      return {
        backgroundImage:
          'radial-gradient(2px 16px at 10% -10%, rgba(160,200,255,0.4), transparent),' +
          'radial-gradient(2px 14px at 25% -10%, rgba(160,200,255,0.5), transparent),' +
          'radial-gradient(2px 16px at 45% -10%, rgba(160,200,255,0.4), transparent),' +
          'radial-gradient(2px 12px at 60% -10%, rgba(160,200,255,0.5), transparent),' +
          'radial-gradient(2px 16px at 78% -10%, rgba(160,200,255,0.4), transparent),' +
          'radial-gradient(2px 14px at 92% -10%, rgba(160,200,255,0.5), transparent)',
        backgroundSize: '100% 80px',
        animation: 'raven-rain 0.6s linear infinite',
      };
    case 'snow':
      return {
        backgroundImage:
          'radial-gradient(3px 3px at 12% 10%, rgba(255,255,255,0.85), transparent),' +
          'radial-gradient(2px 2px at 28% 30%, rgba(255,255,255,0.85), transparent),' +
          'radial-gradient(3px 3px at 50% 50%, rgba(255,255,255,0.85), transparent),' +
          'radial-gradient(2px 2px at 70% 20%, rgba(255,255,255,0.85), transparent),' +
          'radial-gradient(3px 3px at 88% 70%, rgba(255,255,255,0.85), transparent)',
        backgroundSize: '100% 100%',
        animation: 'raven-snow 4s linear infinite',
      };
    case 'fog':
    case 'mist':
      return {
        background: 'linear-gradient(180deg, rgba(255,255,255,0.25), rgba(255,255,255,0.05) 70%)',
      };
    case 'dust':
      return {
        background: 'linear-gradient(180deg, rgba(180,140,80,0.25), rgba(180,140,80,0.05) 70%)',
      };
    case 'embers':
      return {
        background: 'linear-gradient(180deg, rgba(220,80,30,0.18), rgba(220,80,30,0.02) 70%)',
      };
    default:
      return {};
  }
}
