'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import PlayerBannerWeather from './PlayerBannerWeather';
import AmbientCirclesData from './AmbientCirclesData';

const ROTATE_MS = 3 * 60 * 1000; // rotate every 3 minutes

// Spread players across starting banners so they don't all show the same one
const PLAYER_ORDER = ['levi', 'jeanette', 'nicole', 'katie', 'brandon', 'ashton'];

export default function PlayerBanner({ playerId }: { playerId: string }) {
  const [banners, setBanners] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  // Load the current list of banner images on mount. New files dropped
  // into the folder automatically join the rotation on next page load.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/banners/players');
        if (!res.ok) return;
        const data = (await res.json()) as { images: string[] };
        if (!alive || data.images.length === 0) return;
        const orderIdx = PLAYER_ORDER.indexOf(playerId);
        const start = orderIdx < 0 ? 0 : orderIdx % data.images.length;
        setBanners(data.images);
        setIndex(start);
      } catch {
        /* ignore — falls through to empty state (no banner rendered) */
      }
    })();
    return () => {
      alive = false;
    };
  }, [playerId]);

  useEffect(() => {
    if (banners.length <= 1) return;
    const timer = setInterval(() => {
      // Fade out, swap image, fade back in
      setVisible(false);
      setTimeout(() => {
        setIndex((i) => (i + 1) % banners.length);
        setVisible(true);
      }, 600);
    }, ROTATE_MS);
    return () => clearInterval(timer);
  }, [banners.length]);

  const circles = (
    <>
      <div className="hidden sm:block" style={{ position: 'absolute', top: 72, right: 16 }}>
        <AmbientCirclesData playerId={playerId} size={52} />
      </div>
      <div className="block sm:hidden" style={{ position: 'absolute', top: 48, right: 10 }}>
        <AmbientCirclesData playerId={playerId} size={36} />
      </div>
    </>
  );

  if (banners.length === 0) {
    return (
      <div className="relative w-full h-48 sm:h-72 overflow-hidden flex-shrink-0">
        <PlayerBannerWeather playerId={playerId} />
        {circles}
      </div>
    );
  }

  return (
    <div className="relative w-full h-48 sm:h-72 overflow-hidden flex-shrink-0">
      <Image
        src={banners[index]}
        alt=""
        fill
        className={`object-cover object-center transition-opacity duration-500 ${visible ? 'opacity-100' : 'opacity-0'}`}
        priority
      />
      <PlayerBannerWeather playerId={playerId} />
      {circles}
    </div>
  );
}
