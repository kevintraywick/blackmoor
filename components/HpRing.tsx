'use client';

import type { ReactNode } from 'react';

interface HpRingProps {
  current: number;
  max: number;
  /** Ring thickness as % of the container (default 9) */
  ringPct?: number;
  children: ReactNode;
}

/**
 * Wraps a circle (player portrait, NPC token) with an SVG HP progress ring.
 *
 * The red ring sits outside the circle border, sweeping clockwise from 12 o'clock.
 * When HP drops below 50%, a blood-red overlay covers the portrait ("bloodied").
 *
 * Size is controlled by the PARENT — this component fills 100% of its container.
 * Use Tailwind/inline styles on the parent to set responsive dimensions.
 */
export default function HpRing({ current, max, ringPct = 8, children }: HpRingProps) {
  const pct = max > 0 ? Math.max(0, Math.min(1, current / max)) : 1;
  const isBloodied = max > 0 && current > 0 && current / max < 0.5;

  // viewBox coordinates — ring drawn inside a 100×100 space
  const vb = 100;
  const strokeWidth = ringPct;
  const radius = (vb - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashoffset = circumference * (1 - pct);

  // Inset for children = half the ring thickness (as %)
  const inset = ringPct / 2;

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', flexShrink: 0 }}>
      {/* SVG ring — scales with container via viewBox */}
      <svg
        viewBox={`0 0 ${vb} ${vb}`}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', transform: 'rotate(-90deg)' }}
      >
        {/* Background track (dark, always visible) */}
        <circle
          cx={vb / 2}
          cy={vb / 2}
          r={radius}
          fill="none"
          stroke="#1a1a1a"
          strokeWidth={strokeWidth}
        />
        {/* HP arc (red, sweeps clockwise) */}
        <circle
          cx={vb / 2}
          cy={vb / 2}
          r={radius}
          fill="none"
          stroke="#c0392b"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={dashoffset}
          strokeLinecap="butt"
          style={{ transition: 'stroke-dashoffset 0.4s ease' }}
        />
      </svg>

      {/* Inner circle content — centered inside the ring */}
      <div
        style={{
          position: 'absolute',
          top: `${inset}%`,
          left: `${inset}%`,
          width: `${100 - ringPct}%`,
          height: `${100 - ringPct}%`,
          borderRadius: '50%',
          overflow: 'hidden',
        }}
      >
        {children}

        {/* Bloodied overlay */}
        {isBloodied && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              background: 'rgba(139, 26, 26, 0.45)',
              pointerEvents: 'none',
            }}
          />
        )}
      </div>
    </div>
  );
}
