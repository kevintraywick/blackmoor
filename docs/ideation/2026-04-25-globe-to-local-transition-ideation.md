---
date: 2026-04-25
topic: globe-to-local-transition
focus: smoothing the user's transition from the 3D globe (H3 res-4 hex, ~45 km) into local map placement (5 ft / 1 in. snap grid). Concern: the change in scale/paradigm is jolting.
---

# Ideation: Globe → Local Map Transition

## Codebase Context

**Project shape.** Next.js 16 + React + TypeScript + Three.js (R3F + drei) + h3-js + Postgres. Globe view at `/dm/globe-3d` uses orbit camera (1.25–5.0 unit distance; 1 unit = 6371 km), H3 grids at res 0–4. Map editor at `/dm/map-builder` is DOM/SVG at canonical `PX_PER_FT = 12` (60 px = 5 ft).

**The jolt — three discontinuities today:**
1. **3D → 2D with no motion bridge.** Drop on hex → `router.push('/dm/map-builder?build=...&placement=1')` → black-78% modal scrim opens. Hard cut.
2. **Scale jumps from H3 km → arbitrary 30×30 → editor ft/mi.** `MapPlacementOverlay` uses a 720×720 viewport with 30×30 squares at 24 px/cell. The 30×30 maps to **neither** km nor ft. A 5-ft combat map and a 6-mi overland map render at "60% of 720" — visually identical despite being 50,000× apart in real size.
3. **Hex → square → square-or-hex.** The hex's geometry is lost in the placement step.

**Existing precedents to leverage (don't reinvent):**
- `CameraController.flyToAnchor` (R3F, 1.2 s ease-out cubic) wired in `Globe3DClient.tsx`.
- LOD crossfade pattern: planetary→territory wolf token fades 1.75 → 1.25 camera distance.
- `PX_PER_FT = 12` site-wide canonical scale (`lib/map-scale.ts`); helpers `cellScreenPx(ft)`, `imageDisplaySize(...)`.
- `h3AnchorFitCheck()` already computes whether a map's km extent fits its H3 anchor cell — currently unused in placement UI.
- Camera `y = 0` keeps world +Y vertical (any tilted fly-to needs this; CLAUDE.md gotcha).
- Auto-scale GLBs by `THREE.Box3().setFromObject()` rather than magic numbers.
- **Never prep res-4 globally** (40 MB RSC payload, 70 s SSR); use sparse `prepareCells(ids, ...)`.

**Past learnings:** No `docs/solutions/` directory yet. Closest analogues: CLAUDE.md gotchas (camera math, GLB opacity, turbopack staleness, H3 payload), DESIGN.md "Globe" + "Canonical Map Scale" sections, `docs/plans/2026-04-07-001-feat-map-workflow-world-and-local-plan.md` (world↔local hierarchy mental model). No prior write-up on inter-view jolt or motion sickness — net-new territory; worth writing back as a solution after shipping.

**Design constraint added during this ideation (2026-04-25):**
- Lead with fresh, vivid, upbeat ideas. Do **not** default to parchment / aged-paper / ink-settle imagery as the first move. Saved as `feedback_no_parchment_default.md`. The journey page (saturated soft blues + white circles + light text) is precedent for this register inside the codebase.

## Ranked Ideas

Sequence reflects user's chosen build order. **Original order:** #1 → #2 → #3 → #4. **Updated 2026-04-25:** mini-globe HUD (#1) skipped for now; sequence is now **#2 → #3 → #4**. The two large alternatives (#5 continuous dive, #6 ritual transition) remain deferred.

### 1. Mini-globe in the corner of every local view
**Description:** A ~80–120 px live three.js globe sits in the top-right of the editor, the placement view, the session map, the player banner, and any future local surface. Camera locked on the parent hex; pulsing dot for "you are here." Click to fly back to the full globe. Reuses the existing globe scene at low LOD — same NASA Blue Marble texture, same H3 cells, same gold "mapped" markers.
**Rationale:** Removes the "I'm lost in a modal, where am I in the world?" feeling everywhere. Becomes the site's universal *where* badge — pays back across editor, session viewer, player sheet, Raven Post broadsheet ("news from this region"), journey page. Doesn't depend on any other survivor; ships independently.
**Downsides:** Three.js mounting overhead per surface — needs LOD tuning to stay cheap. Risk of visual clutter if not restrained. Reusing the live scene vs. re-rendering it is an architectural choice.
**Confidence:** 80%
**Complexity:** Medium
**Status:** Skipped 2026-04-25 — DM chose to defer; revisit after #2–#4 land.

### 2. Persistent canonical scale bar
**Description:** A single `<ScaleBar>` component bound to `PX_PER_FT` (and a km mode for overland). Multi-unit so distance is *tactile*, not abstract: `60 px = 5 ft = 1.5 m = one pace` (combat) or `60 px = 1 mi = 1.6 km = an hour's walk` (overland). Rides the bottom-left of the globe (showing km at current zoom), persists into the editor (showing ft). The numeric labels live-update as the camera moves so the user *sees* 45 km collapse to 30 ft.
**Rationale:** Lowest-cost, highest-leverage primitive. Pays back in editor + session viewer + map-builder grid panel + future mini-map + the dive transition (#5) if we ever build it. The "5-ft and 6-mi maps look identical in the middle stage" problem stops mattering because scale is never invisible.
**Downsides:** Alone, doesn't *fix* any one discontinuity — just makes scale legible everywhere. Strongest as a building block.
**Confidence:** 90%
**Complexity:** Low
**Status:** Selected 2026-04-25 — brainstorm next.

### 3. Hex-shaped placement canvas at true km extent
**Description:** Replace the 720×720 / 30×30 placement workspace with the actual H3 hex polygon (true projected proportions, ~45 km vertex-to-vertex for res-4) at canonical scale. The DM drags/scales the image inside the hex outline. `h3AnchorFitCheck` drives a live "fits hex (0.4×) / fills hex (1.0×) / spills 3 hexes (2.7×)" badge in the corner. The 30×30 grid is gone; the only grid is the canonical 5-ft (combat) or 6-mi (overland) one.
**Rationale:** Eliminates discontinuity #2 (the meaningless middle-stage scale) and #3 (hex → square → hex) in one step. Standalone — doesn't require the dive. With #2 already shipped, the scale bar inside the placement view shows real units throughout.
**Downsides:** Still a modal/overlay, still a route boundary. Hex SVG mask + true-projected polygon is non-trivial geometry. Image-cropping outside the hex needs a clear visual language (overflow → highlight neighbor cells? warn? auto-fit?).
**Confidence:** 90%
**Complexity:** Medium
**Status:** Unexplored.

### 4. Drop-and-walk-away — drop commits + textures the hex; editor is a deliberate second click
**Description:** Drop = commit. The hex on the globe immediately renders the dropped image (or a thumbnail derived from it) inside its hexagonal silhouette. **No overlay opens.** A short reveal animation — bright color burst from the drop point, white sparkles, a soft chime — confirms the commit and turns the hex "mapped." To edit, the DM clicks the now-textured hex; that's when the placement view (#3) opens, with the world hex visible as the frame.
**Rationale:** Removes the forced modal at the worst moment (drop). Most drops are claim-staking — "this hex now has a map" — and the DM authors later, often in a different work session. Separates cheap commit from expensive author. "Never a blank canvas" extends to "never a setup screen between drop and edit."
**Downsides:** Doesn't help the editor's scale jolt when the DM does click in (depends on #2/#3 to land first). Requires deciding what the auto-thumbnail looks like — the dropped image cropped to the hex, a biome glyph, or both?
**Confidence:** 85%
**Complexity:** Low–Medium
**Status:** Unexplored.

---

### 5. Continuous camera dive — "Descend into the hex" *(deferred)*
**Description:** Replace `router.push → modal scrim` with a continuous R3F camera tween. On drop, `flyToAnchor` continues past `minDistance = 1.25` along the hex's surface normal; the H3 grid fades out, the hex outline morphs into the editor frame, the editor's grid fades in. Same WebGL canvas — no modal, no route change. Reopening a mapped hex plays the same descent.
**Rationale:** Kills all three discontinuities in one gesture. Highest impact, also highest cost.
**Downsides:** Loading the editor inside the WebGL canvas is a substantial refactor (current editor is DOM/SVG, not R3F). Risk of perf cliffs at the morph boundary. Months of work, not days.
**Confidence:** 75%
**Complexity:** High
**Status:** Deferred — revisit after #1–#4 have shipped and the leverage from #2 (scale bar) and #6 (mini-globe) is in place.

### 6. Ritual transition — "Bloom" *(deferred alternative to #5)*
**Description:** Instead of pretending scales are continuous, mark the transition ritually. A bright color burst expands radially from the dropped hex's screen position — saturated soft blues and whites, like a paint pellet hitting water. A chime sounds. The globe wipes out as the new view wipes in over ~700 ms. The ritual itself communicates "you are now in a different kind of place."
**Rationale:** Cheaper than the dive. Honest about the scale break. Aligned with the site's brighter register (journey page already uses saturated blues + white). The user said "jolting" — a ritual transition can make the change *feel intentional* instead of accidental, even if technically it's still a cut.
**Downsides:** Doesn't actually shrink the scale jump — only ritualizes it. The 5-ft-vs-6-mi visual identity problem remains unless paired with #2/#3. Competes with #5; pick one.
**Confidence:** 70%
**Complexity:** Medium
**Status:** Deferred — alternative to #5; decide which fits when the time comes.

## Rejection Summary

| # | Idea | Reason Rejected |
|---|------|-----------------|
| 1 | Drop velocity picks scale (slow=combat, flick=overland) | Unreliable input across mouse/trackpad/touch; invisible UI for the DM to learn |
| 2 | Globe-derived compass rosette | Belongs to Mappy / N-detection work, not transition concern |
| 3 | Sealed scroll handoff (animated GLB scroll fly between globe and editor) | High implementation cost; decorates the transition without reducing the actual scale jolt; also leans on stale-paper imagery |
| 4 | Iris-wipe transition | Subsumed by #5 (dive) or #6 (bloom); band-aid alone |
| 5 | Reframe: "hexes hold textures, not maps" (pure rename) | Conceptual reframe; subsumed by #4 drop-and-walk-away |
| 6 | Game-clock-aware drop ceremony (live weather/storm streaks during transition) | Enormous cost (real-time GFS through R3F shaders) for low jolt-reduction; pure decoration |
| 7 | Biome-aware substrate of the placement canvas | Once #3 ships, there is no "blank middle stage" left to substrate; revisit later |
| 8 | Live anchor-fit badge (standalone) | Sub-feature of #3 — fit visible by construction once the canvas is hex-shaped |
| 9 | Auto-measure scale from H3 anchor (standalone) | Sub-feature of #3 |
| 10 | Reopening a placed map flies through the hex first (standalone) | Subsumed by #5 (same mechanism, both directions) |
| 11 | Camera-stack breadcrumb (Common World › Welsh Marches › …) | Premature — revisit when sub-room maps land and there's something to breadcrumb |
| 12 | Ink-bleed reveal on drop (standalone) | Decoration alone; merged into #4 as commit feedback (recoded as bright color burst, not ink) |

## Session Log
- 2026-04-25: Initial ideation — 32 raw candidates across 4 frames, 12 rejected, 6 survivors. User selected build sequence #1 → #2 → #3 → #4; #5 and #6 deferred. Brainstorm queued for #1 (mini-globe HUD).
- 2026-04-25: Design constraint added during ideation — never default to parchment/aged-paper imagery; saved as `feedback_no_parchment_default.md`. Survivor descriptions (#4 reveal animation, #6 bloom) recoded to fresh/vivid imagery. CLAUDE.md Brand Personality / Aesthetic Direction / Design Principles rewritten to lead vivid-first; DESIGN.md Color section reframed (shipped palette stays; new surfaces follow Journey Map register).
- 2026-04-25: User skipped #1 (mini-globe HUD); next brainstorm target is **#2 Persistent canonical scale bar**. New build sequence: #2 → #3 → #4.
