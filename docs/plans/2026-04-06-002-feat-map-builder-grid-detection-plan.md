# Map Builder — Grid Detection, D&D Scale, Site-Wide Consistent Display

**Date:** 2026-04-06
**Branch:** `feat/map-builder`
**Type:** feat
**Origin:** Conversation request — direct to plan (no `ce:brainstorm`)
**Depth:** Standard

## Problem

Today, when the DM uploads a map image to the builder, Blackmoor knows nothing about the image's grid: type, cell pixel size, or real-world scale. As a result:

1. Two uploaded maps render at unrelated zoom levels — a 30 ft room and a 100 ft courtyard look the same size on screen.
2. The builder defaults every image to a hardcoded `30×30 m` overlay regardless of what the image actually depicts.
3. The DM has no way to tag a map as interior / exterior / overland.

We want: drop a map → Blackmoor analyzes it → returns grid type + cell size + scale guess → DM confirms or tweaks → the map is stored with a real-world scale → it renders at a **canonical screen size** anywhere in the app (`60 px = 5 ft` site-wide).

## Goals

1. **Re-enable Mappy (Claude Vision)** with a new analysis prompt focused on grid detection rather than overall dimensions.
2. **Persist grid + scale metadata** on `map_builds` and propagate to the frozen `maps` row when linked.
3. **Auto-tag** maps:
   - Hex detected → `scale_mode = overland`, `map_kind = overland`
   - Square detected → `scale_mode = combat`, default `map_kind = interior` (DM picks final tag)
4. **Manual two-point calibration** as a fallback when Mappy returns no grid or low confidence.
5. **Canonical site-wide scale**: `12 px = 1 ft` (a 5 ft cell renders at 60 screen px). Apply in:
   - Map builder editor (`BuilderCanvas`)
   - Session map view (`DmMapsClient` / `MapCanvas`)
6. **Wipe existing dev `map_builds`** so the new schema starts clean.

## Non-Goals

- Updating the Journey page or any player-facing map view in this round.
- d6 / 1" square / N-template overlays — captured as **deferred enhancements** (see end of plan).
- Hand-rolled image processing (Hough lines, FFT). Mappy + manual fallback only.
- Re-flowing existing `maps` table rows in production — this is a dev branch wipe.

## D&D Scale Conventions (decided)

| Grid type | Scale mode | Real-world per cell | Auto-applied when |
|---|---|---|---|
| Square | Combat | **5 ft** | Mappy detects square grid |
| Hex | Overland | **6 miles** (= 31 680 ft) | Mappy detects hex grid |
| Square | Overland | **1 mile** | DM manually overrides (rare) |
| Hex | Combat | **5 ft** | DM manually overrides |

**Canonical screen scale:** `PX_PER_FT = 12` → 5 ft cell = 60 screen px. Stored as a constant in `lib/map-scale.ts`. Used by both the builder and the viewer to compute the image display size.

## Open Decisions (resolved)

1. **What does the DM see if Mappy is unavailable?** → A manual-calibration UI: "Click two points on the image and tell us the real distance between them in feet." We store the calculated `cell_size_px` from that.
2. **Hex orientation detection** — Mappy returns `flat` or `pointy`. If unsure, default to `flat` (matches existing builder).
3. **Square `map_kind` options** — `interior`, `exterior`, `dungeon`, `town`, `other`. Default `interior`. Editable from the confirmation panel.
4. **Maps that fail Mappy and the DM doesn't calibrate** — fall back to the current default (no scale; image displays at natural pixel size). Marked `scale_mode = none` so the viewer skips scale-correction. Acceptable v1 escape hatch.

## Files

### Schema
- **`lib/schema.ts`** — add columns to `map_builds` (use `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` + `.catch(() => {})`):
  ```sql
  ALTER TABLE map_builds ADD COLUMN IF NOT EXISTS grid_type        TEXT;
  ALTER TABLE map_builds ADD COLUMN IF NOT EXISTS hex_orientation  TEXT;
  ALTER TABLE map_builds ADD COLUMN IF NOT EXISTS cell_size_px     INTEGER;
  ALTER TABLE map_builds ADD COLUMN IF NOT EXISTS scale_mode       TEXT;
  ALTER TABLE map_builds ADD COLUMN IF NOT EXISTS scale_value_ft   REAL;
  ALTER TABLE map_builds ADD COLUMN IF NOT EXISTS map_kind         TEXT;
  ALTER TABLE map_builds ADD COLUMN IF NOT EXISTS image_path       TEXT;
  ALTER TABLE map_builds ADD COLUMN IF NOT EXISTS image_width_px   INTEGER;
  ALTER TABLE map_builds ADD COLUMN IF NOT EXISTS image_height_px  INTEGER;
  ```
- **One-time dev wipe:** add a self-deleting `DELETE FROM map_builds` somewhere safe (or just delete via `curl` after deploy — see Verification). Per user direction, prefer the curl approach over a permanent migration.

### Types
- **`lib/types.ts`** — extend `MapBuild`:
  ```ts
  grid_type: 'square' | 'hex' | 'none' | null;
  hex_orientation: 'flat' | 'pointy' | null;
  cell_size_px: number | null;
  scale_mode: 'combat' | 'overland' | 'none' | null;
  scale_value_ft: number | null;
  map_kind: 'interior' | 'exterior' | 'dungeon' | 'town' | 'overland' | 'other' | null;
  image_path: string | null;
  image_width_px: number | null;
  image_height_px: number | null;
  ```

### Mappy AI (re-add)
- **`lib/mappy.ts`** — restore from git history (`git show e1921c4:lib/mappy.ts`) but **rewrite the prompt** for grid analysis. New tool schema:
  ```ts
  {
    name: 'report_grid',
    input_schema: {
      grid_type:        'square' | 'hex' | 'none',
      hex_orientation:  'flat' | 'pointy' | null,
      cell_size_px:     number | null,    // pixels per cell at natural image size
      scale_guess:      'combat' | 'overland',
      confidence:       'low' | 'medium' | 'high',
      notes:            string,
    }
  }
  ```
  New prompt is anchored on visual cues for grid detection — visible grid lines, repetition periodicity, hex symmetry, presence/absence of minis-vs-overworld features.
- **`app/api/map-builder/[id]/mappy/route.ts`** — restore from git history; rename internal call to `analyzeMapGrid()`. Same graceful degradation on missing API key (returns `fallback: true` with `grid_type: 'none'`).

### Map Builder client + flow
- **`components/MapBuilderClient.tsx`** — extend `createBuildFromImage`:
  1. Create build (existing).
  2. Upload image (existing) — also capture `image_width_px` / `image_height_px` from the image.
  3. **Call Mappy** with the base64 → get grid analysis.
  4. Open editor.
  5. Show a new **Grid Confirmation Panel** overlay with Mappy's suggestion pre-filled. DM can:
     - Switch grid type (Square / Hex / None radio)
     - Switch `map_kind` (Interior / Exterior / Dungeon / Town / Overland / Other — segmented buttons, no dropdown per `DESIGN.md`)
     - Switch scale mode (Combat / Overland)
     - Adjust `cell_size_px` with +/- steppers
     - **Manual calibration link**: "Click two points and enter distance" → opens the calibration tool
  6. On Apply → PATCH `/api/map-builder/[id]` with all new fields → close panel.
- **New helper `lib/map-scale.ts`** — exports `PX_PER_FT = 12`, plus utilities:
  - `cellScreenPx(scale_value_ft) → number` (e.g., `5 → 60`)
  - `imageDisplaySize({ image_width_px, image_height_px, cell_size_px, scale_value_ft }) → { w, h }` — the screen size to render an image so its grid hits the canonical scale.

### Manual calibration UI
- **`components/MapBuilderClient.tsx`** — inline component `CalibrationTool`:
  - DM clicks point A on the image → marker drops.
  - DM clicks point B → marker drops + line drawn.
  - Inline input: "Distance in feet between A and B?"
  - On submit: compute `pixels_between = √(Δx² + Δy²)`, `cell_size_px = pixels_between / (distance_ft / scale_value_ft)`. Apply.

### Builder canvas — apply canonical scale
- **`components/BuilderCanvas.tsx`** — when an image overlay is committed and the build has `scale_value_ft` + `cell_size_px`, render the image at `imageDisplaySize(...)` instead of natural size. This gives every uploaded map the same on-screen feet-per-pixel.

### Session map view — apply canonical scale
- **`components/MapCanvas.tsx`** — currently scales the image to fit `width × height`. New behavior when the source row carries `scale_value_ft` + `cell_size_px`:
  - Compute `imageDisplaySize(...)` from the row.
  - Render the image at that fixed size, with internal scrolling/panning if it overflows the container (the canvas already supports this conceptually — viewport state).
  - If the row has no scale data (legacy or `scale_mode = none`), fall back to current "fit to container" behavior. No regression.
- **`components/MapCanvas.tsx`** — extend `MapRow`/`PlayerMapRow` types via `lib/types.ts` to include the new scale fields (nullable for back-compat).

### Frozen-copy propagation
- **`app/api/map-builder/[id]/link/route.ts`** — when inserting into `maps`, also write `grid_type`, `hex_orientation`, and (new for `maps`) `scale_value_ft`, `cell_size_px` so the session map renders at the same canonical scale as the builder. Add the same columns to `maps` via `ALTER TABLE` in `lib/schema.ts`.
- **`lib/schema.ts`** — also add `scale_value_ft REAL` and `cell_size_px INTEGER` to `maps`.

## Patterns to Follow

- Confirmation panel: model after the existing Long Rest confirm UI (`DESIGN.md` Session Control Bar) — segmented circle buttons, gold accents, no dropdowns.
- File-upload pattern: existing `createBuildFromImage` in `MapBuilderClient.tsx`.
- Schema extension: existing `.catch(() => {})` ALTER pattern in `lib/schema.ts`.
- Mappy code recovery: `git show e1921c4:<path>` then rewrite the prompt + tool schema.
- Canonical-scale constant: define once in `lib/map-scale.ts`, import everywhere.

## Verification

1. **Restart server**, hit `/api/map-builder` → confirm 200 and rows include the new (null) columns.
2. **Wipe existing dev builds:** `curl -X DELETE` each existing build, or run a one-time `psql ... DELETE FROM map_builds` if Railway access is available.
3. **Drop a clean square-grid map** (e.g., a published 5e dungeon battle map):
   - Mappy returns `square`, `cell_size_px ≈ 70` (or whatever), `confidence: high`.
   - Confirmation panel shows: `Square / Combat / Interior / 5 ft / 70 px`.
   - Apply → builder canvas renders the image so each grid cell occupies exactly 60 screen px.
4. **Drop a hex overland map** → Mappy returns `hex`, panel pre-fills `Overland / 6 mi`. Apply → image renders at hex-overland scale.
5. **Drop a hand-drawn / no-grid map** → Mappy returns `none, confidence: low` → Calibration tool opens. Click two points across a known distance, enter feet → apply → image scales correctly.
6. **Drop two square maps in a row** (one small dungeon room, one large hall). Open both. Confirm: both render with 5 ft cells at 60 screen px (same on-screen scale).
7. **Link a build to a session** via the existing in-editor link panel → open `/dm/maps`, find the new row → confirm the session map view renders the image at the same canonical scale as the builder.
8. **Mappy missing API key** → set `ANTHROPIC_API_KEY=""` → drop image → server returns `fallback: true, grid_type: 'none'` → calibration tool opens. No crash.
9. `tsc --noEmit` clean (excluding stale `.next/types`).

## Risks & Mitigations

- **Mappy grid detection is unreliable on hand-drawn maps.** *Mitigation:* always show the confirmation panel — DM can override anything. Calibration tool is the always-available escape hatch. Confidence level shown so DM knows when to second-guess.
- **`ensureSchema` memoization** — new columns require a server restart. *Mitigation:* kill/restart dev server immediately after editing `lib/schema.ts`. Wrap ALTERs in `.catch(() => {})`.
- **Cost of Mappy on every upload** — Sonnet image analysis is roughly $0.01–0.04 per call. *Mitigation:* user has approved (#1 in Q&A). Not a hot path — DM-only, manual action. Add no automatic retries.
- **Existing `maps` rows lack scale data** — viewer changes must not break them. *Mitigation:* viewer falls back to current "fit to container" rendering when `scale_value_ft` is null. Verified by leaving any pre-existing rows untouched.
- **Pixel-perfect cell alignment** — image natural width may not be an integer multiple of `cell_size_px`. *Mitigation:* compute display size as `(natural_w / cell_size_px) * cellScreenPx(scale_value_ft)` — fractional px is fine for image rendering, only the grid overlay needs integer alignment, which the existing canvas already handles via floor/ceil.
- **Two-point calibration math errors** — easy to off-by-N. *Mitigation:* verify with a hand calculation on first manual calibration. The math: `cell_size_px = pixels_between × (scale_value_ft / distance_ft_entered)`.
- **Type propagation** — new MapBuild + MapRow fields ripple. *Mitigation:* `tsc --noEmit` before commit (per `feedback_tsc_before_deploy.md`).

## Implementation Units

### Unit 1 — Schema + types + scale constant
**Files:** `lib/schema.ts`, `lib/types.ts`, `lib/map-scale.ts` (new)

- Add columns to `map_builds` and `maps`.
- Extend `MapBuild`, `MapRow`, `PlayerMapRow` types with the new optional fields.
- Create `lib/map-scale.ts` with `PX_PER_FT = 12`, `cellScreenPx`, `imageDisplaySize`.

**Verification:** restart server, `curl /api/map-builder` returns rows with new null columns. `tsc --noEmit` clean.

### Unit 2 — Restore Mappy with grid-detection prompt
**Files:** `lib/mappy.ts` (new), `app/api/map-builder/[id]/mappy/route.ts` (new), `package.json` (`@anthropic-ai/sdk` may already be installed)

- Recover both files from `git show e1921c4:...`.
- Rewrite `MAPPY_PROMPT` to focus on grid detection — list cues for square vs hex, ask for `cell_size_px`, ask for `scale_guess`.
- Rewrite the tool schema (`report_grid`).
- Keep graceful degradation: missing API key returns `fallback: true, grid_type: 'none', confidence: 'low'`.

**Verification:** `curl -X POST` with a sample base64 image to `/api/map-builder/{id}/mappy` returns grid analysis JSON. Without API key, returns fallback object with status 200.

### Unit 3 — Image upload calls Mappy + persists results
**Files:** `components/MapBuilderClient.tsx`, `app/api/map-builder/[id]/route.ts` (already supports PATCH; just verify the new fields go through the column whitelist)

- Update `createBuildFromImage`:
  - After upload, capture `image_width_px` / `image_height_px` from the file (decode dimensions client-side via `Image()` or accept them from server response).
  - Call `/api/map-builder/{id}/mappy` with `base64` + `media_type`.
  - Store result in new state `gridAnalysis`.
- Open the editor (existing).
- Render the **Grid Confirmation Panel** overlay (new component or inline JSX in `MapBuilderClient`).
- On Apply → PATCH `/api/map-builder/{id}` with all the grid + scale fields.

**Verification:** drop a square map → confirmation panel shows pre-filled values → click Apply → reload page → values persisted.

### Unit 4 — Manual calibration tool
**Files:** `components/MapBuilderClient.tsx` (or split into `components/CalibrationTool.tsx`)

- Two-click point selection on the image overlay.
- Distance input (feet).
- Compute `cell_size_px = pixels_between × (scale_value_ft / distance_ft_entered)`.
- Apply → updates the grid confirmation panel state, then DM clicks Apply on the panel as usual.

**Verification:** drop a no-grid map → calibration tool opens → click 100 ft apart in the image → enter "100" → cell_size_px computed correctly → apply.

### Unit 5 — Canonical scale rendering in builder + viewer
**Files:** `components/BuilderCanvas.tsx`, `components/MapCanvas.tsx`

- `BuilderCanvas`: when the active build has `scale_value_ft` + `cell_size_px`, compute `imageDisplaySize` and use that as the rendered size for the image overlay (instead of natural).
- `MapCanvas`: same logic. Fall back to current "fit container" behavior when scale fields are null.
- Both components import from `lib/map-scale.ts`.

**Verification:** drop two square maps of different real-world size → both render with 5 ft cells at 60 screen px. Open one in the session map view → same scale. Open a legacy map (no scale fields) → falls back to current behavior, no crash.

### Unit 6 — Frozen-copy propagation in `[id]/link`
**Files:** `app/api/map-builder/[id]/link/route.ts`, `lib/schema.ts` (already updated in Unit 1 for `maps` columns)

- In the existing transaction, also project `cell_size_px` and `scale_value_ft` from `map_builds` into the `maps` insert.
- Verify the existing `grid_type` projection (already there) now reads from `map_builds.grid_type` rather than the hardcoded `'hex'`.

**Verification:** link a build → check `maps` row → confirm `cell_size_px`, `scale_value_ft`, `grid_type`, `hex_orientation` all carried over.

### Unit 7 — Wipe dev builds
**Steps:**
1. After Unit 1 deploys, `curl -X DELETE http://localhost:3000/api/map-builder/{id}` for each existing build, OR run `psql $DATABASE_URL -c "DELETE FROM map_builds"` if convenient.
2. No code change. Verification: `curl /api/map-builder` returns `[]`.

## Deferred enhancements (capture for v2 — not in scope here)

These are the user's "consider after this round" items:

1. **D6 reference upload** — DM places a real d6 on the map and re-uploads. Mappy uses the d6 (~16 mm = ~0.05 ft, but more practically ~1 inch on table) as a known scale anchor.
2. **1-inch square marker** — DM tapes/draws a 1" square on the map before photographing. Mappy locates it and uses it as the scale anchor.
3. **3×3 scale + direction template overlay** — a downloadable PNG the DM can paste onto a map image before upload. Includes a 3×3 grid (15 ft × 15 ft at combat scale) and a north arrow. Mappy detects it and gets both scale and orientation in one shot.
4. **Ruler image overlay** — a 30 ft ruler PNG the DM can drop onto the map image as an in-image scale bar.

Capture these in `project_map_builder.md` memory after this round merges.
