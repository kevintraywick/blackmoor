'use client';

import { useState, useRef } from 'react';
import type { MapRow, DmNote } from '@/lib/types';
import MapCanvas from '@/components/MapCanvas';

interface Props {
  initialMaps: MapRow[];
  sessionId: string;
}

type Mode = 'reveal' | 'note';

export default function DmMapsClient({ initialMaps, sessionId }: Props) {
  const [maps, setMaps] = useState<MapRow[]>(initialMaps);
  const [activeId, setActiveId] = useState<string | null>(initialMaps[0]?.id ?? null);
  const [mode, setMode] = useState<Mode>('reveal');
  const [selectedNote, setSelectedNote] = useState<{ col: number; row: number; text: string } | null>(null);
  const [noteText, setNoteText] = useState('');
  const [showGridSetup, setShowGridSetup] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [revealAllConfirm, setRevealAllConfirm] = useState(false);
  const [addingMap, setAddingMap] = useState(false);
  const [newMapName, setNewMapName] = useState('');
  const [newMapGridType, setNewMapGridType] = useState<'square' | 'hex'>('square');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revealAllTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeMap = maps.find(m => m.id === activeId) ?? null;

  function updateActiveMap(patch: Partial<MapRow>) {
    setMaps(prev => prev.map(m => m.id === activeId ? { ...m, ...patch } : m));
  }

  // ── Tile click ─────────────────────────────────────────────────────────────
  async function handleTileClick(col: number, row: number, isDrag: boolean) {
    if (!activeMap) return;

    if (mode === 'note' && !isDrag) {
      // Open note for this tile
      const existing = activeMap.dm_notes?.find(n => n.col === col && n.row === row);
      setSelectedNote({ col, row, text: existing?.text ?? '' });
      setNoteText(existing?.text ?? '');
      return;
    }

    if (mode === 'reveal') {
      const key = `${col},${row}`;
      const isRevealed = activeMap.revealed_tiles.some(([c, r]) => `${c},${r}` === key);
      // Drag always reveals; click toggles
      const newRevealed = isDrag ? true : !isRevealed;

      // Optimistic update
      let newTiles: [number, number][];
      if (newRevealed) {
        if (isRevealed) return; // already revealed, skip during drag
        newTiles = [...activeMap.revealed_tiles, [col, row]];
      } else {
        newTiles = activeMap.revealed_tiles.filter(([c, r]) => `${c},${r}` !== key);
      }
      updateActiveMap({ revealed_tiles: newTiles });

      await fetch(`/api/maps/${activeId}/reveal`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tiles: [[col, row]], revealed: newRevealed }),
      });
    }
  }

  // ── Save note ──────────────────────────────────────────────────────────────
  async function saveNote() {
    if (!activeMap || !selectedNote) return;
    const { col, row } = selectedNote;
    const text = noteText.trim();

    // Optimistic update
    const existing = activeMap.dm_notes ?? [];
    let updated: DmNote[];
    if (text === '') {
      updated = existing.filter(n => !(n.col === col && n.row === row));
    } else {
      const idx = existing.findIndex(n => n.col === col && n.row === row);
      if (idx >= 0) updated = existing.map((n, i) => i === idx ? { col, row, text } : n);
      else updated = [...existing, { col, row, text }];
    }
    updateActiveMap({ dm_notes: updated });
    setSelectedNote(null);

    await fetch(`/api/maps/${activeId}/notes`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ col, row, text }),
    });
  }

  // ── Reset fog ──────────────────────────────────────────────────────────────
  function handleResetFog() {
    if (!resetConfirm) {
      setResetConfirm(true);
      resetTimer.current = setTimeout(() => setResetConfirm(false), 3000);
      return;
    }
    clearTimeout(resetTimer.current!);
    setResetConfirm(false);
    updateActiveMap({ revealed_tiles: [] });
    fetch(`/api/maps/${activeId}/reveal`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tiles: activeMap?.revealed_tiles ?? [], revealed: false }),
    });
  }

  // ── Reveal all ─────────────────────────────────────────────────────────────
  function handleRevealAll() {
    if (!activeMap) return;
    if (!revealAllConfirm) {
      setRevealAllConfirm(true);
      revealAllTimer.current = setTimeout(() => setRevealAllConfirm(false), 3000);
      return;
    }
    clearTimeout(revealAllTimer.current!);
    setRevealAllConfirm(false);
    const all: [number, number][] = [];
    for (let c = 0; c < activeMap.cols; c++)
      for (let r = 0; r < activeMap.rows; r++)
        all.push([c, r]);
    updateActiveMap({ revealed_tiles: all });
    fetch(`/api/maps/${activeId}/reveal`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tiles: all, revealed: true }),
    });
  }

  // ── Add map ────────────────────────────────────────────────────────────────
  async function handleAddMap() {
    if (!newMapName.trim() || !sessionId) return;
    const res = await fetch('/api/maps', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, name: newMapName.trim(), grid_type: newMapGridType }),
    });
    const newMap: MapRow = await res.json();
    setMaps(prev => [...prev, newMap]);
    setActiveId(newMap.id);
    setAddingMap(false);
    setNewMapName('');

    // Upload image if selected
    if (uploadFile) {
      const fd = new FormData();
      fd.append('file', uploadFile);
      const imgRes = await fetch(`/api/maps/${newMap.id}/image`, { method: 'POST', body: fd });
      const { image_path } = await imgRes.json();
      setMaps(prev => prev.map(m => m.id === newMap.id ? { ...m, image_path } : m));
      setUploadFile(null);
    }
  }

  // ── Grid setup save ────────────────────────────────────────────────────────
  const [gridDraft, setGridDraft] = useState<Partial<MapRow>>({});
  function openGridSetup() {
    if (!activeMap) return;
    setGridDraft({
      cols: activeMap.cols, rows: activeMap.rows,
      offset_x: activeMap.offset_x, offset_y: activeMap.offset_y,
      tile_px: activeMap.tile_px, grid_type: activeMap.grid_type,
      hex_orientation: activeMap.hex_orientation,
    });
    setShowGridSetup(true);
  }
  async function saveGridSetup() {
    updateActiveMap(gridDraft);
    setShowGridSetup(false);
    await fetch(`/api/maps/${activeId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(gridDraft),
    });
  }

  const previewMap = activeMap ? { ...activeMap, ...gridDraft } : null;

  // ── Styles ─────────────────────────────────────────────────────────────────
  const sh = 'text-[0.7rem] uppercase tracking-[0.18em] text-[#c9a84c] mb-2 pb-1.5 border-b border-[#3d3530] font-sans';
  const btn = 'w-full px-2.5 py-1.5 text-left text-[11px] bg-[#2a2420] border border-[#4a3a35] rounded text-[#c8bfb5] hover:border-[#c9a84c] hover:text-[#c9a84c] transition-colors';
  const btnActive = 'w-full px-2.5 py-1.5 text-left text-[11px] bg-[#2a2518] border border-[#c9a84c] rounded text-[#c9a84c]';

  return (
    <div>
      {/* ── Thumbnail strip ──────────────────────────────────────────────── */}
      <div className={sh}>Maps for this session</div>
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
        {maps.map(m => (
          <button
            key={m.id}
            onClick={() => { setActiveId(m.id); setShowGridSetup(false); setSelectedNote(null); }}
            className={`flex-shrink-0 w-[150px] border-2 rounded overflow-hidden text-left transition-all ${
              m.id === activeId ? 'border-[#c9a84c]' : 'border-[#3d3530] hover:border-[#6a5a50]'
            }`}
          >
            {m.image_path ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/maps/image/${m.image_path}`}
                alt={m.name}
                className="w-full h-[90px] object-cover"
              />
            ) : (
              <div className="w-full h-[90px] bg-[#0d0b09] flex items-center justify-center text-[#3d3530] text-xs">
                No image
              </div>
            )}
            <div className={`px-2 py-1 text-[10px] uppercase tracking-[0.1em] truncate font-sans ${
              m.id === activeId ? 'bg-[#2a2518] text-[#c9a84c]' : 'bg-[#231f1c] text-[#c8bfb5]'
            }`}>{m.name}</div>
          </button>
        ))}

        {/* Add map button */}
        {!addingMap ? (
          <button
            onClick={() => setAddingMap(true)}
            className="flex-shrink-0 w-[150px] h-[118px] border-2 border-dashed border-[#3d3530] rounded flex flex-col items-center justify-center gap-1 text-[#4a3a35] hover:border-[#c9a84c] hover:text-[#c9a84c] transition-colors"
          >
            <span className="text-2xl leading-none">+</span>
            <span className="text-[9px] uppercase tracking-[0.15em] font-sans">Add map</span>
          </button>
        ) : (
          <div className="flex-shrink-0 w-[200px] border border-[#3d3530] rounded bg-[#231f1c] p-2 flex flex-col gap-1.5">
            <input
              autoFocus
              value={newMapName}
              onChange={e => setNewMapName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddMap()}
              placeholder="Map name…"
              className="bg-transparent border-b border-[#3d3530] text-[#e8ddd0] text-xs outline-none pb-0.5 placeholder:text-[#8a7452]"
            />
            <select
              value={newMapGridType}
              onChange={e => setNewMapGridType(e.target.value as 'square' | 'hex')}
              className="bg-[#2a2420] border border-[#3d3530] text-[#c8bfb5] text-xs rounded px-1 py-0.5 outline-none"
            >
              <option value="square">Square grid</option>
              <option value="hex">Hex grid</option>
            </select>
            <label className="text-[10px] text-[#8a7d6e] cursor-pointer">
              <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e => setUploadFile(e.target.files?.[0] ?? null)} />
              {uploadFile ? <span className="text-[#c9a84c]">{uploadFile.name}</span> : '+ Choose image'}
            </label>
            <div className="flex gap-1 mt-0.5">
              <button onClick={() => setAddingMap(false)} className="flex-1 text-[10px] border border-[#3d3530] rounded px-1 py-0.5 text-[#8a7d6e] hover:border-[#8a7d6e]">Cancel</button>
              <button onClick={handleAddMap} className="flex-1 text-[10px] border border-[#4a3a35] rounded px-1 py-0.5 text-[#c9a84c] hover:border-[#c9a84c]">Add</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Active map ───────────────────────────────────────────────────── */}
      {activeMap && (
        <>
          <div className={sh}>
            {activeMap.name} — {activeMap.grid_type} grid · {activeMap.cols}×{activeMap.rows}
          </div>

          <div className="flex gap-3">
            {/* Canvas */}
            <div className="flex-1 bg-[#0d0b09] border border-[#3d3530] rounded overflow-hidden" style={{ minHeight: 320 }}>
              <MapCanvas
                mapData={showGridSetup && previewMap ? previewMap : activeMap}
                mode="dm"
                width={700}
                height={420}
                onTileClick={handleTileClick}
                activeNoteCoord={selectedNote ? [selectedNote.col, selectedNote.row] : null}
              />
            </div>

            {/* Controls sidebar */}
            <div className="w-[160px] flex-shrink-0 bg-[#231f1c] border border-[#3d3530] rounded p-3 flex flex-col gap-2">
              <div className={sh} style={{ marginBottom: 6 }}>Mode</div>
              <button className={mode === 'reveal' ? btnActive : btn} onClick={() => { setMode('reveal'); setSelectedNote(null); }}>
                ☀ Reveal / Hide
              </button>
              <button className={mode === 'note' ? btnActive : btn} onClick={() => setMode('note')}>
                ✎ Add note
              </button>

              {/* Note editor */}
              {selectedNote && mode === 'note' && (
                <div className="mt-1 flex flex-col gap-1">
                  <div className="text-[9px] text-[#8a7d6e] font-sans uppercase tracking-[0.1em]">
                    Tile {selectedNote.col},{selectedNote.row}
                  </div>
                  <textarea
                    value={noteText}
                    onChange={e => setNoteText(e.target.value)}
                    placeholder="DM note…"
                    rows={3}
                    className="w-full bg-[#1a1614] border border-[#3d3530] text-[#c8bfb5] text-[11px] font-serif p-1.5 rounded resize-none outline-none focus:border-[#c9a84c] placeholder:text-[#8a7452]"
                  />
                  <button onClick={saveNote} className="text-[10px] border border-[#4a3a35] rounded px-2 py-0.5 text-[#c9a84c] hover:border-[#c9a84c] w-full">
                    {noteText.trim() ? 'Save note' : 'Delete note'}
                  </button>
                </div>
              )}

              <div className="h-px bg-[#3d3530] my-1" />

              <button
                onClick={handleResetFog}
                className={`${btn} ${resetConfirm ? 'border-[#8a3a3a] text-[#c0392b] bg-[#2a1414]' : ''}`}
              >
                {resetConfirm ? 'Are you sure?' : '↺ Reset fog'}
              </button>
              <button
                onClick={handleRevealAll}
                className={`${btn} ${revealAllConfirm ? 'border-[#8a3a3a] text-[#c0392b] bg-[#2a1414]' : ''}`}
              >
                {revealAllConfirm ? 'Are you sure?' : '✓ Reveal all'}
              </button>

              <div className="h-px bg-[#3d3530] my-1" />
              <button className={btn} onClick={openGridSetup}>⚙ Grid setup…</button>
            </div>
          </div>

          {/* ── Grid setup panel ─────────────────────────────────────────── */}
          {showGridSetup && (
            <div className="mt-3 bg-[#231f1c] border border-[#3d3530] rounded p-4">
              <div className={sh}>Grid configuration (live preview on canvas above)</div>
              <div className="grid grid-cols-4 gap-3 text-xs">
                {([
                  ['cols', 'Columns'], ['rows', 'Rows'],
                  ['offset_x', 'Offset X (px)'], ['offset_y', 'Offset Y (px)'],
                  ['tile_px', 'Tile size (px)'],
                ] as [keyof MapRow, string][]).map(([key, label]) => (
                  <label key={key} className="flex flex-col gap-0.5">
                    <span className="text-[#8a7d6e] text-[9px] uppercase tracking-[0.1em]">{label}</span>
                    <input
                      type="number"
                      value={(gridDraft[key] as number) ?? 0}
                      onChange={e => setGridDraft(d => ({ ...d, [key]: parseFloat(e.target.value) || 0 }))}
                      className="bg-[#1a1614] border border-[#3d3530] text-[#e8ddd0] rounded px-1.5 py-1 outline-none focus:border-[#c9a84c] w-full"
                    />
                  </label>
                ))}
                <label className="flex flex-col gap-0.5">
                  <span className="text-[#8a7d6e] text-[9px] uppercase tracking-[0.1em]">Grid type</span>
                  <select
                    value={gridDraft.grid_type ?? 'square'}
                    onChange={e => setGridDraft(d => ({ ...d, grid_type: e.target.value as 'square' | 'hex' }))}
                    className="bg-[#1a1614] border border-[#3d3530] text-[#e8ddd0] rounded px-1.5 py-1 outline-none focus:border-[#c9a84c]"
                  >
                    <option value="square">Square</option>
                    <option value="hex">Hex</option>
                  </select>
                </label>
                {gridDraft.grid_type === 'hex' && (
                  <label className="flex flex-col gap-0.5">
                    <span className="text-[#8a7d6e] text-[9px] uppercase tracking-[0.1em]">Hex orientation</span>
                    <select
                      value={gridDraft.hex_orientation ?? 'flat'}
                      onChange={e => setGridDraft(d => ({ ...d, hex_orientation: e.target.value as 'flat' | 'pointy' }))}
                      className="bg-[#1a1614] border border-[#3d3530] text-[#e8ddd0] rounded px-1.5 py-1 outline-none focus:border-[#c9a84c]"
                    >
                      <option value="flat">Flat-top</option>
                      <option value="pointy">Pointy-top</option>
                    </select>
                  </label>
                )}
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={() => { setShowGridSetup(false); setGridDraft({}); }} className={btn} style={{ width: 'auto', padding: '4px 12px' }}>Cancel</button>
                <button onClick={saveGridSetup} className="text-[11px] border border-[#c9a84c] rounded px-3 py-1 text-[#c9a84c] hover:bg-[#2a2518] transition-colors">Save grid</button>
              </div>
            </div>
          )}
        </>
      )}

      {!activeMap && !addingMap && (
        <div className="text-[#4a3a35] text-sm text-center py-12">
          No maps yet — click &quot;+ Add map&quot; to upload your first map.
        </div>
      )}
    </div>
  );
}
