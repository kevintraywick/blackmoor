'use client';

/**
 * Forecast column for the Raven Post broadsheet.
 *
 * Fills the previously-empty (row 3, col 3) grid cell with three prose
 * lines: today, tomorrow, day after. Data from /api/ambience/forecast,
 * refreshed on SSE 'game_clock' events.
 *
 * Ambience v1 Unit 8.
 */

import { useCallback, useEffect, useState } from 'react';
import { useSSE } from '@/lib/useSSE';

interface ForecastLine {
  label: string;
  prose: string;
}

interface Response {
  lines: ForecastLine[] | null;
}

export default function RavenForecastColumn() {
  const [lines, setLines] = useState<ForecastLine[] | null>(null);

  const fetchForecast = useCallback(async () => {
    try {
      const res = await fetch('/api/ambience/forecast', { cache: 'no-store' });
      if (!res.ok) return;
      const data: Response = await res.json();
      setLines(data.lines);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => { fetchForecast(); }, [fetchForecast]);
  useSSE('game_clock', fetchForecast);

  if (!lines || lines.length === 0) return null;

  return (
    <section className="raven-bs__forecast">
      <header
        style={{
          fontFamily: "'UnifrakturMaguntia', 'EB Garamond', serif",
          fontSize: '0.95rem',
          borderBottom: '1px solid #8b5a1e',
          paddingBottom: 4,
          marginBottom: 6,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          color: '#3d2c1a',
        }}
      >
        The Week's Weather
      </header>
      {lines.map((ln) => (
        <div key={ln.label} style={{ marginBottom: 6 }}>
          <div
            style={{
              fontFamily: "'EB Garamond', serif",
              fontSize: '0.58rem',
              textTransform: 'uppercase',
              letterSpacing: '0.15em',
              color: '#7a5230',
              marginBottom: 1,
            }}
          >
            {ln.label}
          </div>
          <div
            style={{
              fontFamily: "'EB Garamond', serif",
              fontStyle: 'italic',
              fontSize: '0.82rem',
              lineHeight: 1.35,
              color: '#2b1f14',
            }}
          >
            {ln.prose}
          </div>
        </div>
      ))}
    </section>
  );
}
