'use client';

import { useState, useCallback, useRef } from 'react';
import BuilderCanvas, { packKey } from '@/components/BuilderCanvas';
import type { BuilderTool } from '@/components/BuilderCanvas';
import type { MapBuild, MapBuildLevel, MapBuildBookmark, TileState } from '@/lib/types';
import { useUndoRedo } from '@/lib/useUndoRedo';

interface Props {
  initialBuilds: MapBuild[];
}

const HEX_SIZE = 120; // world-space hex radius in px

const MODES: { key: BuilderTool; label: string; shortcut: string; color: string; activeColor: string }[] = [
  { key: 'build',    label: 'Build',    shortcut: 'B', color: 'border-[#4a7aaa] text-[#6aafef]', activeColor: 'border-[#4a7aaa] text-white bg-[#4a7aaa]' },
  { key: 'select',   label: 'Select',   shortcut: 'S', color: 'border-white/30 text-white/70',   activeColor: 'border-white/60 text-white bg-white/10' },
  { key: 'visible',  label: 'Visible',  shortcut: 'V', color: 'border-white/30 text-white/70',   activeColor: 'border-white/60 text-white bg-white/10' },
  { key: 'obscure',  label: 'Obscure',  shortcut: 'O', color: 'border-[#b8a24a]/50 text-[#d4c25a]', activeColor: 'border-[#b8a24a] text-[#d4c25a] bg-[#b8a24a]/15' },
  { key: 'print',    label: 'Print',    shortcut: 'R', color: 'border-[#c07a8a]/40 text-[#d08a9a]', activeColor: 'border-[#c07a8a] text-[#d08a9a] bg-[#c07a8a]/15' },
];

export default function MapBuilderClient({ initialBuilds }: Props) {
  const [builds, setBuilds] = useState<MapBuild[]>(initialBuilds);
  const [activeBuildId, setActiveBuildId] = useState<string | null>(null);
  const [levels, setLevels] = useState<MapBuildLevel[]>([]);
  const [activeLevelId, setActiveLevelId] = useState<string | null>(null);
  const [tool, setTool] = useState<BuilderTool>('build');
  const [tiles, setTiles] = useState<Map<number, TileState>>(new Map());
  const [saving, setSaving] = useState(false);

  // Image overlay state
  const [overlay, setOverlay] = useState<{
    image_path: string;
    base64: string;
    media_type: string;
    width_meters: number;
    height_meters: number;
    confidence: string;
    analyzing: boolean;
  } | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // Bookmarks
  const [bookmarks, setBookmarks] = useState<MapBuildBookmark[]>([]);
  const [bookmarkName, setBookmarkName] = useState('');

  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const { push: pushUndo, undo, redo } = useUndoRedo();
  const [editingLevelName, setEditingLevelName] = useState<string | null>(null);
  const [levelNameDraft, setLevelNameDraft] = useState('');

  // New map dialog
  const [showNewMapDialog, setShowNewMapDialog] = useState(false);
  const [newMapName, setNewMapName] = useState('');

  // Rename build on home page
  const [editingBuildName, setEditingBuildName] = useState<string | null>(null);
  const [buildNameDraft, setBuildNameDraft] = useState('');

  // ── Load a build ───────────────────────────────────────────────────────────
  async function loadBuild(buildId: string) {
    const [buildRes, bookmarkRes] = await Promise.all([
      fetch(`/api/map-builder/${buildId}`),
      fetch(`/api/map-builder/${buildId}/bookmarks`),
    ]);
    const data = await buildRes.json();
    const bookmarkData = await bookmarkRes.json();
    setActiveBuildId(buildId);
    setLevels(data.levels ?? []);
    setBookmarks(Array.isArray(bookmarkData) ? bookmarkData : []);
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
  async function createBuild(name: string) {
    const res = await fetch('/api/map-builder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    setBuilds(prev => [data, ...prev]);
    loadBuild(data.id);
  }

  async function renameBuild(buildId: string, name: string) {
    const trimmed = name.trim();
    if (!trimmed) { setEditingBuildName(null); return; }
    setBuilds(prev => prev.map(b => b.id === buildId ? { ...b, name: trimmed } : b));
    setEditingBuildName(null);
    await fetch(`/api/map-builder/${buildId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: trimmed }),
    });
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

  // ── Tile click handler with undo support ─────────────────────────────────
  const lastDragTile = useRef<number | null>(null);
  const dragStroke = useRef<{ key: number; wasActive: boolean }[]>([]);

  function handleTileClick(col: number, row: number, isDrag: boolean) {
    const key = packKey(col, row);

    // Skip if drag hits same tile
    if (isDrag && lastDragTile.current === key) return;
    lastDragTile.current = isDrag ? key : null;

    setTiles(prev => {
      const next = new Map(prev);
      const existing = next.get(key);

      if (tool === 'build') {
        if (isDrag) {
          const wasActive = existing?.active ?? false;
          next.set(key, { ...existing, active: true });
          dragStroke.current.push({ key, wasActive });
        } else {
          finalizeDragStroke();
          const wasActive = existing?.active ?? false;
          if (wasActive) {
            next.delete(key);
          } else {
            next.set(key, { ...existing, active: true });
          }
          pushUndo({
            apply: () => setTiles(p => { const n = new Map(p); if (wasActive) n.delete(key); else n.set(key, { ...n.get(key), active: true }); saveTiles(n); return n; }),
            reverse: () => setTiles(p => { const n = new Map(p); if (wasActive) n.set(key, { ...n.get(key), active: true }); else n.delete(key); saveTiles(n); return n; }),
          });
        }
      } else if (tool === 'visible') {
        if (!existing?.active) { saveTiles(next); return next; } // can only activate built tiles
        const wasVisible = existing.visible ?? false;
        const newState = isDrag ? true : !wasVisible;
        next.set(key, { ...existing, visible: newState });
        if (!isDrag) {
          pushUndo({
            apply: () => setTiles(p => { const n = new Map(p); const e = n.get(key); if (e) n.set(key, { ...e, visible: newState }); saveTiles(n); return n; }),
            reverse: () => setTiles(p => { const n = new Map(p); const e = n.get(key); if (e) n.set(key, { ...e, visible: wasVisible }); saveTiles(n); return n; }),
          });
        }
      } else if (tool === 'obscure') {
        if (!existing?.visible) { saveTiles(next); return next; } // can only obscure visible tiles
        const wasObscured = existing.obscured ?? false;
        const newState = isDrag ? true : !wasObscured;
        next.set(key, { ...existing, obscured: newState });
        if (!isDrag) {
          pushUndo({
            apply: () => setTiles(p => { const n = new Map(p); const e = n.get(key); if (e) n.set(key, { ...e, obscured: newState }); saveTiles(n); return n; }),
            reverse: () => setTiles(p => { const n = new Map(p); const e = n.get(key); if (e) n.set(key, { ...e, obscured: wasObscured }); saveTiles(n); return n; }),
          });
        }
      }

      saveTiles(next);
      return next;
    });
  }

  function finalizeDragStroke() {
    const stroke = dragStroke.current;
    if (stroke.length === 0) return;
    const copy = [...stroke];
    dragStroke.current = [];
    pushUndo({
      apply: () => setTiles(p => {
        const n = new Map(p);
        for (const { key } of copy) n.set(key, { active: true });
        saveTiles(n);
        return n;
      }),
      reverse: () => setTiles(p => {
        const n = new Map(p);
        for (const { key, wasActive } of copy) {
          if (wasActive) n.set(key, { active: true }); else n.delete(key);
        }
        saveTiles(n);
        return n;
      }),
    });
  }

  function handlePointerUp() {
    finalizeDragStroke();
  }

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  function handleKeyDown(e: React.KeyboardEvent) {
    // Don't capture shortcuts when editing level name
    if (editingLevelName) return;

    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
    if (mod && e.key === 'z' && e.shiftKey) { e.preventDefault(); redo(); return; }
    if (mod && e.key === 'Z') { e.preventDefault(); redo(); return; }

    if (e.key === 'b' || e.key === 'B') setTool('build');
    else if (e.key === 's' || e.key === 'S') setTool('select');
    else if (e.key === 'v' || e.key === 'V') setTool('visible');
    else if (e.key === 'o' || e.key === 'O') setTool('obscure');
    else if (e.key === 'Escape') setTool('build');
  }

  // ── Switch level ───────────────────────────────────────────────────────────
  function switchLevel(levelId: string) {
    const level = levels.find(l => l.id === levelId);
    if (!level) return;
    setActiveLevelId(levelId);
    loadLevelTiles(level);
  }

  // ── Rename level ────────────────────────────────────────────────────────────
  async function renameLevel(levelId: string, newName: string) {
    if (!activeBuildId || !newName.trim()) return;
    await fetch(`/api/map-builder/${activeBuildId}/levels/${levelId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim() }),
    });
    setLevels(prev => prev.map(l => l.id === levelId ? { ...l, name: newName.trim() } : l));
    setEditingLevelName(null);
  }

  // ── Delete level ───────────────────────────────────────────────────────────
  async function deleteLevel(levelId: string) {
    if (!activeBuildId || levels.length <= 1) return;
    await fetch(`/api/map-builder/${activeBuildId}/levels/${levelId}`, { method: 'DELETE' });
    const remaining = levels.filter(l => l.id !== levelId);
    setLevels(remaining);
    if (activeLevelId === levelId && remaining.length > 0) {
      switchLevel(remaining[0].id);
    }
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

  // ── Image drop handler ──────────────────────────────────────────────────────
  async function handleImageDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (overlay) return; // one overlay at a time
    if (!activeBuildId) return;

    const file = e.dataTransfer.files[0];
    if (!file || !file.type.startsWith('image/')) return;

    // Upload
    const formData = new FormData();
    formData.append('file', file);
    const uploadRes = await fetch(`/api/map-builder/${activeBuildId}/image`, {
      method: 'POST',
      body: formData,
    });
    const uploadData = await uploadRes.json();
    if (!uploadData.ok) return;

    setOverlay({
      image_path: uploadData.image_path,
      base64: uploadData.base64,
      media_type: uploadData.media_type,
      width_meters: 30,
      height_meters: 30,
      confidence: '',
      analyzing: true,
    });

    // Skip AI analysis for now — use defaults
    setOverlay(prev => prev ? {
      ...prev,
      analyzing: false,
    } : null);
  }

  function commitOverlay() {
    if (!overlay || !activeBuildId || !activeLevelId) return;
    // For now, store the image reference in the level's images array
    const newImage = {
      id: crypto.randomUUID(),
      image_path: overlay.image_path,
      x: 0,
      y: 0,
      width: overlay.width_meters,
      height: overlay.height_meters,
    };
    fetch(`/api/map-builder/${activeBuildId}/levels/${activeLevelId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ images: [...(activeLevel?.images ?? []), newImage] }),
    });
    setOverlay(null);
  }

  function cancelOverlay() {
    setOverlay(null);
  }

  // ── Bookmarks ──────────────────────────────────────────────────────────────
  async function saveBookmark() {
    if (!activeBuildId || !bookmarkName.trim()) return;
    // Snapshot: current levels with their tiles
    const snapshot = levels.map(l => ({
      id: l.id,
      name: l.name,
      tiles: l.id === activeLevelId ? Object.fromEntries(
        Array.from(tiles.entries()).map(([k, v]) => {
          const col = Math.floor(k / 10000);
          const row = k % 10000;
          return [`${col},${row}`, v];
        })
      ) : l.tiles,
      assets: l.assets,
      images: l.images,
    }));

    const res = await fetch(`/api/map-builder/${activeBuildId}/bookmarks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: bookmarkName.trim(), snapshot }),
    });
    const bookmark = await res.json();
    setBookmarks(prev => [bookmark, ...prev]);
    setBookmarkName('');
  }

  async function restoreBookmark(bookmark: MapBuildBookmark) {
    if (!Array.isArray(bookmark.snapshot)) return;
    // Push current state to undo
    const prevLevels = [...levels];
    const prevTiles = new Map(tiles);

    const snap = bookmark.snapshot as Array<{ id: string; name: string; tiles: Record<string, TileState>; assets: unknown[]; images: unknown[] }>;
    setLevels(prev => prev.map(l => {
      const s = snap.find(s => s.id === l.id);
      return s ? { ...l, name: s.name, tiles: s.tiles, assets: s.assets as MapBuildLevel['assets'], images: s.images as MapBuildLevel['images'] } : l;
    }));

    // Reload current level tiles
    const currentSnap = snap.find(s => s.id === activeLevelId);
    if (currentSnap) {
      const map = new Map<number, TileState>();
      for (const [key, val] of Object.entries(currentSnap.tiles)) {
        const [c, r] = key.split(',').map(Number);
        map.set(packKey(c, r), val);
      }
      setTiles(map);
      saveTiles(map);
    }

    pushUndo({
      apply: () => restoreBookmark(bookmark),
      reverse: () => {
        setLevels(prevLevels);
        setTiles(prevTiles);
        saveTiles(prevTiles);
      },
    });
  }

  async function deleteBookmark(bookmarkId: string) {
    if (!activeBuildId) return;
    await fetch(`/api/map-builder/${activeBuildId}/bookmarks/${bookmarkId}`, { method: 'DELETE' });
    setBookmarks(prev => prev.filter(b => b.id !== bookmarkId));
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

        <div className="flex gap-4 flex-wrap">
          {/* New map card */}
          {showNewMapDialog ? (
            <div className="w-[200px] h-[200px] border-2 border-[var(--color-gold)] rounded bg-[var(--color-surface)] flex flex-col items-center justify-center gap-3 p-4">
              <span className="text-[0.65rem] uppercase tracking-[0.15em] text-[var(--color-gold)] font-sans">New Map</span>
              <input
                autoFocus
                value={newMapName}
                onChange={e => setNewMapName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && newMapName.trim()) {
                    createBuild(newMapName.trim());
                    setShowNewMapDialog(false);
                    setNewMapName('');
                  }
                  if (e.key === 'Escape') { setShowNewMapDialog(false); setNewMapName(''); }
                }}
                placeholder="Map name…"
                className="w-full bg-transparent border-b border-[var(--color-border)] text-[var(--color-text)] font-serif text-sm text-center outline-none focus:border-[var(--color-gold)] placeholder:text-[var(--color-text-dim)]"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => { setShowNewMapDialog(false); setNewMapName(''); }}
                  className="px-3 py-1 text-[0.7rem] font-serif text-[var(--color-text-muted)] border border-[var(--color-border)] rounded hover:border-[var(--color-text-muted)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (!newMapName.trim()) return;
                    createBuild(newMapName.trim());
                    setShowNewMapDialog(false);
                    setNewMapName('');
                  }}
                  className="px-3 py-1 text-[0.7rem] font-serif text-[var(--color-gold)] border border-[var(--color-gold)]/40 rounded hover:bg-[var(--color-gold)]/10 transition-colors"
                >
                  Create
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowNewMapDialog(true)}
              className="w-[200px] h-[200px] border-2 border-dashed border-[var(--color-border)] rounded flex flex-col items-center justify-center gap-2 text-[var(--color-text-dim)] hover:border-[var(--color-gold)] hover:text-[var(--color-gold)] transition-colors"
            >
              <span className="text-3xl leading-none">+</span>
              <span className="text-[0.65rem] uppercase tracking-[0.15em] font-sans">New Map</span>
            </button>
          )}

          {/* Existing map cards */}
          {builds.map(b => (
            <div
              key={b.id}
              className="w-[200px] h-[200px] border border-[var(--color-border)] rounded bg-[var(--color-surface)] hover:border-[var(--color-gold)] transition-colors cursor-pointer flex flex-col overflow-hidden"
            >
              <div
                className="h-[164px] flex items-center justify-center"
                onClick={() => loadBuild(b.id)}
              >
                <span className="text-4xl opacity-20">🗺</span>
              </div>
              <div className="h-[36px] border-t border-[var(--color-border)] px-3 flex items-center">
                {editingBuildName === b.id ? (
                  <input
                    autoFocus
                    value={buildNameDraft}
                    onChange={e => setBuildNameDraft(e.target.value)}
                    onBlur={() => renameBuild(b.id, buildNameDraft)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') renameBuild(b.id, buildNameDraft);
                      if (e.key === 'Escape') setEditingBuildName(null);
                    }}
                    className="w-full bg-transparent border-b border-[var(--color-gold)] text-[var(--color-text)] font-serif text-sm outline-none"
                  />
                ) : (
                  <span
                    className="font-serif text-sm text-[var(--color-text)] block truncate"
                    onDoubleClick={() => { setEditingBuildName(b.id); setBuildNameDraft(b.name || ''); }}
                    title="Double-click to rename"
                  >
                    {b.name || 'Untitled Map'}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {builds.length === 0 && !showNewMapDialog && (
          <p className="text-[0.88rem] italic text-[var(--color-text-dim)] mt-6">No maps yet. Create one to get started.</p>
        )}
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

        <div className="flex-1" />

        {/* Mode buttons — center-aligned */}
        {MODES.map(m => (
          <button
            key={m.key}
            onClick={() => setTool(m.key)}
            disabled={m.key === 'print'}
            className={`px-4 py-1.5 text-[1rem] rounded border transition-colors font-serif ${
              tool === m.key ? m.activeColor : `${m.color} hover:opacity-100 opacity-70`
            } ${m.key === 'print' ? 'opacity-40 cursor-not-allowed' : ''}`}
            title={`${m.label} (${m.shortcut})${m.key === 'print' ? ' — coming soon' : ''}`}
          >
            {m.label}
          </button>
        ))}

        <div className="flex-1" />

        {/* Save indicator */}
        {saving && <span className="text-[0.65rem] text-[var(--color-text-muted)]">Saving...</span>}

        {/* Level tabs — double-click to rename */}
        <div className="flex items-center gap-1.5">
          {levels.map(l => (
            editingLevelName === l.id ? (
              <input
                key={l.id}
                autoFocus
                value={levelNameDraft}
                onChange={e => setLevelNameDraft(e.target.value)}
                onBlur={() => renameLevel(l.id, levelNameDraft)}
                onKeyDown={e => { if (e.key === 'Enter') renameLevel(l.id, levelNameDraft); if (e.key === 'Escape') setEditingLevelName(null); }}
                className="px-3 py-1.5 text-[0.92rem] rounded font-serif bg-[var(--color-surface-raised)] border border-[var(--color-gold)] text-white outline-none w-32"
              />
            ) : (
              <button
                key={l.id}
                onClick={() => switchLevel(l.id)}
                onDoubleClick={() => { setEditingLevelName(l.id); setLevelNameDraft(l.name); }}
                className={`px-3 py-1.5 text-[0.92rem] rounded font-serif transition-colors ${
                  l.id === activeLevelId
                    ? 'bg-[var(--color-gold)]/15 text-white border border-[var(--color-gold)]/40'
                    : 'text-white/70 border border-[var(--color-border)] hover:border-[var(--color-text-muted)] hover:text-white'
                }`}
                title="Double-click to rename"
              >
                {l.name}
              </button>
            )
          ))}
          <button
            onClick={addLevel}
            className="px-3 py-1.5 text-[0.92rem] text-white/40 border border-dashed border-[var(--color-border)] rounded hover:border-[var(--color-text-muted)] hover:text-white/70 transition-colors"
          >
            +
          </button>
        </div>
      </div>

      {/* Bookmark bar */}
      <div className="flex items-center gap-2 px-4 py-1.5 border-b border-[var(--color-border)] bg-[var(--color-surface)] text-[0.7rem]">
        <span className="text-[0.6rem] uppercase tracking-[0.15em] text-white/50">Bookmarks</span>
        {bookmarks.map(b => (
          <button
            key={b.id}
            onClick={() => restoreBookmark(b)}
            className="px-2 py-0.5 text-white/70 border border-[var(--color-border)] rounded hover:border-[var(--color-gold)] hover:text-white transition-colors font-serif group relative"
          >
            {b.name}
            <span
              onClick={e => { e.stopPropagation(); deleteBookmark(b.id); }}
              className="ml-1.5 text-[0.55rem] text-[var(--color-text-dim)] hover:text-[#8a3a3a] cursor-pointer"
            >
              x
            </span>
          </button>
        ))}
        <input
          value={bookmarkName}
          onChange={e => setBookmarkName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && saveBookmark()}
          placeholder="Bookmark name..."
          className="px-2 py-0.5 bg-transparent border-b border-[var(--color-border)] text-white font-serif text-[0.7rem] outline-none focus:border-[var(--color-gold)] placeholder:text-white/30 w-32"
        />
        <button
          onClick={saveBookmark}
          disabled={!bookmarkName.trim()}
          className="px-2 py-0.5 text-white/40 hover:text-white transition-colors disabled:opacity-30"
        >
          Save
        </button>
      </div>

      {/* Canvas + Asset panel */}
      <div className="flex-1 flex overflow-hidden">
        {/* Canvas area — also a drop zone */}
        <div
          className={`flex-1 relative overflow-hidden bg-[#12100e] ${dragOver ? 'ring-2 ring-inset ring-[var(--color-gold)]' : ''}`}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleImageDrop}
        >
          {activeLevel && (
            <BuilderCanvas
              cols={activeLevel.cols}
              rows={activeLevel.rows}
              hexSize={HEX_SIZE}
              tiles={tiles}
              activeTool={overlay ? 'build' : tool}
              onTileClick={!overlay && (tool === 'build' || tool === 'visible' || tool === 'obscure') ? handleTileClick : undefined}
              onPointerUp={handlePointerUp}
            />
          )}

          {/* Drag-over hint */}
          {dragOver && !overlay && (
            <div className="absolute inset-0 flex items-center justify-center bg-[var(--color-gold)]/5 pointer-events-none">
              <span className="font-serif text-lg text-[var(--color-gold)]">Drop map image here</span>
            </div>
          )}

          {/* Image overlay controls */}
          {overlay && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-4 py-3 flex items-center gap-4 shadow-lg">
              {overlay.analyzing ? (
                <span className="font-serif text-sm text-[var(--color-text-muted)]">Processing image...</span>
              ) : (
                <>
                  <span className="text-[0.65rem] uppercase tracking-[0.15em] text-[var(--color-text-muted)]">Size (m)</span>
                  <input
                    type="number"
                    value={overlay.width_meters}
                    onChange={e => setOverlay(prev => prev ? { ...prev, width_meters: Number(e.target.value) || 1 } : null)}
                    className="w-16 bg-transparent border-b border-[var(--color-border)] text-[var(--color-text)] font-serif text-sm text-center outline-none focus:border-[var(--color-gold)]"
                  />
                  <span className="text-[var(--color-text-dim)]">x</span>
                  <input
                    type="number"
                    value={overlay.height_meters}
                    onChange={e => setOverlay(prev => prev ? { ...prev, height_meters: Number(e.target.value) || 1 } : null)}
                    className="w-16 bg-transparent border-b border-[var(--color-border)] text-[var(--color-text)] font-serif text-sm text-center outline-none focus:border-[var(--color-gold)]"
                  />
                  {overlay.confidence && (
                    <span className={`text-[0.6rem] uppercase tracking-wider ${
                      overlay.confidence === 'high' ? 'text-[#5a8a5a]' :
                      overlay.confidence === 'medium' ? 'text-[var(--color-gold)]' :
                      'text-[#8a5a4a]'
                    }`}>
                      {overlay.confidence}
                    </span>
                  )}
                  <button
                    onClick={commitOverlay}
                    className="px-3 py-1 text-[0.75rem] font-serif bg-[var(--color-gold)]/15 text-[var(--color-gold)] border border-[var(--color-gold)]/40 rounded hover:bg-[var(--color-gold)]/25 transition-colors"
                  >
                    Commit
                  </button>
                  <button
                    onClick={cancelOverlay}
                    className="px-3 py-1 text-[0.75rem] font-serif text-[var(--color-text-muted)] border border-[var(--color-border)] rounded hover:border-[var(--color-text-muted)] transition-colors"
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Asset palette — right sidebar */}
        <div className="w-16 border-l border-[var(--color-border)] bg-[var(--color-surface)] flex flex-col items-center pt-3 gap-2">
          {/* Drop zone for custom assets */}
          <div
            className="w-12 h-12 border-2 border-dashed border-[var(--color-border)] rounded flex items-center justify-center text-[var(--color-text-muted)] hover:border-[var(--color-gold)] hover:text-[var(--color-gold)] transition-colors cursor-pointer"
            title="Drop asset image here"
            onDragOver={e => e.preventDefault()}
          >
            <span className="text-xl leading-none">+</span>
          </div>
          {/* Tree */}
          <div
            className="w-12 h-12 border border-[var(--color-border)] rounded flex items-center justify-center text-2xl cursor-pointer hover:border-[var(--color-gold)] transition-colors"
            title="Tree"
          >
            🌲
          </div>
          {/* Rock */}
          <div
            className="w-12 h-12 border border-[var(--color-border)] rounded flex items-center justify-center text-2xl cursor-pointer hover:border-[var(--color-gold)] transition-colors"
            title="Rock"
          >
            🪨
          </div>
          {/* NPC — Goblin */}
          <div
            className="w-12 h-12 border border-[var(--color-border)] rounded flex items-center justify-center text-2xl cursor-pointer hover:border-[var(--color-gold)] transition-colors"
            title="NPC"
          >
            👺
          </div>
        </div>
      </div>
    </div>
  );
}
