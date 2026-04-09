'use client';

import { useEffect, useRef } from 'react';
import type { RavenHeadlinesPayload } from '@/lib/types';

interface Props {
  playerId: string;
}

// Newsie callout: 10–20s after mount, plays an ElevenLabs-rendered audio clip
// of a barker shouting the top 3 headlines, then dispatches a custom event
// the nav listens for to start its red-pulse animation.
//
// Silent if:
//   - the player has already read the newest headline (lastReadAt >= newest)
//   - no headlines exist
//   - no MP3 has been rendered for the latest issue
//   - the audio fails to play (autoplay restrictions)
export default function NewsieCallout({ playerId }: Props) {
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    (async () => {
      try {
        const res = await fetch(`/api/raven-post/headlines?playerId=${encodeURIComponent(playerId)}`);
        if (!res.ok) return;
        const data: RavenHeadlinesPayload = await res.json();

        // Silence if there's nothing new or no audio available
        if (!data.newsie_mp3_url || !data.newest_published_at) return;
        if (data.last_read_at && data.last_read_at >= data.newest_published_at) return;

        // Schedule playback at a random offset 10–20s
        const delay = 10_000 + Math.floor(Math.random() * 10_000);
        timer = setTimeout(() => {
          if (cancelled) return;
          const audio = new Audio(data.newsie_mp3_url ?? undefined);
          audio.volume = 0.7;
          audio.play().catch(() => {
            // Autoplay blocked — silently no-op
          });
          // Dispatch the event regardless so the nav still pulses even if
          // the browser blocked the actual audio
          window.dispatchEvent(new CustomEvent('raven-post:newsie-fired'));
          firedRef.current = true;
        }, delay);
      } catch (err) {
        console.error('NewsieCallout fetch error:', err);
      }
    })();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [playerId]);

  return null;
}
