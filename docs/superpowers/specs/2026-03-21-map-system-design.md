# Map System Design
**Date:** 2026-03-21
**Project:** Blackmoor — Shadow of the Wolf
**Status:** Approved

---

## Overview

A fog-of-war map system for D&D sessions. The DM uploads battle maps (PNG/JPG) and reveals tiles to players in real time. Players see fog-of-war on their character pages; the DM sees the full map with indicators of revealed areas and private notes.

---

## Constraints & Decisions

| Question | Decision |
|---|---|
| Map format | Image files (PNG/JPG) — square grids from Affinity Designer, hex grids from Houdini |
| Grid rendering | HTML Canvas (Option A) — one consistent system for both grid types |
| Live updates | Client-side polling every 2 seconds (player only) |
| Image storage | Railway Volume mounted at `/data/maps/` |
| DM view | Full map always visible; green tint on revealed tiles; red dot on noted tiles |
| Player view | Fog-of-war; only revealed tiles visible |
| Map switching | Player independently chooses which map to view via tabs |
| Tab visibility | Player tabs only appear for maps with ≥1 revealed tile |
| DM notes | Tile-anchored text, never sent to any player endpoint |
| Destructive ops | Two-click confirmation (existing app pattern) for Reset fog and Reveal all |
| Session_id FK | No FK constraint — intentional, consistent with existing schema (`player_sheets` also has no FK). Orphaned maps on session delete are acceptable for this small trusted-user app. |
| Reordering maps | Not in scope for v1. Maps appear in `created_at` order. |

---

## Data Model

### `maps` table

```sql
CREATE TABLE IF NOT EXISTS maps (
  id              TEXT PRIMARY KEY,           -- server-generated UUID (crypto.randomUUID())
  session_id      TEXT NOT NULL,
  name            TEXT NOT NULL DEFAULT '',
  image_path      TEXT NOT NULL DEFAULT '',   -- filename on Railway Volume, e.g. 'abc123.png'
  grid_type       TEXT NOT NULL DEFAULT 'square',  -- 'square' | 'hex'
  cols            INTEGER NOT NULL DEFAULT 20,
  rows            INTEGER NOT NULL DEFAULT 15,
  offset_x        REAL NOT NULL DEFAULT 0,    -- pixel offset to align grid overlay to image
  offset_y        REAL NOT NULL DEFAULT 0,
  tile_px         REAL NOT NULL DEFAULT 40,   -- reference tile size in pixels (at natural image width)
  hex_orientation TEXT NOT NULL DEFAULT 'flat', -- 'flat' | 'pointy' (hex only; ignored for square)
  revealed_tiles  JSONB NOT NULL DEFAULT '[]', -- [[col,row], ...] — set semantics, not toggle
  dm_notes        JSONB NOT NULL DEFAULT '[]', -- [{col, row, text}, ...]
  sort_order      INTEGER NOT NULL DEFAULT 0,  -- assigned = created_at epoch ms; no reorder in v1
  created_at      BIGINT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS maps_session_id_idx ON maps (session_id, sort_order);
```

Add to `lib/schema.ts` using the existing `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS` pattern.

---

## API Routes

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/maps` | none | Create map (metadata only) |
| `GET` | `/api/maps?session_id=X` | none | List maps for a session |
| `GET` | `/api/maps/[id]` | none | Full map data — DM only (includes `dm_notes`) |
| `GET` | `/api/maps/[id]/player` | none | Player version — `dm_notes` never included |
| `PATCH` | `/api/maps/[id]` | none | Update metadata (name, grid settings) |
| `PATCH` | `/api/maps/[id]/reveal` | none | Set or clear tiles |
| `PATCH` | `/api/maps/[id]/notes` | none | Upsert/delete a DM note |
| `POST` | `/api/maps/[id]/image` | none | Upload image file |
| `GET` | `/api/maps/image/[filename]` | none | Serve image file from Volume |
| `DELETE` | `/api/maps/[id]` | none | Delete map row + image file |

No authentication — consistent with rest of app (small trusted group).

---

## API Details

### `POST /api/maps`

Request body:
```json
{ "session_id": "string", "name": "string", "grid_type": "square|hex" }
```
Server generates `id = crypto.randomUUID()` and `created_at = Date.now()`.
`sort_order` = `Date.now()` (same value — ensures creation-order sort).
Response: the full created map row.

---

### `GET /api/maps/[id]/player`

Selects only: `id, session_id, name, image_path, grid_type, cols, rows, offset_x, offset_y, tile_px, hex_orientation, revealed_tiles`.
`dm_notes` is never referenced in this query.

---

### `PATCH /api/maps/[id]/reveal`

**Semantics: set, not toggle.**
```json
{ "tiles": [[col, row], ...], "revealed": true | false }
```
- `revealed: true` — add tiles to `revealed_tiles` (union, no duplicates)
- `revealed: false` — remove tiles from `revealed_tiles`

Implementation: use PostgreSQL JSONB operators or read-modify-write in application code.
Drag-reveal always calls with `revealed: true`. The DM can click an already-revealed tile with `revealed: false` to re-fog it.

---

### `PATCH /api/maps/[id]/notes`

```json
{ "col": number, "row": number, "text": "string" }
```
- If `text` is non-empty: upsert the note (match by col+row, replace text or insert)
- If `text` is empty string: delete the note for that tile
Response: `{ ok: true }`

---

### `POST /api/maps/[id]/image`

- Body: `multipart/form-data` with a single field `file`
- Accepted MIME types: `image/png`, `image/jpeg`, `image/webp` — return 415 for others
- Maximum file size: 20MB — return 413 with `{ error: 'File too large (max 20MB)' }` if exceeded
- If the map row already has an `image_path`, delete the old file from disk before saving the new one (prevent orphaned files)
- Saved as `/data/maps/[crypto.randomUUID()].[ext]`
- Updates `image_path` on the map row
- Response: `{ ok: true, image_path: "abc123.png" }`

---

### `GET /api/maps/image/[filename]`

**Security:** Before reading, validate that `filename` matches `/^[a-zA-Z0-9_-]+\.(png|jpg|jpeg|webp)$/`. Reject with 400 for any filename containing `.`, `/`, or other path characters beyond the extension dot. This prevents path traversal attacks.

Stream the file from `/data/maps/[filename]` with appropriate `Content-Type` header.
Return 404 if the file does not exist.

---

### `DELETE /api/maps/[id]`

1. Load map row to get `image_path`
2. Delete DB row
3. Attempt to delete `/data/maps/[image_path]` — if file not found or unlink fails, log the error but do **not** fail the request (the DB row is the source of truth; orphaned files are acceptable)
4. Response: `{ ok: true }`

---

## Image Storage

Images stored on a Railway Volume mounted at `/data/maps/`. Attach the volume to the Next.js service in Railway's dashboard with mount path `/data`.

- `image_path` stores only the filename (`abc123.png`), not the full path
- Thumbnails are not generated — same image used at all sizes; CSS `object-fit: cover` handles scaling
- The `/data/maps/` directory must be created on first use: `fs.mkdirSync('/data/maps', { recursive: true })`

---

## Canvas Rendering

### `MapCanvas` component props

```typescript
interface MapCanvasProps {
  mapData: MapWithTiles;          // full map row (DM) or player map row
  mode: 'dm' | 'player';
  width: number;                  // canvas pixel width
  height: number;                 // canvas pixel height
  onTileClick?: (col: number, row: number, shiftKey: boolean) => void;
  // shiftKey = true means drag-reveal is in progress
  // not provided in player mode (canvas is read-only)
  activeNoteCoord?: [number, number] | null;  // highlights this tile in DM note mode
}
```

### Rendering pipeline (both modes)

```
1. Draw image as background (ctx.drawImage, scaled to canvas dimensions)
2. In player mode: fill entire canvas with fog (rgba(0,0,0,0.88))
   In DM mode: no fog — full map always visible
3. For each revealed tile:
   - Player: clearRect then redraw that portion of the image (clip-draw)
   - DM: fill with rgba(60,140,60,0.22) green tint
4. Draw grid lines (rgba(200,180,150,0.18), 0.5px)
5. DM only: draw red dot (r=3.5px) in top-right corner of tiles with dm_notes
6. DM only: draw gold border (rgba(200,168,76,0.8), 2px) on hovered tile
7. DM only: draw gold border on activeNoteCoord tile if set
```

### Scale factor

The grid parameters (`cols`, `rows`, `offset_x`, `offset_y`, `tile_px`) are defined at the image's **natural width**. When rendering at a different canvas size, apply a uniform scale factor:
```
scaleX = canvas.width  / image.naturalWidth
scaleY = canvas.height / image.naturalHeight
```
All pixel values are multiplied by the appropriate scale before drawing.

### Square grid math

```typescript
const tileW = (tile_px * scaleX);
const tileH = (tile_px * scaleY);  // may differ from tileW if image is non-square

// Click → tile
const col = Math.floor((clickX - offset_x * scaleX) / tileW);
const row = Math.floor((clickY - offset_y * scaleY) / tileH);

// Tile → pixel rect
const x = col * tileW + offset_x * scaleX;
const y = row * tileH + offset_y * scaleY;
```

### Hex grid math (flat-top)

```typescript
const R = (tile_px / 2) * scaleX;  // hex circumradius
const W = R * 2;                    // hex width (flat-top)
const H = R * Math.sqrt(3);        // hex height
const colStep = W * 0.75;
const rowStep = H;
const ox = offset_x * scaleX;
const oy = offset_y * scaleY;

// Tile center
const cx = col * colStep + ox + R;
const cy = row * rowStep + oy + H / 2 + (col % 2 === 1 ? H / 2 : 0);

// Click → hex (pixel to axial, then cube-coordinate rounding)
function pixelToHex(px: number, py: number): [number, number] {
  // Shift by offset
  const x = px - ox - R;
  const y = py - oy - H / 2;
  // Axial coordinates (fractional)
  const q = (2/3 * x) / R;
  const r = (-1/3 * x + Math.sqrt(3)/3 * y) / R;
  // Cube rounding
  const s = -q - r;
  let rq = Math.round(q), rr = Math.round(r), rs = Math.round(s);
  const dq = Math.abs(rq - q), dr = Math.abs(rr - r), ds = Math.abs(rs - s);
  if (dq > dr && dq > ds) rq = -rr - rs;
  else if (dr > ds) rr = -rq - rs;
  // Axial to offset column coordinates
  const col = rq;
  const row = rr + Math.floor(rq / 2);  // "even-q" offset
  return [col, row];
}
```

For pointy-top orientation: swap the roles of x/y and W/H throughout.

---

## DM Maps Page

**Route:** `/dm/maps?session=SESSION_ID`

**Rendering:** Server component fetches initial map list; canvas interaction is client-side. DM view does **not** poll — it loads once and uses optimistic updates (PATCH → update local state immediately, no re-fetch needed). If a note is saved, the dm_notes array in local state is updated directly.

### Canvas dimensions

- Width: fills available space minus controls sidebar (160px) and gap
- Height: `min(480px, viewportHeight - 200px)` — preserves map aspect ratio via CSS `aspect-ratio` or `object-fit` on the canvas
- Canvas element is sized to match the container via a ResizeObserver

### Layout

```
┌─ Sticky nav: ← Session 1 | Maps ───────────────────────────────┐
│                                                                  │
│  Thumbnail strip (scrollable):                                   │
│  [Woods▼] [Graveyard] [Crypt] [Level 1] [Level 2] [+Add map]    │
│  each thumb: 150×118px, active = gold border                     │
│                                                                  │
│  ┌─ Canvas ─────────────────────────────────────┐ ┌─ Controls ─┐│
│  │                                              │ │ Mode:       ││
│  │  Full map + green tint + red dots + grid     │ │ [☀ Reveal]  ││
│  │                                              │ │ [✎ Note]    ││
│  └──────────────────────────────────────────────┘ │             ││
│                                                   │ Selected:   ││
│                                                   │ [note text] ││
│                                                   │             ││
│                                                   │ [↺ Reset]   ││
│                                                   │ [✓ Reveal]  ││
│                                                   │             ││
│                                                   │ [⚙ Grid]    ││
│                                                   └─────────────┘│
└──────────────────────────────────────────────────────────────────┘
```

### Interactions

- **Reveal/Hide mode** (default): click tile → set `revealed: true`; click already-revealed tile → set `revealed: false`; mousedown + drag → reveal all tiles under cursor (`revealed: true` only, no drag-unreveal)
- **Note mode**: click tile → sidebar shows existing note text (or empty); text input + Save → PATCH notes; clear text + Save → deletes note
- **Reset fog** / **Reveal all**: two-click confirmation. First click: button text changes to "Are you sure?" and turns red. Auto-reverts after 3 seconds. Second click: fires the operation.

### Grid setup overlay

- Accessible via "⚙ Configure grid…" button
- Shows controls for `cols`, `rows`, `offset_x`, `offset_y`, `tile_px`, `grid_type`, `hex_orientation`
- Canvas re-renders the grid overlay on every input change (immediate preview, not saved yet)
- "Save" button sends `PATCH /api/maps/[id]` with updated grid params
- "Cancel" reverts local state to last saved values

---

## Player Map Panel

**Location:** Below the character sheet on each `/players/[id]` page, rendered by `PlayerMapPanel` client component.

### Session resolution

The player page receives the `playerId` (e.g. `'katie'`). The `PlayerMapPanel` needs to find maps for the current session. Resolution strategy: **query all sessions ordered by `last_modified DESC LIMIT 1`** — the most recently active session is treated as the current one. This is fetched once on mount via `GET /api/sessions?limit=1&sort=recent` (or inline in the existing sessions API). Maps for that session are then listed via `GET /api/maps?session_id=X`.

If no session exists yet, the panel renders nothing (no map section shown).

### Polling

- On mount: fetch map list for current session → set active tab to first map with revealed tiles
- Poll `GET /api/maps/[activeMapId]/player` every 2000ms
- Compare `JSON.stringify(newData.revealed_tiles)` to previous — only re-render canvas if changed
- On tab switch: cancel current poll, start polling new map id
- Polling error state: after 3 consecutive failed polls, replace "● Live" badge with "⚠ Offline" in amber — resume badge returns to green on next success

### Canvas dimensions

- Width: 100% of panel (near page edge, matching the character sheet width)
- Height: 260px fixed

### Layout

```
┌─ [Woods] [Graveyard] [Crypt]   ← tabs flush left, no label ───┐
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Fog-of-war canvas (full width × 260px)                  │  │
│  │                                                   ● Live │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

- Tabs only rendered for maps where `revealed_tiles.length > 0`
- Panel not rendered at all if no maps have any revealed tiles
- Canvas is read-only (no click handlers)

---

## Components

| Component | Type | File | Description |
|---|---|---|---|
| `MapCanvas` | Client | `components/MapCanvas.tsx` | Reusable canvas renderer — square + hex, DM + player modes |
| `DmMapsPage` | Server + Client boundary | `app/dm/maps/page.tsx` | Server fetches initial list; client handles interaction |
| `MapThumbnail` | Client | inside `DmMapsPage` | Mini canvas in thumbnail strip |
| `PlayerMapPanel` | Client | `components/PlayerMapPanel.tsx` | Session resolution, polling, tab UI |
| `GridSetupPanel` | Client | inside `DmMapsPage` | Grid alignment controls with live preview |

---

## Files to Create / Modify

```
app/
  dm/maps/
    page.tsx                        — DM maps page (new)
  api/
    maps/
      route.ts                      — POST (create), GET (list by session_id)
      [id]/
        route.ts                    — GET (DM full), PATCH (metadata), DELETE
        player/
          route.ts                  — GET (player version, no notes)
        reveal/
          route.ts                  — PATCH (set/clear tiles)
        notes/
          route.ts                  — PATCH (upsert/delete note)
        image/
          route.ts                  — POST (upload)
    maps/image/
      [filename]/
        route.ts                    — GET (serve file, with path-traversal guard)

components/
  MapCanvas.tsx                     — canvas renderer (new)
  PlayerMapPanel.tsx                — player polling panel (new)

lib/
  schema.ts                         — add maps table + index migration
  types.ts                          — add MapRow, PlayerMapRow, DmNote, GridType types

app/players/[id]/page.tsx           — add <PlayerMapPanel playerId={id} /> below <Sheet />
app/dm/page.tsx                     — add "Maps" link in session list items
```

---

## Types

```typescript
// lib/types.ts additions

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

// Player version — dm_notes omitted
export type PlayerMapRow = Omit<MapRow, 'dm_notes'>;
```

---

## Out of Scope (v1)

- Token placement (player/NPC markers on map)
- Drawing tools (DM freehand annotations)
- Initiative tracker overlay
- Map sharing between sessions
- Multiple active maps simultaneously
- Map reordering in thumbnail strip
- Authentication / role-based access control
