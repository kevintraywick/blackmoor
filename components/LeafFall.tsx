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

// Simple, high-contrast shapes that read well while spinning.
// Clover + pink petal + yellow blossom, with two mystical flourishes.
const CHARS = ['🍀', '🌸', '🌼', '🍀', '🌸', '✨', '💫', '🌼'];
const COLORS = ['#ffffff']; // unused for emoji; kept so typing stays intact

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
    const count = 28;
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      startX: rand(-30, 30),
      size: rand(14, 26),
      fallDistance: rand(180, 360),
      drift: rand(-160, 160),
      spin: rand(-720, 720),
      duration: rand(2.2, 3.8),
      delay: rand(0, 1.0),
      char: CHARS[i % CHARS.length],
      color: COLORS[i % COLORS.length],
    }));
  });

  useEffect(() => {
    const timer = setTimeout(() => onDone?.(), 5200);
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
