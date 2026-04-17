'use client';

import { useEffect, useState } from 'react';

interface Leaf {
  id: number;
  startX: number;
  size: number;
  fallDistance: number;
  drift: number;
  spin: number;
  duration: number;
  delay: number;
  char: string;
  color: string;
}

const CHARS = ['🍂', '🍃', '🍂', '🍃', '🍂'];
const COLORS = [
  '#7aa85a',
  '#5ab87a',
  '#8fc074',
  '#b8a040',
  '#9ab060',
];

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

export default function LeafFall({
  x,
  y,
  onDone,
}: {
  x: number;
  y: number;
  onDone?: () => void;
}) {
  const [leaves] = useState<Leaf[]>(() => {
    const count = 18;
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      startX: rand(-16, 16),
      size: rand(14, 26),
      fallDistance: rand(120, 260),
      drift: rand(-80, 80),
      spin: rand(-540, 540),
      duration: rand(1.6, 2.8),
      delay: rand(0, 0.5),
      char: CHARS[i % CHARS.length],
      color: COLORS[i % COLORS.length],
    }));
  });

  useEffect(() => {
    const timer = setTimeout(() => onDone?.(), 3400);
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
      {leaves.map(l => (
        <span
          key={l.id}
          className="leaf-fall-particle"
          style={{
            position: 'absolute',
            left: l.startX,
            top: -4,
            fontSize: l.size,
            color: l.color,
            animationDuration: `${l.duration}s`,
            animationDelay: `${l.delay}s`,
            '--leaf-dx': `${l.drift}px`,
            '--leaf-dy': `${l.fallDistance}px`,
            '--leaf-spin': `${l.spin}deg`,
          } as React.CSSProperties}
        >
          {l.char}
        </span>
      ))}
    </div>
  );
}
