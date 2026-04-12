'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import AmbientCircles, { resolveWindIntensity } from './AmbientCircles';
import type { CelestialProps, WindProps, CompassProps } from './AmbientCircles';
import type { RavenWeatherRow } from '@/lib/types';
import { getMoonPhase } from '@/lib/lunar';
import { getSolarPosition } from '@/lib/solar';
import { hexCenter } from '@/lib/hex-math';

interface PartyPosition {
  party_q: number | null;
  party_r: number | null;
  party_prev_q: number | null;
  party_prev_r: number | null;
}

interface Props {
  playerId: string;
  size?: number;
}

function computeCelestial(): CelestialProps {
  const solar = getSolarPosition();
  if (solar.isDay) {
    return { kind: 'sun', altitudeDeg: solar.altitudeDeg };
  }
  const moon = getMoonPhase();
  return { kind: 'moon', moonPhase: moon.phase, illumination: moon.illumination };
}

function computeCompassBearing(pos: PartyPosition): CompassProps {
  if (
    pos.party_q == null || pos.party_r == null ||
    pos.party_prev_q == null || pos.party_prev_r == null
  ) {
    return { bearingDeg: 0, stationary: true };
  }
  if (pos.party_q === pos.party_prev_q && pos.party_r === pos.party_prev_r) {
    return { bearingDeg: 0, stationary: true };
  }
  const prev = hexCenter(pos.party_prev_q, pos.party_prev_r, 1);
  const curr = hexCenter(pos.party_q, pos.party_r, 1);
  const dx = curr.cx - prev.cx;
  const dy = curr.cy - prev.cy;
  const rad = Math.atan2(dx, -dy);
  const deg = ((rad * 180) / Math.PI + 360) % 360;
  return { bearingDeg: Math.round(deg), stationary: false };
}

export default function AmbientCirclesData({ playerId, size }: Props) {
  const [celestial, setCelestial] = useState<CelestialProps>(() => computeCelestial());
  const [weather, setWeather] = useState<RavenWeatherRow | null>(null);
  const [partyPos, setPartyPos] = useState<PartyPosition | null>(null);

  const updateCelestial = useCallback(() => {
    setCelestial(computeCelestial());
  }, []);

  useEffect(() => {
    let alive = true;

    fetch(`/api/weather/current?playerId=${encodeURIComponent(playerId)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (alive) setWeather(data); })
      .catch(() => {});

    fetch('/api/party/position')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (alive) setPartyPos(data); })
      .catch(() => {});

    const celestialTimer = setInterval(updateCelestial, 3600_000);

    const partyTimer = setInterval(() => {
      fetch('/api/party/position')
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (alive) setPartyPos(data); })
        .catch(() => {});
    }, 600_000);

    const onFocus = () => updateCelestial();
    window.addEventListener('focus', onFocus);

    return () => {
      alive = false;
      clearInterval(celestialTimer);
      clearInterval(partyTimer);
      window.removeEventListener('focus', onFocus);
    };
  }, [playerId, updateCelestial]);

  const wind: WindProps = useMemo(() => {
    if (!weather) return { dirDeg: 0, intensity: 'calm' as const };
    return {
      dirDeg: weather.wind_dir_deg ?? 0,
      intensity: resolveWindIntensity(weather.condition, weather.wind_speed_mph),
    };
  }, [weather]);

  const compass: CompassProps = useMemo(() => {
    if (!partyPos) return { bearingDeg: 0, stationary: true };
    return computeCompassBearing(partyPos);
  }, [partyPos]);

  return (
    <AmbientCircles
      celestial={celestial}
      wind={wind}
      compass={compass}
      size={size}
    />
  );
}
