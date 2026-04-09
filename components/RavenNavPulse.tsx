'use client';

import { useEffect } from 'react';

// Listens for the 'raven-post:newsie-fired' event dispatched by NewsieCallout
// and runs the pulse animation on the #raven-post-nav-link element.
//
// Timeline:
//   0–10s   — bright red pulse at full intensity
//   10–40s  — fade back to normal over 30s via the raven-link-pulse-fade class
//   40s+    — class removed, link back to default styling
export default function RavenNavPulse() {
  useEffect(() => {
    function onFire() {
      const link = document.getElementById('raven-post-nav-link');
      if (!link) return;

      // Apply pulse class for 10s
      link.classList.add('raven-link-pulse');
      const offTimer = setTimeout(() => {
        link.classList.remove('raven-link-pulse');
        link.classList.add('raven-link-pulse-fade');
        const cleanupTimer = setTimeout(() => {
          link.classList.remove('raven-link-pulse-fade');
        }, 30_000);
        (link as HTMLElement & { _ravenCleanup?: number })._ravenCleanup =
          cleanupTimer as unknown as number;
      }, 10_000);
      (link as HTMLElement & { _ravenOffTimer?: number })._ravenOffTimer =
        offTimer as unknown as number;
    }
    window.addEventListener('raven-post:newsie-fired', onFire);
    return () => window.removeEventListener('raven-post:newsie-fired', onFire);
  }, []);

  return null;
}
