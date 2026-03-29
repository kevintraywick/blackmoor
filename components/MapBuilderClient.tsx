'use client';

import { useState, useCallback, useRef } from 'react';
import BuilderCanvas, { packKey } from '@/components/BuilderCanvas';
import type { BuilderTool } from '@/components/BuilderCanvas';
import type { MapBuild, MapBuildLevel, TileState } from '@/lib/types';

interface Props {
  initialBuilds: MapBuild[];
}

const HEX_SIZE = 12; // world-space hex radius in px

const TOOLS: { key: BuilderTool; label: string; shortcut: string }[] = [
  { key: 'activate', label: 'Activate', shortcut: 'A' },
  { key: 'select',   label: 'Select',   shortcut: 'S' },
  { key: 'pan',      label: 'Pan',      shortcut: 'P' },
];

export default function MapBuilderClient({ initialBuilds }: Props) {
  const [builds, setBuilds] = useState<MapBuild[]>(initialBuilds);
  const [activeBuildId, setActiveBuildId] = useState<string | null>(null);
  const [levels, setLevels] = useState<MapBuildLevel[]>([]);
  const [activeLevelId, setActiveLevelId] = useState<string | null>(null);
  const [tool, setTool] = useState<BuilderTool>('activate');
  const [tiles, setTiles] = useState<Map<number, TileState>>(new Map());
  const [saving, setSaving] = useState(false);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // ── Load a build ───────────────────────────────────────────────────────────
  async function loadBuild(buildId: string) {
    const res = await fetch(`/api/map-builder/${buildId}`);
    const data = await res.json();
    setActiveBuildId(buildId);
    setLevels(data.levels ?? []);
    const firstLevel = data.levels?.[0];
    if (firstLevel) {
      setActiveLevelId(firstLevel.id);
      loadLevelTiles(firstLevel);
    }
  }

  function loadLevelTiles(level: MapBuildLevel) {
    const map = new Map<number, TileState>();
    if (level.tiles && typeof level.tiles === 'object') {
      for (const [key, val] of Object.entries(level.tiles)) {
        const [c, r] = key.split(',').map(Number);
        map.set(packKey(c, r), val as TileState);
      }
    }
    setTiles(map);
  }

  // ── Create a new build ─────────────────────────────────────────────────────
  async function createBuild() {
    const res = await fetch('/api/map-builder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Untitled Map' }),
    });
    const data = await res.json();
    setBuilds(prev => [data, ...prev]);
    loadBuild(data.id);
  }

  // ── Save tiles (debounced) ─────────────────────────────────────────────────
  const saveTiles = useCallback((newTiles: Map<number, TileState>) => {
    if (!activeBuildId || !activeLevelId) return;
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      setSaving(true);
      const tilesObj: Record<string, TileState> = {};
      newTiles.forEach((val, key) => {
        const col = Math.floor(key / 10000);
        const row = key % 10000;
        tilesObj[`${col},${row}`] = val;
      });
      await fetch(`/api/map-builder/${activeBuildId}/levels/${activeLevelId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tiles: tilesObj }),
      });
      setSaving(false);
    }, 500);
  }, [activeBuildId, activeLevelId]);

  // ── Tile click handler ─────────────────────────────────────────────────────
  const lastDragTile = useRef<number | null>(null);

  function handleTileClick(col: number, row: number, isDrag: boolean) {
    const key = packKey(col, row);

    // Skip if drag hits same tile
    if (isDrag && lastDragTile.current === key) return;
    lastDragTile.current = isDrag ? key : null;

    setTiles(prev => {
      const next = new Map(prev);
      if (isDrag) {
        // Drag always activates
        next.set(key, { active: true });
      } else {
        // Click toggles
        const existing = next.get(key);
        if (existing?.active) {
          next.delete(key);
        } else {
          next.set(key, { active: true });
        }
      }
      saveTiles(next);
      return next;
    });
  }

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'a' || e.key === 'A') setTool('activate');
    else if (e.key === 's' || e.key === 'S') setTool('select');
    else if (e.key === 'p' || e.key === 'P') setTool('pan');
    else if (e.key === 'Escape') setTool('activate');
  }

  // ── Switch level ───────────────────────────────────────────────────────────
  function switchLevel(levelId: string) {
    const level = levels.find(l => l.id === levelId);
    if (!level) return;
    setActiveLevelId(levelId);
    loadLevelTiles(level);
  }

  // ── Add level ──────────────────────────────────────────────────────────────
  async function addLevel() {
    if (!activeBuildId) return;
    const res = await fetch(`/api/map-builder/${activeBuildId}/levels`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: `Level ${levels.length + 1}` }),
    });
    const level = await res.json();
    setLevels(prev => [...prev, level]);
    switchLevel(level.id);
  }

  const activeLevel = levels.find(l => l.id === activeLevelId);

  // ── No build selected: show build list ─────────────────────────────────────
  if (!activeBuildId) {
    return (
      <div className="max-w-[1000px] mx-auto px-8 py-12">
        <h1 className="font-serif text-[2rem] italic text-[var(--color-text)] leading-none tracking-tight">Map Builder</h1>
        <p className="text-[0.65rem] uppercase tracking-[0.22em] text-[var(--color-text-muted)] mt-1.5 mb-6">
          Hex Grid Editor
        </p>

        <div className="flex gap-3 flex-wrap mb-8">
          <button
            onClick={createBuild}
            className="px-4 py-2 text-sm font-serif border border-dashed border-[var(--color-gold)] text-[var(--color-gold)] rounded hover:bg-[var(--color-gold)]/10 transition-colors"
          >
            + New Map
          </button>
        </div>

        {builds.length === 0 && (
          <p className="text-[0.88rem] italic text-[var(--color-text-dim)]">No maps yet. Create one to get started.</p>
        )}

        <div className="grid gap-3">
          {builds.map(b => (
            <button
              key={b.id}
              onClick={() => loadBuild(b.id)}
              className="text-left px-4 py-3 border border-[var(--color-border)] rounded bg-[var(--color-surface)] hover:border-[var(--color-gold)] transition-colors"
            >
              <span className="font-serif text-[var(--color-text)]">{b.name || 'Untitled Map'}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Build editor view ──────────────────────────────────────────────────────
  return (
    <div
      className="flex flex-col"
      style={{ height: 'calc(100vh - 45px)' }}
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {/* Toolbar row */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        {/* Back button */}
        <button
          onClick={() => { setActiveBuildId(null); setActiveLevelId(null); setTiles(new Map()); }}
          className="text-[0.75rem] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 inline-block -mt-px mr-1"><path d="M10 3L5 8l5 5" /></svg>
          All Maps
        </button>

        <div className="w-px h-5 bg-[var(--color-border)]" />

        {/* Tool buttons */}
        {TOOLS.map(t => (
          <button
            key={t.key}
            onClick={() => setTool(t.key)}
            className={`px-3 py-1 text-[0.75rem] rounded border transition-colors font-serif ${
              tool === t.key
                ? 'border-[var(--color-gold)] text-[var(--color-gold)] bg-[var(--color-gold)]/10'
                : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-text-muted)]'
            }`}
            title={`${t.label} (${t.shortcut})`}
          >
            {t.label}
          </button>
        ))}

        <div className="flex-1" />

        {/* Save indicator */}
        {saving && <span className="text-[0.65rem] text-[var(--color-text-muted)]">Saving...</span>}

        {/* Level tabs */}
        <div className="flex items-center gap-1.5">
          {levels.map(l => (
            <button
              key={l.id}
              onClick={() => switchLevel(l.id)}
              className={`px-2.5 py-1 text-[0.72rem] rounded font-serif transition-colors ${
                l.id === activeLevelId
                  ? 'bg-[var(--color-gold)]/15 text-[var(--color-gold)] border border-[var(--color-gold)]/40'
                  : 'text-[var(--color-text-muted)] border border-[var(--color-border)] hover:border-[var(--color-text-muted)]'
              }`}
            >
              {l.name}
            </button>
          ))}
          <button
            onClick={addLevel}
            className="px-2 py-1 text-[0.72rem] text-[var(--color-text-dim)] border border-dashed border-[var(--color-border)] rounded hover:border-[var(--color-text-muted)] hover:text-[var(--color-text-muted)] transition-colors"
          >
            +
          </button>
        </div>
      </div>

      {/* Canvas area */}
      <div className="flex-1 relative overflow-hidden bg-[#12100e]">
        {activeLevel && (
          <BuilderCanvas
            cols={activeLevel.cols}
            rows={activeLevel.rows}
            hexSize={HEX_SIZE}
            tiles={tiles}
            activeTool={tool}
            onTileClick={tool === 'activate' ? handleTileClick : undefined}
          />
        )}
      </div>
    </div>
  );
}
