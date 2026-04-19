'use client';

/**
 * Weather prose line shown on the player sheet banner.
 *
 * Fetches /api/ambience/banner and re-fetches on game_clock SSE events so
 * the line updates when the DM advances time.
 *
 * Ambience v1 Unit 6. See docs/plans/2026-04-19-001-feat-ambience-v1-plan.md
 */

import { useCallback, useEffect, useState } from 'react';
import { useSSE } from '@/lib/useSSE';

interface Response {
  cell: string;
  koppen: string;
  prose: string;
}

export default function AmbienceProseLine() {
  const [prose, setProse] = useState<string | null>(null);

  const fetchProse = useCallback(async () => {
    try {
      const res = await fetch('/api/ambience/banner', { cache: 'no-store' });
      if (!res.ok) return;
      const data: Response = await res.json();
      if (typeof data.prose === 'string') setProse(data.prose);
    } catch {
      // silent — keep last known line
    }
  }, []);

  useEffect(() => { fetchProse(); }, [fetchProse]);
  useSSE('game_clock', fetchProse);

  if (!prose) return null;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 12,
        left: 0,
        right: 0,
        textAlign: 'center',
        fontFamily: "'EB Garamond', serif",
        fontStyle: 'italic',
        fontSize: '0.9rem',
        color: '#f0e0c8',
        textShadow: '0 1px 2px rgba(0,0,0,0.9), 0 0 8px rgba(0,0,0,0.7)',
        pointerEvents: 'none',
        userSelect: 'none',
        padding: '0 16px',
      }}
    >
      {prose}
    </div>
  );
}
