'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';

const BANNER_COUNT = 5;
const ROTATE_MS = 3 * 60 * 1000; // rotate every 3 minutes

// Spread players across starting banners so they don't all show the same one
const PLAYER_ORDER = ['levi', 'jeanette', 'nicole', 'katie', 'brandon', 'ashton'];

export default function PlayerBanner({ playerId }: { playerId: string }) {
  const startIndex = PLAYER_ORDER.indexOf(playerId) % BANNER_COUNT;
  const [index, setIndex] = useState(startIndex < 0 ? 0 : startIndex);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => {
      // Fade out, swap image, fade back in
      setVisible(false);
      setTimeout(() => {
        setIndex(i => (i + 1) % BANNER_COUNT);
        setVisible(true);
      }, 600);
    }, ROTATE_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative w-full h-48 sm:h-72 overflow-hidden flex-shrink-0">
      <Image
        src={`/images/players/player_banners/player_banner_${index + 1}.png`}
        alt=""
        fill
        className={`object-cover object-center transition-opacity duration-500 ${visible ? 'opacity-100' : 'opacity-0'}`}
        priority
      />
      {/* Fade to page background at bottom */}
      <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#1a1614] to-transparent" />
    </div>
  );
}
