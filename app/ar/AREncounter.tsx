'use client';

import { useEffect, useRef, useState } from 'react';
import Script from 'next/script';
import Link from 'next/link';
import dynamic from 'next/dynamic';

// Heavy components — loaded client-side only after the encounter triggers
const ARViewer = dynamic(() => import('./ARViewer'), {
  ssr: false,
  loading: () => (
    <div className="w-full flex items-center justify-center py-16 text-[var(--color-text-muted)] font-serif italic text-sm">
      Summoning form…
    </div>
  ),
});

const ModelViewer = dynamic(() => import('./ModelViewer'), { ssr: false });

// ---------------------------------------------------------------------------
// Spawn configuration
// Add more entries to SPAWN_POINTS as the location layer grows.
// ---------------------------------------------------------------------------
interface SpawnPoint {
  id: string;
  name: string;
  creature: string;
  lore: string;
  lat: number;
  lng: number;
  radius: number; // meters
}

const SPAWN_POINTS: SpawnPoint[] = [
  {
    id: 'hollow-oak',
    name: 'The Hollow Oak',
    creature: 'Worg Scout',
    lore: 'A shadow moves among the roots. It has been watching you for some time.',
    lat: 36.36584,
    lng: -88.85562,
    radius: 40,
  },
];

// ---------------------------------------------------------------------------
// Haversine distance — returns meters between two lat/lng pairs
// ---------------------------------------------------------------------------
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type EncounterState = 'requesting' | 'denied' | 'searching' | 'nearby' | 'revealed';

interface ActiveSpawn extends SpawnPoint {
  distance: number;
}

// ---------------------------------------------------------------------------
// Shared UI primitives
// ---------------------------------------------------------------------------
function Divider() {
  return (
    <div className="w-full flex items-center gap-3 my-6">
      <div className="flex-1 h-px bg-[var(--color-border)]" />
      <span className="text-[var(--color-gold)] text-xs">✦</span>
      <div className="flex-1 h-px bg-[var(--color-border)]" />
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[0.7rem] uppercase tracking-[0.15em] text-[var(--color-gold)] mb-4">
      {children}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Compass rose — shown while searching
// ---------------------------------------------------------------------------
function CompassRose() {
  const points = [0, 45, 90, 135, 180, 225, 270, 315];
  const cardinals: Record<number, string> = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' };

  return (
    <div className="flex items-center justify-center my-2">
      <svg
        viewBox="0 0 80 80"
        className="w-24 h-24 text-[var(--color-gold)] opacity-50"
        style={{ animation: 'compass-spin 20s linear infinite' }}
      >
        <style>{`
          @keyframes compass-spin {
            from { transform: rotate(0deg); }
            to   { transform: rotate(360deg); }
          }
        `}</style>
        <circle cx="40" cy="40" r="37" fill="none" stroke="currentColor" strokeWidth="0.5" />
        {points.map((angle) => {
          const rad = (angle * Math.PI) / 180;
          const isCardinal = angle % 90 === 0;
          const inner = isCardinal ? 18 : 28;
          const x1 = 40 + inner * Math.sin(rad);
          const y1 = 40 - inner * Math.cos(rad);
          const x2 = 40 + 34 * Math.sin(rad);
          const y2 = 40 - 34 * Math.cos(rad);
          return (
            <line
              key={angle}
              x1={x1} y1={y1} x2={x2} y2={y2}
              stroke="currentColor"
              strokeWidth={isCardinal ? 1.5 : 0.6}
            />
          );
        })}
        {Object.entries(cardinals).map(([angle, label]) => {
          const rad = (Number(angle) * Math.PI) / 180;
          const tx = 40 + 10 * Math.sin(rad);
          const ty = 40 - 10 * Math.cos(rad) + 2.5;
          return (
            <text
              key={angle}
              x={tx} y={ty}
              textAnchor="middle"
              fontSize="6"
              fill="currentColor"
              fontFamily="serif"
            >
              {label}
            </text>
          );
        })}
        <circle cx="40" cy="40" r="2.5" fill="currentColor" />
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// State screens
// ---------------------------------------------------------------------------
function RequestingState() {
  return (
    <div className="text-center">
      <SectionLabel>The Field</SectionLabel>
      <h1 className="text-3xl font-serif text-[var(--color-text)] mb-4">
        Grant the World Your Sight
      </h1>
      <Divider />
      <p className="text-[var(--color-text-body)] font-serif italic">
        Allow location access to sense what stirs nearby.
      </p>
    </div>
  );
}

function DeniedState() {
  return (
    <div className="text-center">
      <SectionLabel>The Field</SectionLabel>
      <h1 className="text-3xl font-serif text-[var(--color-text)] mb-4">
        The World Grows Silent
      </h1>
      <Divider />
      <p className="text-[var(--color-text-body)] font-serif italic mb-6">
        Location access was refused. The field cannot be read.
      </p>
      <p className="text-[var(--color-text-muted)] text-sm font-serif">
        Enable location in your browser settings and reload the page.
      </p>
    </div>
  );
}

function SearchingState() {
  return (
    <div className="text-center">
      <SectionLabel>Scanning</SectionLabel>
      <h1 className="text-3xl font-serif text-[var(--color-text)] mb-4">
        Something on the Wind
      </h1>
      <Divider />
      <CompassRose />
      <p className="text-[var(--color-text-muted)] font-serif italic mt-4 text-sm">
        Move through the area. The field will stir when something is close.
      </p>
    </div>
  );
}

interface NearbyStateProps {
  spawn: ActiveSpawn;
  revealed: boolean;
  onReveal: () => void;
}

function NearbyState({ spawn, revealed, onReveal }: NearbyStateProps) {
  return (
    <div className="w-full max-w-[500px] text-center">
      <SectionLabel>{spawn.name}</SectionLabel>
      <h1 className="text-3xl font-serif text-[var(--color-text)] mb-1">
        {spawn.creature}
      </h1>
      <p className="text-[var(--color-text-dim)] text-xs font-serif mb-1 uppercase tracking-widest">
        {spawn.distance}m
      </p>
      <Divider />

      {!revealed ? (
        <>
          <p className="text-[var(--color-text-body)] font-serif italic mb-10">
            {spawn.lore}
          </p>
          <button
            onClick={onReveal}
            className="border border-[var(--color-gold)] text-[var(--color-gold)] font-serif text-sm px-10 py-3 hover:bg-[var(--color-gold)]/10 transition-colors cursor-pointer"
          >
            Step into the Encounter
          </button>
        </>
      ) : (
        <>
          <ARViewer />
          <Divider />
          <p className="text-[0.7rem] uppercase tracking-[0.15em] text-[var(--color-text-muted)] mb-4">
            View in your world
          </p>
          <ModelViewer
            glbSrc="/models/creature.glb"
            usdzSrc="/models/creature.usdz"
          />
          <p className="text-[var(--color-text-dim)] text-xs font-serif mt-4 italic">
            Tap the AR button on the model to place {spawn.creature} in your surroundings.
          </p>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function AREncounter() {
  // Initialise to 'denied' immediately if geolocation is unavailable —
  // avoids calling setState synchronously inside an effect (lint: react-hooks/set-state-in-effect).
  const [state, setState] = useState<EncounterState>(() =>
    typeof navigator !== 'undefined' && !navigator.geolocation ? 'denied' : 'requesting'
  );
  const [activeSpawn, setActiveSpawn] = useState<ActiveSpawn | null>(null);
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    // Already marked denied during initialisation — nothing to set up.
    if (state === 'denied') return;

    watchIdRef.current = navigator.geolocation.watchPosition(
      ({ coords }) => {
        const { latitude, longitude } = coords;

        for (const spawn of SPAWN_POINTS) {
          const dist = haversine(latitude, longitude, spawn.lat, spawn.lng);
          if (dist <= spawn.radius) {
            setActiveSpawn({ ...spawn, distance: Math.round(dist) });
            // Don't collapse the revealed state when GPS ticks again
            setState((prev) => (prev === 'revealed' ? 'revealed' : 'nearby'));
            return;
          }
        }

        // Out of range — preserve the encounter if the player has already revealed it
        setState((prev) => (prev === 'revealed' ? 'revealed' : 'searching'));
      },
      () => setState('denied'),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      {/* model-viewer script — loads lazily, only needed if the encounter is revealed */}
      <Script
        src="https://ajax.googleapis.com/ajax/libs/model-viewer/3.4.0/model-viewer.min.js"
        strategy="lazyOnload"
      />

      <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)] font-serif flex flex-col">
        <nav className="sticky top-0 bg-[var(--color-bg)]/95 backdrop-blur border-b border-[var(--color-border)] px-6 py-2.5 flex items-center gap-3 text-sm z-10">
          <Link
            href="/"
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors no-underline flex items-center gap-1"
          >
            <svg
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-3.5 h-3.5"
            >
              <path d="M10 3L5 8l5 5" />
            </svg>
            Home
          </Link>
          <span className="text-[var(--color-gold)]">The Field</span>
        </nav>

        <div className="flex-1 flex flex-col items-center justify-center px-6 py-16 max-w-[860px] mx-auto w-full">
          {state === 'requesting' && <RequestingState />}
          {state === 'denied'    && <DeniedState />}
          {state === 'searching' && <SearchingState />}
          {(state === 'nearby' || state === 'revealed') && activeSpawn && (
            <NearbyState
              spawn={activeSpawn}
              revealed={state === 'revealed'}
              onReveal={() => setState('revealed')}
            />
          )}
        </div>
      </div>
    </>
  );
}
