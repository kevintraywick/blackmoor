'use client';

// Session Control Bar — DM cockpit for the game clock and session lifecycle.
//
// Five circles, left to right:
//   1. Pause / Resume (state-aware: shows the action you can take next)
//   2. +1 hour
//   3. +8 hours (Long Rest)
//   4. +1 day
//   5. End session
//
// All five action circles flank a clock readout in the center. Pause and End
// also pause the campaign-wide game clock (lib/game-clock.ts is the only
// writer; this component goes through the API).

import { useCallback, useEffect, useState } from 'react';
import { formatGameTime } from '@/lib/game-clock-format';

interface ClockState {
  game_time_seconds: number;
  clock_paused: boolean;
  clock_last_advanced_at: number;
}

type SessionStatus = 'open' | 'paused' | 'ended';

interface Props {
  sessionId: string;
}

export default function SessionControlBar({ sessionId }: Props) {
  const [status, setStatus] = useState<SessionStatus>('open');
  const [clock, setClock] = useState<ClockState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initial fetch + slow poll for cross-tab visibility
  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      try {
        const res = await fetch(`/api/sessions/${sessionId}/control`);
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setStatus(data.status);
        setClock(data.clock);
      } catch {
        /* ignore */
      }
    }
    refresh();
    const id = setInterval(refresh, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [sessionId]);

  const callAction = useCallback(
    async (action: 'pause' | 'resume' | 'end') => {
      setBusy(true);
      setError(null);
      try {
        const res = await fetch(`/api/sessions/${sessionId}/control`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error || 'Action failed');
        } else {
          const data = await res.json();
          setStatus(data.status);
          setClock(data.clock);
        }
      } catch {
        setError('Network error');
      } finally {
        setBusy(false);
      }
    },
    [sessionId]
  );

  const advance = useCallback(async (seconds: number) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/clock/advance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seconds }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Advance failed');
      } else {
        const data = await res.json();
        setClock(data.clock);
      }
    } catch {
      setError('Network error');
    } finally {
      setBusy(false);
    }
  }, []);

  const isPaused = clock?.clock_paused ?? true;
  const isEnded = status === 'ended';
  const canAdvance = !isPaused && !isEnded && !busy;

  return (
    <div
      style={{
        background: '#1a2118',
        borderBottom: '1px solid #4a7a5a',
        padding: '12px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
      }}
    >
      {/* Pause / Resume */}
      <Circle
        label={isPaused ? 'Resume' : 'Pause'}
        glyph={isPaused ? '▶' : '❚❚'}
        active={!isPaused && !isEnded}
        disabled={isEnded || busy}
        onClick={() => callAction(isPaused ? 'resume' : 'pause')}
        accent={isPaused ? '#7ac28a' : '#c9a84c'}
      />

      {/* +1 hour */}
      <Circle
        label="+1h"
        glyph="+1h"
        disabled={!canAdvance}
        onClick={() => advance(3600)}
        accent="#c9a84c"
      />

      {/* Clock readout */}
      <div
        style={{
          minWidth: 220,
          textAlign: 'center',
          fontFamily: 'EB Garamond, Georgia, serif',
          color: '#e8dcc4',
        }}
      >
        <div style={{ fontSize: '1.05rem', letterSpacing: '0.04em' }}>
          {clock ? formatGameTime(clock.game_time_seconds) : '—'}
        </div>
        <div
          style={{
            fontSize: '0.62rem',
            textTransform: 'uppercase',
            letterSpacing: '0.18em',
            color: isEnded ? '#8a6a6a' : isPaused ? '#c9a84c' : '#7ac28a',
            marginTop: 2,
            fontFamily: 'Geist, system-ui, sans-serif',
          }}
        >
          {isEnded ? 'Session Ended' : isPaused ? 'Clock Paused' : 'Clock Running'}
        </div>
      </div>

      {/* +8 hours — Long Rest */}
      <Circle
        label="Long Rest"
        glyph="+8h"
        disabled={!canAdvance}
        onClick={() => advance(8 * 3600)}
        accent="#c9a84c"
      />

      {/* +1 day */}
      <Circle
        label="+1 day"
        glyph="+1d"
        disabled={!canAdvance}
        onClick={() => advance(24 * 3600)}
        accent="#c9a84c"
      />

      {/* End session */}
      <Circle
        label="End"
        glyph="■"
        disabled={isEnded || busy}
        onClick={() => {
          if (window.confirm('End this session? The clock will be paused.')) {
            callAction('end');
          }
        }}
        accent="#c07a8a"
      />

      {error && (
        <div
          style={{
            marginLeft: 16,
            color: '#c07a8a',
            fontSize: '0.7rem',
            fontFamily: 'Geist, system-ui, sans-serif',
            textTransform: 'uppercase',
            letterSpacing: '0.15em',
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}

function Circle({
  label,
  glyph,
  active = false,
  disabled = false,
  onClick,
  accent,
}: {
  label: string;
  glyph: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  accent: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      style={{
        width: 44,
        height: 44,
        borderRadius: '50%',
        border: `1.5px solid ${disabled ? '#3a4036' : active ? accent : '#5a6a52'}`,
        background: active ? `${accent}22` : 'transparent',
        color: disabled ? '#5a6a52' : active ? accent : '#a8b8a0',
        fontFamily: 'Geist, system-ui, sans-serif',
        fontSize: '0.72rem',
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'border-color 120ms, color 120ms, background 120ms',
        padding: 0,
      }}
    >
      <span style={{ lineHeight: 1 }}>{glyph}</span>
    </button>
  );
}
