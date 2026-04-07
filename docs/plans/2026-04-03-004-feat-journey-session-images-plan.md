---
title: "feat: Journey page session images — display and drag-and-drop upload"
type: feat
status: active
date: 2026-04-03
---

# Journey Page Session Images

## Overview

Each session on the Journey page gets two images: a **circle image** (displayed in the session stop circle) and a **background image** (displayed in the tall terrain box). Images follow a naming convention (`s{number}_circle.*`, `s{number}_bg.*`) and are served from uploaded storage. The DM can drag-and-drop new images onto either the circle or the box to upload/replace them. When no image exists, the current fallback behavior is preserved (session number/title in circle, blue-tinted box).

## Problem Frame

The Journey page currently references hardcoded image paths (`journey_box_{i+1}.png`, `stop_{number}.png`) that don't follow a consistent convention and have no upload mechanism. The DM needs to easily add session art without touching the filesystem.

## Requirements Trace

- R1. Each session displays up to 2 images: circle (`s{x}_circle.*`) and background (`s{x}_bg.*`)
- R2. Images served from persistent uploaded storage, not `public/`
- R3. When no image exists for a slot, the current fallback renders (number/title in circle, plain blue box)
- R4. DM can drag-and-drop an image onto the circle or box to upload it
- R5. Upload replaces any existing image for that slot
- R6. Existing `s1_circle.png` and `s1_bg.png` in `public/images/journey/` should be migrated or seeded into the upload directory

## Scope Boundaries

- No bulk upload, no image cropping, no thumbnail generation
- No player-facing upload — DM only (no auth gate needed since the page is already under `/dm/`)
- Image format/size validation reuses existing 4MB / png/jpeg/webp/gif constraints
- No changes to the journey path, SVG, or layout — only the image sources and drop targets

## Context & Research

### Relevant Code and Patterns

- **Upload API pattern:** `app/api/uploads/players/route.ts` — FormData POST, writes to `DATA_DIR/uploads/players/`, returns API path. Reuse this pattern for journey images.
- **Serve route pattern:** `app/api/uploads/players/[filename]/route.ts` — reads file from disk, returns it with correct content-type.
- **Current journey images:** `public/images/journey/s1_circle.png`, `s1_bg.png` exist. Other sessions have no images yet.
- **JourneyClient.tsx:** Currently uses `journey_box_{i+1}.png` for box and `stop_{number}.png` for circle, with `onError` hide pattern.
- **DM player portrait upload:** DM Players page has drag-and-drop onto player circles — same UX pattern to follow.

### Key Constraints

- Images stored in `DATA_DIR/uploads/journey/` (persistent on Railway)
- Naming convention: `s{number}_circle.{ext}` and `s{number}_bg.{ext}` — deterministic names, not UUIDs, so uploads replace previous versions
- Inline `style={{}}` for layout-critical elements (Safari compatibility)

## Key Technical Decisions

- **Deterministic filenames over UUIDs:** Since each session has exactly one circle and one bg image, use `s{number}_circle.{ext}` directly. Upload overwrites previous file. Simpler than tracking UUIDs in the DB.
- **No database column needed:** Image existence is determined by filesystem lookup (the API serve route returns 404 if missing). The client tries to load the image and falls back on error — same `onError` pattern already in use.
- **Upload API determines available images:** A GET endpoint on the upload route can list which session images exist, so the client knows upfront which slots have images (avoids broken image flashes).

## Open Questions

### Resolved During Planning

- **Where to store images?** `DATA_DIR/uploads/journey/` — consistent with players, items, npcs upload dirs.
- **How to handle multiple extensions?** Upload deletes any existing `s{x}_{slot}.*` before writing the new file, so there's never ambiguity about which extension to serve.

### Deferred to Implementation

- **Migration of existing `public/images/journey/s1_*` files:** Can be a manual copy or a one-time script. Not blocking.

## Implementation Units

- [ ] **Unit 1: Journey image upload API**

  **Goal:** Create POST endpoint for uploading journey session images and GET endpoint for listing available images, plus a serve route for the files.

  **Requirements:** R1, R2, R4, R5

  **Dependencies:** None

  **Files:**
  - Create: `app/api/uploads/journey/route.ts` (POST upload, GET list)
  - Create: `app/api/uploads/journey/[filename]/route.ts` (serve files)

  **Approach:**
  - POST accepts FormData with `session_number` (int) and `slot` ("circle" | "bg") and `image` (File)
  - Constructs filename as `s{number}_{slot}.{ext}`
  - Before writing, deletes any existing `s{number}_{slot}.*` files (glob for the pattern) to handle extension changes
  - Writes to `DATA_DIR/uploads/journey/`
  - Returns `{ path: "/api/uploads/journey/s{n}_{slot}.{ext}" }`
  - GET returns `{ images: { [key: string]: string } }` — e.g., `{ "s1_circle": "/api/uploads/journey/s1_circle.png", "s1_bg": "/api/uploads/journey/s1_bg.png" }`
  - Serve route reads file from disk, returns with correct content-type (same pattern as players serve route)

  **Patterns to follow:**
  - `app/api/uploads/players/route.ts` for upload logic
  - `app/api/uploads/players/[filename]/route.ts` for serve logic

  **Verification:**
  - POST with valid image returns 200 and the image path
  - GET lists all journey images on disk
  - Serve route returns the image with correct content-type
  - Re-uploading for the same slot replaces the previous image

- [ ] **Unit 2: Update JourneyClient to use uploaded images**

  **Goal:** Change image sources from hardcoded `public/` paths to uploaded API paths, with proper fallbacks.

  **Requirements:** R1, R2, R3

  **Dependencies:** Unit 1

  **Files:**
  - Modify: `components/JourneyClient.tsx`
  - Modify: `app/dm/journey/page.tsx` (pass image map as prop)

  **Approach:**
  - Server page fetches the image list from the upload directory (filesystem read, not HTTP — it's server-side)
  - Passes `imageMap: Record<string, string>` to JourneyClient (e.g., `{ "s1_circle": "/api/uploads/journey/s1_circle.png" }`)
  - Circle image: if `imageMap[s{n}_circle]` exists, render it in the circle with `object-cover`; otherwise keep current number/title fallback
  - Box image: if `imageMap[s{n}_bg]` exists, use it instead of `journey_box_{i+1}.png`; otherwise keep current blue-tinted box
  - Preserve existing `onError` hide pattern as safety net

  **Patterns to follow:**
  - Current `onError` image hide pattern in JourneyClient
  - Player portrait image display in SplashNav circles

  **Verification:**
  - Sessions with uploaded images show them in circle/box
  - Sessions without images show fallback (number in circle, blue box)
  - No broken image flashes

- [ ] **Unit 3: Drag-and-drop upload on circle and box**

  **Goal:** DM can drag an image onto a session circle or background box to upload it.

  **Requirements:** R4, R5

  **Dependencies:** Unit 1, Unit 2

  **Files:**
  - Modify: `components/JourneyClient.tsx`

  **Approach:**
  - Add `onDragOver`/`onDrop` handlers to both the circle element and the box element
  - On drop: extract the File, POST to `/api/uploads/journey` with `session_number` and `slot`
  - On success: update local state to show the new image immediately (optimistic update with the returned path)
  - Visual feedback: green border + slight scale on drag-over (same pattern as DM player portrait upload)
  - No drop zone visible by default — only activates on drag-over

  **Patterns to follow:**
  - DM Players page drag-and-drop portrait upload (green border on hover)

  **Verification:**
  - Dragging an image onto a circle uploads it as `s{n}_circle.*` and displays immediately
  - Dragging an image onto a box uploads it as `s{n}_bg.*` and displays immediately
  - Visual feedback (green border) appears on drag-over and disappears on drag-leave
  - Oversized or wrong-format files show an error (or are rejected silently)

## Risks & Dependencies

- **Railway persistent storage:** Upload dir must be under `DATA_DIR` which is persistent on Railway. Same pattern as existing uploads — no new risk.
- **Seed data:** The existing `public/images/journey/s1_circle.png` and `s1_bg.png` will need to be copied to the upload dir manually or via a seed step. Not blocking — the fallback handles missing images gracefully.

## Sources & References

- Upload pattern: `app/api/uploads/players/route.ts`
- Serve pattern: `app/api/uploads/players/[filename]/route.ts`
- Current journey: `components/JourneyClient.tsx`, `app/dm/journey/page.tsx`
