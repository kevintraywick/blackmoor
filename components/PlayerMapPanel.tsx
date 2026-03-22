'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import type { PlayerMapRow, Session } from '@/lib/types';
import MapCanvas from './MapCanvas';

interface Props {
  playerId: string;
}

export default function PlayerMapPanel({ playerId: _playerId }: Props) {
  const [maps, setMaps] = useState<PlayerMapRow[]>([]);
  const [activeMapId, setActiveMapId] = useState<string | null>(null);
  const [activeMapData, setActiveMapData] = useState<PlayerMapRow | null>(null);
  const [pollStatus, setPollStatus] = useState<'live' | 'offline'>('live');
  const failCount = useRef(0);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevTiles = useRef<string>('');

  // ── Resolve current session and fetch map list ─────────────────────────────
  useEffect(() => {
    async function init() {
      try {
        const sessRes = await fetch('/api/sessions');
        if (!sessRes.ok) return;
        const sessions: Session[] = await sessRes.json();
        if (!sessions.length) return;

        // Most recently modified session = current
        const current = sessions.slice().sort((a, b) => b.last_modified - a.last_modified)[0];

        const mapsRes = await fetch(`/api/maps?session_id=${current.id}`);
        if (!mapsRes.ok) return;
        const allMaps: PlayerMapRow[] = await mapsRes.json();

        // Only show maps with ≥1 revealed tile
        const visible = allMaps.filter(m => m.revealed_tiles.length > 0);
        setMaps(visible);
        if (visible.length > 0) setActiveMapId(visible[0].id);
      } catch { /* silent */ }
    }
    init();
  }, []);

  // ── Polling ────────────────────────────────────────────────────────────────
  const poll = useCallback(async (mapId: string) => {
    try {
      const res = await fetch(`/api/maps/${mapId}/player`);
      if (!res.ok) throw new Error();
      const data: PlayerMapRow = await res.json();
      failCount.current = 0;
      setPollStatus('live');

      const newTiles = JSON.stringify(data.revealed_tiles);
      if (newTiles !== prevTiles.current) {
        prevTiles.current = newTiles;
        setActiveMapData(data);

        // Update visible tabs if new map appeared
        setMaps(prev => {
          const exists = prev.find(m => m.id === data.id);
          if (exists) {
            return prev.map(m => m.id === data.id ? data : m);
          }
          return data.revealed_tiles.length > 0 ? [...prev, data] : prev;
        });
      }
    } catch {
      failCount.current++;
      if (failCount.current >= 3) setPollStatus('offline');
    }
  }, []);

  useEffect(() => {
    if (!activeMapId) return;
    prevTiles.current = '';

    // Immediate fetch + load initial data
    fetch(`/api/maps/${activeMapId}/player`)
      .then(r => r.json())
      .then((data: PlayerMapRow) => {
        setActiveMapData(data);
        prevTiles.current = JSON.stringify(data.revealed_tiles);
      })
      .catch(() => {});

    if (pollTimer.current) clearInterval(pollTimer.current);
    pollTimer.current = setInterval(() => poll(activeMapId), 2000);
    return () => { if (pollTimer.current) clearInterval(pollTimer.current); };
  }, [activeMapId, poll]);

  // ── Render ─────────────────────────────────────────────────────────────────
  if (maps.length === 0) return null;

  return (
    <div className="bg-[#231f1c] border border-[#3d3530] rounded-md overflow-hidden mt-3">
      {/* Tab bar */}
      <div className="flex border-b border-[#3d3530] bg-[#1e1b18]">
        {maps.map(m => (
          <button
            key={m.id}
            onClick={() => setActiveMapId(m.id)}
            className={`px-3 py-1.5 text-[10px] uppercase tracking-[0.1em] border-r border-[#2a2420] transition-colors ${
              m.id === activeMapId
                ? 'text-[#c9a84c] border-b-2 border-b-[#c9a84c] bg-[#231f1c]'
                : 'text-[#6a5a50] hover:text-[#c8bfb5] hover:bg-[#1a1714]'
            }`}
          >
            {m.name}
          </button>
        ))}
      </div>

      {/* Canvas */}
      <div className="relative" style={{ height: 260 }}>
        {activeMapData ? (
          <MapCanvas
            mapData={activeMapData}
            mode="player"
            width={780}
            height={260}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-[#4a3a35] text-xs">
            Loading map…
          </div>
        )}

        {/* Live / Offline badge */}
        <div className={`absolute bottom-2 right-3 flex items-center gap-1.5 text-[9px] uppercase tracking-[0.1em] ${
          pollStatus === 'live' ? 'text-[#4a6a4a]' : 'text-[#8a6a20]'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${
            pollStatus === 'live' ? 'bg-[#4a8a4a] animate-pulse' : 'bg-[#c9a84c]'
          }`} />
          {pollStatus === 'live' ? 'Live' : '⚠ Offline'}
        </div>
      </div>
    </div>
  );
}
