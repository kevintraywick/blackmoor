# Map System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fog-of-war map system where the DM uploads maps, reveals tiles by clicking, and players see live fog-of-war updates on their character pages.

**Architecture:** Canvas-based rendering for both square and hex grids. DM view uses optimistic updates; player view polls `/api/maps/[id]/player` every 2 seconds. Images stored on a Railway Volume at `/data/maps/`. DM notes are tile-anchored and never sent to player endpoints.

**Tech Stack:** Next.js 16.2.0 App Router, TypeScript, PostgreSQL (JSONB for tile arrays), HTML Canvas API, `fs` (Node.js file I/O for Railway Volume), `multipart/form-data` for image upload.

**Spec:** `docs/superpowers/specs/2026-03-21-map-system-design.md`

---

## Before You Start

**Railway Volume setup (manual step — do this before deploying):**
In the Railway dashboard, add a Volume to the blackmoor service with mount path `/data`. Without this, uploaded images will be lost on redeploy. The app works locally without a volume (files go to `/data/maps/` relative to the filesystem, or you can adjust `MAPS_DIR` for local dev).

---

## File Map

```
lib/types.ts                         — add MapRow, PlayerMapRow, DmNote, GridType types
lib/schema.ts                        — add maps table + index migration

app/api/maps/route.ts                — POST (create), GET (list by session_id)
app/api/maps/[id]/route.ts           — GET (DM full), PATCH (metadata), DELETE
app/api/maps/[id]/player/route.ts    — GET (player version, no dm_notes)
app/api/maps/[id]/reveal/route.ts    — PATCH (set/clear revealed_tiles)
app/api/maps/[id]/notes/route.ts     — PATCH (upsert/delete dm note)
app/api/maps/[id]/image/route.ts     — POST (upload image to Volume)
app/api/maps/image/[filename]/route.ts — GET (serve image file, path-traversal guard)

components/MapCanvas.tsx             — canvas renderer: square + hex, dm + player modes
components/PlayerMapPanel.tsx        — session resolution, tabs, polling, player canvas

app/dm/maps/page.tsx                 — DM maps page: thumbnail strip + active map + controls
app/dm/page.tsx                      — change "Maps" span → Link to /dm/maps (per session)
app/players/[id]/page.tsx            — add <PlayerMapPanel> below <Sheet>
```

---

## Task 1: Types and Schema

**Files:**
- Modify: `lib/types.ts`
- Modify: `lib/schema.ts`

- [ ] **Step 1: Add types to `lib/types.ts`**

Append to the end of the file:

```typescript
export type GridType = 'square' | 'hex';
export type HexOrientation = 'flat' | 'pointy';

export interface DmNote {
  col: number;
  row: number;
  text: string;
}

export interface MapRow {
  id: string;
  session_id: string;
  name: string;
  image_path: string;
  grid_type: GridType;
  cols: number;
  rows: number;
  offset_x: number;
  offset_y: number;
  tile_px: number;
  hex_orientation: HexOrientation;
  revealed_tiles: [number, number][];
  dm_notes: DmNote[];
  sort_order: number;
  created_at: number;
}

// Player version — dm_notes omitted (never sent to client)
export type PlayerMapRow = Omit<MapRow, 'dm_notes'>;
```

- [ ] **Step 2: Add maps table migration to `lib/schema.ts`**

Add these two `pool.query` calls at the end of `_initSchema()`, before the closing brace:

```typescript
  await pool.query(`
    CREATE TABLE IF NOT EXISTS maps (
      id              TEXT PRIMARY KEY,
      session_id      TEXT NOT NULL,
      name            TEXT NOT NULL DEFAULT '',
      image_path      TEXT NOT NULL DEFAULT '',
      grid_type       TEXT NOT NULL DEFAULT 'square',
      cols            INTEGER NOT NULL DEFAULT 20,
      rows            INTEGER NOT NULL DEFAULT 15,
      offset_x        REAL NOT NULL DEFAULT 0,
      offset_y        REAL NOT NULL DEFAULT 0,
      tile_px         REAL NOT NULL DEFAULT 40,
      hex_orientation TEXT NOT NULL DEFAULT 'flat',
      revealed_tiles  JSONB NOT NULL DEFAULT '[]',
      dm_notes        JSONB NOT NULL DEFAULT '[]',
      sort_order      INTEGER NOT NULL DEFAULT 0,
      created_at      BIGINT NOT NULL DEFAULT 0
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS maps_session_id_idx
    ON maps (session_id, sort_order)
  `);
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add lib/types.ts lib/schema.ts
git commit -m "Add MapRow types and maps table schema migration"
```

---

## Task 2: Core Maps API (CRUD)

**Files:**
- Create: `app/api/maps/route.ts`
- Create: `app/api/maps/[id]/route.ts`

- [ ] **Step 1: Create `app/api/maps/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import type { MapRow } from '@/lib/types';

// GET /api/maps?session_id=X
export async function GET(req: NextRequest) {
  try {
    await ensureSchema();
    const session_id = req.nextUrl.searchParams.get('session_id');
    if (!session_id) {
      return NextResponse.json({ error: 'session_id required' }, { status: 400 });
    }
    const rows = await query<MapRow>(
      'SELECT * FROM maps WHERE session_id = $1 ORDER BY sort_order ASC, created_at ASC',
      [session_id]
    );
    return NextResponse.json(rows);
  } catch (err) {
    console.error('GET /api/maps', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

// POST /api/maps — create map metadata
export async function POST(req: NextRequest) {
  try {
    await ensureSchema();
    const { session_id, name, grid_type = 'square' } = await req.json();
    if (!session_id || !name) {
      return NextResponse.json({ error: 'session_id and name required' }, { status: 400 });
    }

    const id = crypto.randomUUID();
    const now = Date.now();

    await query(
      `INSERT INTO maps (id, session_id, name, grid_type, sort_order, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, session_id, name, grid_type, now, now]
    );

    const [map] = await query<MapRow>('SELECT * FROM maps WHERE id = $1', [id]);
    return NextResponse.json(map);
  } catch (err) {
    console.error('POST /api/maps', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create `app/api/maps/[id]/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import { unlink } from 'fs/promises';
import { join } from 'path';
import type { MapRow } from '@/lib/types';

const MAPS_DIR = process.env.MAPS_DIR ?? '/data/maps';

type Params = { params: Promise<{ id: string }> };

// GET /api/maps/[id] — DM full view (includes dm_notes)
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    await ensureSchema();
    const { id } = await params;
    const [map] = await query<MapRow>('SELECT * FROM maps WHERE id = $1', [id]);
    if (!map) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(map);
  } catch (err) {
    console.error('GET /api/maps/[id]', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

// PATCH /api/maps/[id] — update metadata / grid settings
const ALLOWED = new Set([
  'name', 'grid_type', 'cols', 'rows', 'offset_x',
  'offset_y', 'tile_px', 'hex_orientation',
]);

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    await ensureSchema();
    const { id } = await params;
    const body = await req.json();
    const keys = Object.keys(body).filter(k => ALLOWED.has(k));
    if (keys.length === 0) {
      return NextResponse.json({ error: 'No valid fields' }, { status: 400 });
    }
    const setClauses = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
    const values = keys.map(k => body[k]);
    await query(`UPDATE maps SET ${setClauses} WHERE id = $1`, [id, ...values]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('PATCH /api/maps/[id]', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

// DELETE /api/maps/[id] — delete row + image file
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    await ensureSchema();
    const { id } = await params;
    const [map] = await query<MapRow>('SELECT image_path FROM maps WHERE id = $1', [id]);
    await query('DELETE FROM maps WHERE id = $1', [id]);
    if (map?.image_path) {
      try {
        await unlink(join(MAPS_DIR, map.image_path));
      } catch (e) {
        console.error('Failed to delete image file (non-fatal):', e);
      }
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/maps/[id]', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add 'app/api/maps/route.ts' 'app/api/maps/[id]/route.ts'
git commit -m "Add maps CRUD API routes"
```

---

## Task 3: Player View, Reveal, and Notes APIs

**Files:**
- Create: `app/api/maps/[id]/player/route.ts`
- Create: `app/api/maps/[id]/reveal/route.ts`
- Create: `app/api/maps/[id]/notes/route.ts`

- [ ] **Step 1: Create `app/api/maps/[id]/player/route.ts`**

This endpoint never touches `dm_notes`. The SELECT explicitly lists columns.

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import type { PlayerMapRow } from '@/lib/types';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureSchema();
    const { id } = await params;
    const rows = await query<PlayerMapRow>(
      `SELECT id, session_id, name, image_path, grid_type, cols, rows,
              offset_x, offset_y, tile_px, hex_orientation, revealed_tiles,
              sort_order, created_at
       FROM maps WHERE id = $1`,
      [id]
    );
    if (!rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(rows[0]);
  } catch (err) {
    console.error('GET /api/maps/[id]/player', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create `app/api/maps/[id]/reveal/route.ts`**

Set semantics (not toggle): `revealed: true` unions tiles in, `revealed: false` removes them.

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import type { MapRow } from '@/lib/types';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureSchema();
    const { id } = await params;
    const { tiles, revealed } = await req.json() as {
      tiles: [number, number][];
      revealed: boolean;
    };

    if (!Array.isArray(tiles) || typeof revealed !== 'boolean') {
      return NextResponse.json({ error: 'tiles (array) and revealed (boolean) required' }, { status: 400 });
    }

    // Read-modify-write: load current, apply set/clear, write back
    const [map] = await query<MapRow>('SELECT revealed_tiles FROM maps WHERE id = $1', [id]);
    if (!map) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const current: [number, number][] = map.revealed_tiles ?? [];

    let updated: [number, number][];
    if (revealed) {
      // Union: add tiles not already present
      const existing = new Set(current.map(([c, r]) => `${c},${r}`));
      const toAdd = tiles.filter(([c, r]) => !existing.has(`${c},${r}`));
      updated = [...current, ...toAdd];
    } else {
      // Remove matching tiles
      const toRemove = new Set(tiles.map(([c, r]) => `${c},${r}`));
      updated = current.filter(([c, r]) => !toRemove.has(`${c},${r}`));
    }

    await query(
      'UPDATE maps SET revealed_tiles = $1 WHERE id = $2',
      [JSON.stringify(updated), id]
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('PATCH /api/maps/[id]/reveal', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
```

- [ ] **Step 3: Create `app/api/maps/[id]/notes/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import type { MapRow, DmNote } from '@/lib/types';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureSchema();
    const { id } = await params;
    const { col, row, text } = await req.json() as { col: number; row: number; text: string };

    if (typeof col !== 'number' || typeof row !== 'number' || typeof text !== 'string') {
      return NextResponse.json({ error: 'col, row, text required' }, { status: 400 });
    }

    const [map] = await query<MapRow>('SELECT dm_notes FROM maps WHERE id = $1', [id]);
    if (!map) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const notes: DmNote[] = map.dm_notes ?? [];
    let updated: DmNote[];

    if (text === '') {
      // Delete note for this tile
      updated = notes.filter(n => !(n.col === col && n.row === row));
    } else {
      // Upsert
      const existing = notes.findIndex(n => n.col === col && n.row === row);
      if (existing >= 0) {
        updated = notes.map((n, i) => i === existing ? { col, row, text } : n);
      } else {
        updated = [...notes, { col, row, text }];
      }
    }

    await query(
      'UPDATE maps SET dm_notes = $1 WHERE id = $2',
      [JSON.stringify(updated), id]
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('PATCH /api/maps/[id]/notes', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add 'app/api/maps/[id]/player/route.ts' 'app/api/maps/[id]/reveal/route.ts' 'app/api/maps/[id]/notes/route.ts'
git commit -m "Add player view, reveal, and notes API routes"
```

---

## Task 4: Image Upload and Serve APIs

**Files:**
- Create: `app/api/maps/[id]/image/route.ts`
- Create: `app/api/maps/image/[filename]/route.ts`

- [ ] **Step 1: Create `app/api/maps/[id]/image/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import { writeFile, unlink, mkdir } from 'fs/promises';
import { join, extname } from 'path';
import type { MapRow } from '@/lib/types';

const MAPS_DIR = process.env.MAPS_DIR ?? '/data/maps';
const MAX_SIZE = 20 * 1024 * 1024; // 20MB
const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const EXT_MAP: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
};

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureSchema();
    const { id } = await params;

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'file field required' }, { status: 400 });

    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: 'Only PNG, JPEG, WEBP allowed' }, { status: 415 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File too large (max 20MB)' }, { status: 413 });
    }

    // Ensure directory exists
    await mkdir(MAPS_DIR, { recursive: true });

    // Delete old image if present
    const [map] = await query<MapRow>('SELECT image_path FROM maps WHERE id = $1', [id]);
    if (!map) return NextResponse.json({ error: 'Map not found' }, { status: 404 });
    if (map.image_path) {
      try { await unlink(join(MAPS_DIR, map.image_path)); } catch { /* already gone */ }
    }

    // Save new image
    const filename = `${crypto.randomUUID()}${EXT_MAP[file.type]}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(join(MAPS_DIR, filename), buffer);

    await query('UPDATE maps SET image_path = $1 WHERE id = $2', [filename, id]);

    return NextResponse.json({ ok: true, image_path: filename });
  } catch (err) {
    console.error('POST /api/maps/[id]/image', err);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create `app/api/maps/image/[filename]/route.ts`**

Note: this route is at `app/api/maps/image/[filename]/` — a sibling of `[id]/`, not nested inside it. This avoids the `[id]` segment catching `image` as a map id.

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';

const MAPS_DIR = process.env.MAPS_DIR ?? '/data/maps';
const SAFE_FILENAME = /^[a-zA-Z0-9_-]+\.(png|jpg|jpeg|webp)$/;
const CONTENT_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

export async function GET(_req: NextRequest, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params;

  // Security: reject path traversal attempts
  if (!SAFE_FILENAME.test(filename)) {
    return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
  }

  try {
    const buffer = await readFile(join(MAPS_DIR, filename));
    const ext = filename.split('.').pop()!;
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': CONTENT_TYPES[ext] ?? 'application/octet-stream',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
}
```

- [ ] **Step 3: Type-check and build**

```bash
npx tsc --noEmit && npm run build 2>&1 | tail -20
```

Expected: no errors, all routes listed under `ƒ (Dynamic)`.

- [ ] **Step 4: Commit**

```bash
git add 'app/api/maps/[id]/image/route.ts' 'app/api/maps/image/[filename]/route.ts'
git commit -m "Add image upload and serve API routes"
```

---

## Task 5: MapCanvas Component

**Files:**
- Create: `components/MapCanvas.tsx`

This is the core rendering component. It draws the map image, grid, fog, reveal tints, note dots, and hover highlight on an HTML canvas.

- [ ] **Step 1: Create `components/MapCanvas.tsx`**

```typescript
'use client';

import { useEffect, useRef, useCallback } from 'react';
import type { MapRow, PlayerMapRow } from '@/lib/types';

type AnyMapRow = MapRow | PlayerMapRow;

interface MapCanvasProps {
  mapData: AnyMapRow;
  mode: 'dm' | 'player';
  width: number;
  height: number;
  onTileClick?: (col: number, row: number, isDrag: boolean) => void;
  activeNoteCoord?: [number, number] | null;
}

export default function MapCanvas({
  mapData,
  mode,
  width,
  height,
  onTileClick,
  activeNoteCoord,
}: MapCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const isDragging = useRef(false);

  // Build image URL from image_path
  const imageUrl = mapData.image_path
    ? `/api/maps/image/${mapData.image_path}`
    : null;

  // ── Render ──────────────────────────────────────────────────────────────────
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const { grid_type, cols, rows, offset_x, offset_y, tile_px, revealed_tiles } = mapData;
    const dm_notes = mode === 'dm' ? (mapData as MapRow).dm_notes ?? [] : [];

    // Scale factors — grid params defined at natural image size
    const naturalW = img?.naturalWidth || W;
    const naturalH = img?.naturalHeight || H;
    const scaleX = W / naturalW;
    const scaleY = H / naturalH;

    // ── Draw background image ──────────────────────────────────────────────
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0d0b09';
    ctx.fillRect(0, 0, W, H);
    if (img) ctx.drawImage(img, 0, 0, W, H);

    // ── Helper: tile rect (square) ─────────────────────────────────────────
    function squareRect(col: number, row: number) {
      const tileW = tile_px * scaleX;
      const tileH = tile_px * scaleY;
      return {
        x: col * tileW + offset_x * scaleX,
        y: row * tileH + offset_y * scaleY,
        w: tileW,
        h: tileH,
      };
    }

    // ── Helper: hex center (flat-top) ──────────────────────────────────────
    function hexCenter(col: number, row: number) {
      const R = (tile_px / 2) * scaleX;
      const W2 = R * 2;
      const H2 = R * Math.sqrt(3);
      const ox = offset_x * scaleX;
      const oy = offset_y * scaleY;
      return {
        cx: col * W2 * 0.75 + ox + R,
        cy: row * H2 + oy + H2 / 2 + (col % 2 === 1 ? H2 / 2 : 0),
        R,
        H: H2,
      };
    }

    // ── Helper: draw hex path ──────────────────────────────────────────────
    function hexPath(cx: number, cy: number, R: number) {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 180) * (60 * i);
        const px = cx + R * Math.cos(angle);
        const py = cy + R * Math.sin(angle);
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();
    }

    const revealedSet = new Set(revealed_tiles.map(([c, r]) => `${c},${r}`));

    // ── Player mode: fog then reveal ───────────────────────────────────────
    if (mode === 'player') {
      ctx.fillStyle = 'rgba(0,0,0,0.88)';
      ctx.fillRect(0, 0, W, H);

      // Reveal tiles by clipping back to image
      revealed_tiles.forEach(([col, row]) => {
        if (grid_type === 'square') {
          const { x, y, w, h } = squareRect(col, row);
          if (img) {
            ctx.drawImage(img, x, y, w, h, x, y, w, h);
          } else {
            ctx.clearRect(x, y, w, h);
          }
        } else {
          const { cx, cy, R } = hexCenter(col, row);
          ctx.save();
          hexPath(cx, cy, R);
          ctx.clip();
          if (img) ctx.drawImage(img, 0, 0, W, H);
          ctx.restore();
        }
      });
    }

    // ── DM mode: green tint on revealed tiles ─────────────────────────────
    if (mode === 'dm') {
      revealed_tiles.forEach(([col, row]) => {
        ctx.fillStyle = 'rgba(60,140,60,0.22)';
        if (grid_type === 'square') {
          const { x, y, w, h } = squareRect(col, row);
          ctx.fillRect(x, y, w, h);
        } else {
          const { cx, cy, R } = hexCenter(col, row);
          hexPath(cx, cy, R);
          ctx.fill();
        }
      });
    }

    // ── Grid lines ─────────────────────────────────────────────────────────
    ctx.strokeStyle = 'rgba(200,180,150,0.18)';
    ctx.lineWidth = 0.5;

    if (grid_type === 'square') {
      const tileW = tile_px * scaleX;
      const tileH = tile_px * scaleY;
      const ox = offset_x * scaleX;
      const oy = offset_y * scaleY;
      for (let c = 0; c <= cols; c++) {
        ctx.beginPath();
        ctx.moveTo(c * tileW + ox, oy);
        ctx.lineTo(c * tileW + ox, rows * tileH + oy);
        ctx.stroke();
      }
      for (let r = 0; r <= rows; r++) {
        ctx.beginPath();
        ctx.moveTo(ox, r * tileH + oy);
        ctx.lineTo(cols * tileW + ox, r * tileH + oy);
        ctx.stroke();
      }
    } else {
      for (let col = 0; col < cols; col++) {
        for (let row = 0; row < rows; row++) {
          const { cx, cy, R } = hexCenter(col, row);
          hexPath(cx, cy, R);
          ctx.stroke();
        }
      }
    }

    // ── DM only: note dots + hover + active note highlight ─────────────────
    if (mode === 'dm') {
      dm_notes.forEach(({ col, row }) => {
        if (grid_type === 'square') {
          const { x, y, w } = squareRect(col, row);
          ctx.fillStyle = 'rgba(180,60,60,0.9)';
          ctx.beginPath();
          ctx.arc(x + w - 5, y + 5, 3.5, 0, Math.PI * 2);
          ctx.fill();
        } else {
          const { cx, cy, R } = hexCenter(col, row);
          ctx.fillStyle = 'rgba(180,60,60,0.9)';
          ctx.beginPath();
          ctx.arc(cx + R * 0.6, cy - R * 0.6, 3.5, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      if (activeNoteCoord) {
        const [col, row] = activeNoteCoord;
        ctx.strokeStyle = 'rgba(200,168,76,0.8)';
        ctx.lineWidth = 2;
        if (grid_type === 'square') {
          const { x, y, w, h } = squareRect(col, row);
          ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
        } else {
          const { cx, cy, R } = hexCenter(col, row);
          hexPath(cx, cy, R - 1);
          ctx.stroke();
        }
      }
    }
  }, [mapData, mode, width, height, activeNoteCoord]);

  // ── Load image and re-render ───────────────────────────────────────────────
  useEffect(() => {
    if (!imageUrl) { render(); return; }
    const img = new Image();
    img.onload = () => { imgRef.current = img; render(); };
    img.onerror = () => { imgRef.current = null; render(); };
    img.src = imageUrl;
  }, [imageUrl, render]);

  // Re-render when data changes
  useEffect(() => { render(); }, [render]);

  // ── Click / drag to tile ───────────────────────────────────────────────────
  function pixelToTile(clientX: number, clientY: number): [number, number] | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const px = (clientX - rect.left) * (canvas.width / rect.width);
    const py = (clientY - rect.top) * (canvas.height / rect.height);

    const { grid_type, cols, rows, offset_x, offset_y, tile_px } = mapData;
    const naturalW = imgRef.current?.naturalWidth || canvas.width;
    const naturalH = imgRef.current?.naturalHeight || canvas.height;
    const scaleX = canvas.width / naturalW;
    const scaleY = canvas.height / naturalH;

    if (grid_type === 'square') {
      const tileW = tile_px * scaleX;
      const tileH = tile_px * scaleY;
      const col = Math.floor((px - offset_x * scaleX) / tileW);
      const row = Math.floor((py - offset_y * scaleY) / tileH);
      if (col < 0 || col >= cols || row < 0 || row >= rows) return null;
      return [col, row];
    } else {
      // Flat-top hex, even-q offset
      const R = (tile_px / 2) * scaleX;
      const H2 = R * Math.sqrt(3);
      const ox = offset_x * scaleX;
      const oy = offset_y * scaleY;
      const x = px - ox - R;
      const y = py - oy - H2 / 2;
      const q = (2 / 3 * x) / R;
      const r = (-1 / 3 * x + Math.sqrt(3) / 3 * y) / R;
      const s = -q - r;
      let rq = Math.round(q), rr = Math.round(r), rs = Math.round(s);
      const dq = Math.abs(rq - q), dr = Math.abs(rr - r), ds = Math.abs(rs - s);
      if (dq > dr && dq > ds) rq = -rr - rs;
      else if (dr > ds) rr = -rq - rs;
      const col = rq;
      const row = rr + Math.floor(rq / 2);
      if (col < 0 || col >= cols || row < 0 || row >= rows) return null;
      return [col, row];
    }
  }

  function handleMouseDown(e: React.MouseEvent) {
    if (!onTileClick) return;
    isDragging.current = true;
    const tile = pixelToTile(e.clientX, e.clientY);
    if (tile) onTileClick(tile[0], tile[1], false);
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!onTileClick || !isDragging.current) return;
    const tile = pixelToTile(e.clientX, e.clientY);
    if (tile) onTileClick(tile[0], tile[1], true);
  }

  function handleMouseUp() { isDragging.current = false; }

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ display: 'block', width: '100%', height: '100%' }}
      onMouseDown={mode === 'dm' ? handleMouseDown : undefined}
      onMouseMove={mode === 'dm' ? handleMouseMove : undefined}
      onMouseUp={mode === 'dm' ? handleMouseUp : undefined}
      onMouseLeave={mode === 'dm' ? handleMouseUp : undefined}
    />
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/MapCanvas.tsx
git commit -m "Add MapCanvas component (square + hex, dm + player modes)"
```

---

## Task 6: PlayerMapPanel Component

**Files:**
- Create: `components/PlayerMapPanel.tsx`

- [ ] **Step 1: Create `components/PlayerMapPanel.tsx`**

```typescript
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
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/PlayerMapPanel.tsx
git commit -m "Add PlayerMapPanel with session resolution, tabs, and 2s polling"
```

---

## Task 7: DM Maps Page

**Files:**
- Create: `app/dm/maps/page.tsx`

This is the largest component. It includes the thumbnail strip, active map canvas with DM controls, and the grid setup panel.

- [ ] **Step 1: Create `app/dm/maps/page.tsx`**

```typescript
export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import Link from 'next/link';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import type { MapRow } from '@/lib/types';
import DmMapsClient from './DmMapsClient';

interface Props {
  searchParams: Promise<{ session?: string }>;
}

export default async function DmMapsPage({ searchParams }: Props) {
  const { session: sessionId } = await searchParams;

  await ensureSchema();

  let maps: MapRow[] = [];
  let sessionTitle = '';

  if (sessionId) {
    maps = await query<MapRow>(
      'SELECT * FROM maps WHERE session_id = $1 ORDER BY sort_order ASC, created_at ASC',
      [sessionId]
    );
    const [session] = await query<{ title: string; number: number }>(
      'SELECT title, number FROM sessions WHERE id = $1',
      [sessionId]
    );
    sessionTitle = session ? `Session ${session.number}${session.title ? ` — ${session.title}` : ''}` : '';
  }

  return (
    <div className="min-h-screen bg-[#1a1614] text-[#e8ddd0]">
      <div className="sticky top-0 bg-[#231f1c] border-b border-[#3d3530] px-8 py-3 flex items-center gap-3 z-10 text-sm">
        <Link href="/dm" className="text-[#8a7d6e] hover:text-[#c9a84c] no-underline">← Sessions</Link>
        <span className="text-[#3d3530]">|</span>
        <span className="text-[#c9a84c] font-bold">{sessionTitle || 'Maps'}</span>
        <span className="text-[#3d3530]">|</span>
        <span className="text-[#e8ddd0]">Maps</span>
      </div>

      <div className="px-6 py-6">
        <Suspense fallback={null}>
          <DmMapsClient initialMaps={maps} sessionId={sessionId ?? ''} />
        </Suspense>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `app/dm/maps/DmMapsClient.tsx`**

This is the client-side interactive part — thumbnail strip, active map canvas, controls, and grid setup.

```typescript
'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
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
          No maps yet — click "+ Add map" to upload your first map.
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Type-check and build**

```bash
npx tsc --noEmit && npm run build 2>&1 | tail -20
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add 'app/dm/maps/page.tsx' 'app/dm/maps/DmMapsClient.tsx'
git commit -m "Add DM maps page with thumbnail strip, canvas, reveal controls, and grid setup"
```

---

## Task 8: Wire Up — Player Page and DM Nav

**Files:**
- Modify: `app/players/[id]/page.tsx`
- Modify: `app/dm/page.tsx`

- [ ] **Step 1: Add `<PlayerMapPanel>` to `app/players/[id]/page.tsx`**

Add the import near the top (after the existing imports):
```typescript
import PlayerMapPanel from '@/components/PlayerMapPanel';
```

In the JSX, add the panel after `</Sheet>` and before `</div>` (the `max-w` wrapper):
```tsx
        <PlayerMapPanel playerId={player.id} />
```

- [ ] **Step 2: Update "Maps" nav link in `app/dm/page.tsx`**

Find and replace the disabled Maps span. In the sticky nav section, locate:

```tsx
<span title="Coming soon" className="text-[#3d3530] cursor-not-allowed">Maps</span>
```

Replace with a dynamic link per session. Since sessions are listed in `SessionList`, the simplest approach is to link to `/dm/maps` without a session parameter — the DM can select the session context on the maps page. Or link to a generic page. Given the DM page shows a list of sessions, the Maps link in the top nav is a general entry point:

```tsx
<Link href="/dm/maps" className="text-[#8a7d6e] hover:text-[#c9a84c] no-underline">Maps</Link>
```

And in `app/components/SessionList.tsx`, add a "Maps" link on each session row, linking to `/dm/maps?session=SESSION_ID`. Find the existing session link/row markup and add alongside the existing link:

Look for where each session renders its drag row and link. Add:
```tsx
<Link href={`/dm/maps?session=${session.id}`} className="text-[#6a5a50] hover:text-[#c9a84c] text-xs no-underline ml-auto mr-2">Maps</Link>
```

Place this inside the session row, before the drag handle or delete button.

- [ ] **Step 3: Type-check and full build**

```bash
npx tsc --noEmit && npm run build 2>&1 | tail -25
```

Expected: clean build, all routes listed.

- [ ] **Step 4: Commit and push**

```bash
git add 'app/players/[id]/page.tsx' 'app/dm/page.tsx' components/SessionList.tsx
git commit -m "Wire up PlayerMapPanel on player pages and Maps nav links"
git push
```

---

## Task 9: Railway Volume (Manual Deployment Step)

This task requires action in the Railway dashboard — it cannot be scripted.

- [ ] **Step 1: Add Volume in Railway dashboard**
  1. Go to your Railway project → blackmoor service
  2. Click "Add Volume"
  3. Set mount path to `/data`
  4. Size: 1GB is ample for map images
  5. Deploy the service

- [ ] **Step 2: Verify the volume is working**

  Visit `https://blackmoor-production.up.railway.app/api/maps?session_id=test` — should return `[]` (empty array, no error).

  Upload a test map via the DM maps page. If the image appears after a page refresh, the volume is working.

- [ ] **Step 3: Local dev note**

  Locally, images go to `/data/maps/` on your machine. If you want a different local path, set:
  ```
  MAPS_DIR=/Users/moon/blackmoor/local-maps
  ```
  in `.env.local`. Create the directory first.

---

## Verification Checklist

After completing all tasks and deploying:

- [ ] DM can create a map, upload an image, and see it in the thumbnail strip
- [ ] DM can click tiles to reveal them (green tint appears)
- [ ] DM can drag to reveal multiple tiles
- [ ] DM can click a revealed tile to re-fog it
- [ ] DM can add a note to a tile (red dot appears; note text visible in sidebar)
- [ ] Reset fog clears all tiles (requires two clicks; auto-cancels after 3s)
- [ ] Reveal all reveals everything (requires two clicks)
- [ ] Grid setup panel updates canvas live; Save persists changes
- [ ] Player page shows no map panel when no tiles are revealed
- [ ] Player page shows fog-of-war canvas once first tile is revealed
- [ ] Player map tabs only show maps with revealed tiles
- [ ] Player map updates within ~2 seconds of DM reveal
- [ ] "⚠ Offline" badge appears if network fails; recovers to "● Live" when restored
- [ ] Image serve endpoint rejects filenames with `../` (returns 400)
- [ ] DM notes never appear in `/api/maps/[id]/player` response
