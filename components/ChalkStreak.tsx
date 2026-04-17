'use client';

import { useEffect, useState } from 'react';

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

interface Shape {
  kind: 'circle' | 'slash';
  path: string;
  length: number;
  angle: number;
  delay: number;
}

function makeCircle(): string {
  const radius = rand(26, 32);
  const segments = 36;
  const startAngle = rand(0, Math.PI * 2);
  // Slight overshoot so the ends overlap, like a hand-drawn circle
  const sweep = Math.PI * 2 + rand(0.2, 0.5);
  const points: string[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const theta = startAngle + sweep * t;
    const r = radius + rand(-1.8, 1.8);
    const x = Math.cos(theta) * r;
    const y = Math.sin(theta) * r;
    points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return `M ${points.join(' L ')}`;
}

function makeSlash(): string {
  const length = rand(76, 96);
  const segments = 8;
  const points: string[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const along = (t - 0.5) * length;
    const jitter = i === 0 || i === segments ? 0 : rand(-2, 2);
    points.push(`${along.toFixed(1)},${jitter.toFixed(1)}`);
  }
  return `M ${points.join(' L ')}`;
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
  // Circle draws first, then the slash cuts through it — a "no" mark.
  const [shapes] = useState<Shape[]>(() => {
    const slashAngle = rand(-30, 30);
    return [
      { kind: 'circle', path: makeCircle(), length: 210, angle: 0, delay: 0 },
      { kind: 'slash', path: makeSlash(), length: 90, angle: slashAngle, delay: 0.55 },
    ];
  });

  useEffect(() => {
    const timer = setTimeout(() => onDone?.(), 2400);
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
      }}
      aria-hidden="true"
    >
      {shapes.map((s, idx) => {
        const size = s.length + 40;
        return (
          <svg
            key={idx}
            width={size}
            height={size}
            viewBox={`${-size / 2} ${-size / 2} ${size} ${size}`}
            style={{
              position: 'absolute',
              left: -size / 2,
              top: -size / 2,
              transform: `rotate(${s.angle}deg)`,
              overflow: 'visible',
            }}
          >
            {/* Triple-overlap strokes for chalky texture */}
            <path
              d={s.path}
              className="chalk-streak-path"
              fill="none"
              stroke="#e8e2d0"
              strokeWidth={3.0}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.95}
              style={{
                '--chalk-len': `${s.length}`,
                animationDelay: `${s.delay}s`,
              } as React.CSSProperties}
            />
            <path
              d={s.path}
              className="chalk-streak-path"
              fill="none"
              stroke="#d8cfb8"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.8}
              transform="translate(1, 1)"
              style={{
                '--chalk-len': `${s.length}`,
                animationDelay: `${s.delay + 0.04}s`,
              } as React.CSSProperties}
            />
            <path
              d={s.path}
              className="chalk-streak-path"
              fill="none"
              stroke="#ece5d0"
              strokeWidth={0.7}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.6}
              transform="translate(-1, -1)"
              style={{
                '--chalk-len': `${s.length}`,
                animationDelay: `${s.delay + 0.08}s`,
              } as React.CSSProperties}
            />
          </svg>
        );
      })}
    </div>
  );
}
