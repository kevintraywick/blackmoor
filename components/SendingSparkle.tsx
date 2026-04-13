'use client';

import { useEffect, useState } from 'react';

interface Particle {
  id: number;
  x: number;
  y: number;
  char: string;
  color: string;
  size: number;
  dx: number;      // horizontal drift px
  dy: number;      // vertical rise px (negative = up)
  duration: number; // seconds
  delay: number;    // seconds
}

const CHARS = ['✦', '✧', '·', '✦', '·', '✧', '✦', '·'];
const COLORS = [
  '#c4a8d0', // soft purple (sending theme)
  '#d4bce0', // lighter purple
  '#c9a84c', // gold
  '#e8dcc8', // warm white
  '#ffffff', // pure white
  '#a888c0', // deeper purple
  '#dcd0a8', // pale gold
];

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

export default function SendingSparkle({
  x,
  y,
  onDone,
}: {
  x: number;
  y: number;
  onDone?: () => void;
}) {
  const [particles] = useState<Particle[]>(() => {
    const count = 40;
    return Array.from({ length: count }, (_, i) => {
      // Fountain shape: mostly upward, spread horizontally
      const angle = rand(-0.9, -2.25); // radians, biased upward
      const speed = rand(60, 180);
      return {
        id: i,
        x: rand(-8, 8),
        y: rand(-4, 4),
        char: CHARS[i % CHARS.length],
        color: COLORS[i % COLORS.length],
        size: rand(8, 18),
        dx: Math.cos(angle) * speed,
        dy: Math.sin(angle) * speed,
        duration: rand(1.0, 2.2),
        delay: rand(0, 0.15),
      };
    });
  });

  useEffect(() => {
    const timer = setTimeout(() => onDone?.(), 2500);
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
      {particles.map(p => (
        <span
          key={p.id}
          className="sending-sparkle-particle"
          style={{
            position: 'absolute',
            left: p.x,
            top: p.y,
            fontSize: p.size,
            color: p.color,
            textShadow: `0 0 6px ${p.color}`,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
            // CSS variables for the keyframe endpoints
            '--sparkle-dx': `${p.dx}px`,
            '--sparkle-dy': `${p.dy}px`,
          } as React.CSSProperties}
        >
          {p.char}
        </span>
      ))}
    </div>
  );
}
