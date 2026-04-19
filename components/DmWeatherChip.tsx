'use client';

/**
 * Compact weather chip for the DM Session Control Bar.
 *
 * Shows the current prose weather line inline; hover reveals the raw state
 * (biome, temp, wind, precip, pressure) for DM reference. Refreshes on
 * SSE 'game_clock' events.
 *
 * Ambience v1 Unit 7. See docs/plans/2026-04-19-001-feat-ambience-v1-plan.md
 */

import { useCallback, useEffect, useState } from 'react';
import { useSSE } from '@/lib/useSSE';

interface Response {
  cell: string;
  koppen: string;
  prose: string;
  state: {
    condition: string;
    temp_c: number;
    wind_mph: number;
    wind_deg: number;
    precip_mm: number;
    pressure_hpa: number;
    pressure_trend: 'rising' | 'falling' | 'steady';
    cloud_pct: number;
  };
}

function compass(deg: number): string {
  const names = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return names[Math.round(((deg % 360) + 360) % 360 / 45) % 8];
}

export default function DmWeatherChip() {
  const [data, setData] = useState<Response | null>(null);
  const [hover, setHover] = useState(false);

  const fetchChip = useCallback(async () => {
    try {
      const res = await fetch('/api/ambience/banner', { cache: 'no-store' });
      if (!res.ok) return;
      setData((await res.json()) as Response);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => { fetchChip(); }, [fetchChip]);
  useSSE('game_clock', fetchChip);

  if (!data) return null;

  const { prose, state, koppen } = data;

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative',
        maxWidth: 220,
        padding: '6px 10px',
        border: '1px solid rgba(201,168,76,0.4)',
        borderRadius: 3,
        background: 'rgba(26,23,20,0.5)',
        cursor: 'help',
      }}
    >
      <div
        style={{
          fontFamily: "'EB Garamond', serif",
          fontStyle: 'italic',
          fontSize: '0.75rem',
          color: '#e8dcc4',
          lineHeight: 1.3,
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
        }}
      >
        {prose}
      </div>
      {hover && (
        <div
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 6px)',
            left: 0,
            background: 'rgba(10, 8, 6, 0.96)',
            border: '1px solid rgba(201,168,76,0.4)',
            borderRadius: 3,
            padding: '8px 12px',
            fontSize: '0.7rem',
            fontFamily: '"Geist Mono", ui-monospace, monospace',
            color: '#e8dcc4',
            whiteSpace: 'nowrap',
            zIndex: 50,
          }}
        >
          <div style={{ opacity: 0.6, marginBottom: 4 }}>{koppen} · {state.condition}</div>
          <div>{state.temp_c.toFixed(1)}°C</div>
          <div>wind {state.wind_mph.toFixed(0)} mph {compass(state.wind_deg)}</div>
          <div>precip {state.precip_mm.toFixed(1)} mm/hr</div>
          <div>pressure {state.pressure_hpa.toFixed(0)} ({state.pressure_trend})</div>
          <div>cloud {state.cloud_pct}%</div>
        </div>
      )}
    </div>
  );
}
