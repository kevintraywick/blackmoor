'use client';

import { useEffect, useRef } from 'react';
import { haversine } from '@/lib/geo';

interface Props {
  playerId: string;
  smsOptin: boolean;
}

const LIBRARY = { lat: 36.34289, lng: -88.85022, radius_m: 100 };

// Geolocation watch: when the player enters the library radius, fire the
// /api/raven-post/overheard/trigger endpoint. Server handles cooldown,
// queue popping, delivery recording, and SMS dispatch.
//
// Gates: only mounts a watch if smsOptin is true. Otherwise renders nothing
// (and consumes no battery).
export default function OverheardWatcher({ playerId, smsOptin }: Props) {
  const insideRef = useRef(false);
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!smsOptin) return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;

    watchIdRef.current = navigator.geolocation.watchPosition(
      ({ coords }) => {
        const dist = haversine(coords.latitude, coords.longitude, LIBRARY.lat, LIBRARY.lng);
        const inside = dist <= LIBRARY.radius_m;

        // Edge-trigger on entry. The 30-min cooldown lives server-side.
        if (inside && !insideRef.current) {
          insideRef.current = true;
          fetch('/api/raven-post/overheard/trigger', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ playerId }),
          }).catch(err => console.error('overheard trigger:', err));
        } else if (!inside && insideRef.current) {
          insideRef.current = false;
        }
      },
      err => {
        console.error('OverheardWatcher geolocation error:', err);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );

    return () => {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [playerId, smsOptin]);

  return null;
}
