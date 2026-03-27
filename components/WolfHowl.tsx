'use client';

import { useEffect } from 'react';

/**
 * Plays the wolf howl audio once per browser (per player).
 * Uses localStorage to track whether it has already played.
 */
export default function WolfHowl({ playerId }: { playerId: string }) {
  useEffect(() => {
    const key = `blackmoor-howl-${playerId}`;
    if (localStorage.getItem(key)) return;

    const audio = new Audio('/audio/wolf-howl.mp3');
    audio.volume = 0.4;
    audio.play().then(() => {
      localStorage.setItem(key, '1');
    }).catch(() => {
      // Autoplay blocked — mark as played so we don't retry every load
      // The user will hear it if they interact first next time
    });
  }, [playerId]);

  return null;
}
