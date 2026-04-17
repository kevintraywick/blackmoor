'use client';

import { useEffect, useState } from 'react';

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

export default function ChalkStreak({
  x,
  y,
  onDone,
}: {
  x: number;
  y: number;
  onDone?: () => void;
}) {
  // Randomize the streak each invocation so it feels hand-drawn
  const [streak] = useState(() => {
    const length = rand(70, 110);
    const angle = rand(-35, 35); // degrees — mostly horizontal-ish
    // Build a wavy/jittered path so it doesn't look like a ruler line
    const segments = 8;
    const points: string[] = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const along = (t - 0.5) * length;
      const jitter = i === 0 || i === segments ? 0 : rand(-3, 3);
      points.push(`${along.toFixed(1)},${jitter.toFixed(1)}`);
    }
    return { length, angle, path: `M ${points.join(' L ')}` };
  });

  useEffect(() => {
    const timer = setTimeout(() => onDone?.(), 1800);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <div
      style={{
        position: 'fixed',
        left: x,
        top: y,
        pointerEvents: 'none',
        zIndex: 9999,
        transform: `rotate(${streak.angle}deg)`,
      }}
      aria-hidden="true"
    >
      <svg
        width={streak.length + 20}
        height={40}
        viewBox={`${-(streak.length / 2) - 10} -20 ${streak.length + 20} 40`}
        style={{ overflow: 'visible' }}
      >
        {/* Three overlapping strokes with slightly different offsets for a crumbly chalk look */}
        <path
          d={streak.path}
          className="chalk-streak-path"
          fill="none"
          stroke="#e8e2d0"
          strokeWidth={3.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.95}
          style={{ '--chalk-len': `${streak.length + 40}` } as React.CSSProperties}
        />
        <path
          d={streak.path}
          className="chalk-streak-path chalk-streak-path-offset"
          fill="none"
          stroke="#d8cfb8"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.8}
          transform="translate(0, 2)"
          style={{ '--chalk-len': `${streak.length + 40}` } as React.CSSProperties}
        />
        <path
          d={streak.path}
          className="chalk-streak-path chalk-streak-path-offset2"
          fill="none"
          stroke="#ece5d0"
          strokeWidth={0.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.6}
          transform="translate(0, -2)"
          style={{ '--chalk-len': `${streak.length + 40}` } as React.CSSProperties}
        />
      </svg>
    </div>
  );
}
