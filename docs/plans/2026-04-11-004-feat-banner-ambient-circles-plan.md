---
title: "feat: Player banner ambient circles — celestial, wind, compass"
type: feat
status: active
date: 2026-04-11
deepened: 2026-04-12
---

# Player Banner Ambient Circles

## Overview

Add three vertical circles to the player banner (and the DM session pages) that show live, passive world state:

1. **Celestial** — sun during the day, moon (with phase) at night. Recomputes every hour.
2. **Wind** — a weather-vane needle whose direction and agitation reflect current in-fiction wind, distinguishing calm / breezy / windy / gale / storm.
3. **Compass** — a needle whose bearing reflects the **direction the party has been moving on the world map**. Recomputes every ten minutes by comparing the party's current hex to its previous recorded hex.

All three circles are ambient — never buttons, never tooltips that block the page, never modal triggers. They exist to make the banner feel alive without pulling attention.

## Problem Frame

The player banner currently rotates through a set of banner images and applies a weather particle overlay. It is visually rich but static in meaning — no player looking at it can tell what time it is in-fiction, which way the wind blows, or which way the party is heading. Shadow v2 already promises these three circles (`ROADMAP.md` Shadow v2). This plan turns that promise into an implementable, bounded feature.

The three circles are ambient world-presence cues. They pair with the existing weather overlay and the game clock. They also ride along to the DM-side session pages per the roadmap line "— also on sessions."

## Requirements Trace

- **R1.** Three vertical circles appear on the player banner (`/players/[id]`).
- **R2.** The same three circles appear on the DM session pages where the roadmap implies they belong (initiative / session control surface).
- **R3.** Celestial circle shows the sun by day and the moon by night, with moon phase visually distinguishable. Updates at least once per hour.
- **R4.** Wind needle rotates to match current in-fiction wind direction and conveys wind intensity via animation: calm feels drifty, windy feels busier, storm feels violent and distinct from "just windy."
- **R5.** Compass needle points in the direction of the party's most recent movement on the world map. Recomputes on a 10-minute cadence.
- **R6.** In-fiction weather is seeded at session start from real-world weather at Kevin's coordinates, with a small random jitter. Storm-class in-fiction weather overrides the seed ("storm dynamics").
- **R7.** Nothing about these circles is distracting — a player can ignore them entirely and still read the banner.

## Scope Boundaries

**In scope:**
- Schema additions to `raven_weather` and `world_map` only.
- A single reusable `<AmbientCircles />` component used on both player banner and session pages.
- A session-start hook that seeds `raven_weather` from real-world weather.
- A minimal DM control to set the party's current hex on the existing world map canvas.

**Non-goals:**
- No AR / device-orientation compass. The user has marked the real-world GPS compass as an AR-only concern — out of this plan.
- No per-player position. The party shares one position. Per-character tracking is deferred indefinitely.
- No historical movement trail on the world map.
- No storm animation replacing the existing particle overlay — this plan only touches the wind **circle**, not the banner particles.
- No Common World multi-tenancy handling. All new columns are campaign-singleton for now and will pick up a `campaign_id` in Common v3's backfill pass along with everything else.
- No redesign of the existing session control bar. The circles land as a new row / stripe, they don't rearrange the 5 action circles.

## Context & Research

### Relevant Code and Patterns

- **Banner surface:** `components/PlayerBanner.tsx` wraps rotating images and mounts `PlayerBannerWeather`. The new circles mount as a sibling layer inside the same banner container.
- **Existing weather overlay:** `components/PlayerBannerWeather.tsx` already renders atmospheric tint + particle sprites, reads from `/api/weather/current`, and uses `RavenWeatherRow`. The new wind circle will read the same row so the layers stay synchronized.
- **Moon phase:** `lib/lunar.ts::getMoonPhase()` is pure-function, dependency-free, already returns 8 phases + illumination + days-since-new. Reuse as-is.
- **Geographic helpers:** `lib/geo.ts::haversine`, `bearingDeg`, `compassWord` are already factored out of the disabled AR encounter. `bearingDeg` is the primitive the compass uses.
- **World map state:** `lib/schema.ts` defines `world_map` (singleton row `id = 'default'`) and `world_hexes` (sparse (q,r) rows). Neither tracks a "party position." This plan adds it.
- **Weather state:** `lib/schema.ts` defines `raven_weather` with `(hex_id, condition, temp_c, wind_label, updated_at)`. The current singleton key is `'default'`. This plan adds two nullable structured columns.
- **Session start flow:** `app/api/sessions/[id]/route.ts` (and the session control bar wiring) is where the `startSession` transition lives. The wind seeder hooks in there.
- **Almanac:** `lib/almanac.ts` hardcodes 2026–2027 events. Not used by the circles directly but the celestial circle can optionally highlight eclipse days.

### Institutional Learnings

- **`ensureSchema` is memoized** — after DDL changes, the dev server must be killed and restarted. Plan units that touch schema end with an explicit restart step.
- **Tailwind v4 arbitrary values break** — the circles must use inline `style={{ width, height }}` and inline `display: 'flex'` layout, not `w-[64px]` or `flex flex-col sm:flex-row`.
- **Client components can't transitively import `lib/db.ts`** — the `<AmbientCircles>` client component imports only its types and `lib/lunar.ts`, `lib/solar.ts` (both pure). Anything touching DB stays in API routes.
- **Never animate with per-frame JS** when CSS keyframes will do — follows `PlayerBannerWeather.tsx`'s pattern of attribute-selected keyframe classes and `animation-delay` to stagger particles.
- **Safari + Tailwind v4 + production** — layout-critical elements (fixed-position circles, flex container, sticky positioning) use inline styles, not utility classes.

### External References

- **`suncalc`** (3 kB, BSD, zero deps) gives us `getPosition(date, lat, lng)` → `{ altitude, azimuth }` in radians. Used for sun position during the day. Optional: we can write a ~40-line classical algorithm ourselves; the plan recommends importing the tiny package to save bugs.
- **Open-Meteo** (`https://api.open-meteo.com/v1/forecast`) — free, no API key, no rate limit for low volume. `current=wind_speed_10m,wind_direction_10m,temperature_2m,weather_code` returns everything we need to seed wind. Server-side fetch only.

## Key Technical Decisions

- **Compass driver: party-position-on-world-map, not GPS.** The user's explicit direction. "Every 10 minutes, compare current party hex to last recorded hex; bearing from old→new is the compass heading." AR/geolocation stays parked until the AR encounter returns.
- **Wind driver: hybrid.** At session start, fetch Open-Meteo for Kevin's lat/lng. If in-fiction weather is storm-class (`storm`, `thunderstorm`, `gale`), trust the stored in-fiction values and ignore the real-world reading. Otherwise, jitter the real-world reading (±15° dir, ±3 mph speed) and write it back to `raven_weather`. The banner circle simply reads `raven_weather`.
- **Celestial display: one circle, two modes.** During daylight (sun altitude > 0) it shows a sun glyph at its current position on a dome arc. At night it shows a moon glyph with the current phase's lit region drawn as an SVG clip-path.
- **Reusable component.** One `<AmbientCircles />` component mounted by both `PlayerBanner.tsx` and the session pages (`/dm` DM home, `/dm/initiative`, etc.). Data fetching is isolated into `<AmbientCirclesData />`; the visual is a pure presentational `<AmbientCircles />` that accepts shapes.
- **Schema additions, not new tables.** Two columns on `raven_weather` (`wind_dir_deg`, `wind_speed_mph`) and five columns on `world_map` (`party_q`, `party_r`, `party_prev_q`, `party_prev_r`, `party_moved_at`). All nullable, all additive.
- **Animation: CSS keyframes selected by `data-intensity` attribute.** Calm / breezy / windy / gale / storm each get their own keyframe block. The React tree only updates the attribute; all per-frame work happens in the GPU. Same pattern as `PlayerBannerWeather.tsx`.
- **Update cadences are explicit and independent.**
  - Celestial: `setInterval(updateCelestial, 3600_000)` + an initial call on mount + a refresh on window `focus`.
  - Wind: piggy-backs the existing weather polling in `PlayerBannerWeather.tsx` — same `/api/weather/current` response feeds both. No new poll.
  - Compass: `setInterval(pollPartyPosition, 600_000)` + an initial call on mount. Party position comes from a new lightweight `GET /api/party/position` route.
- **Stationary compass behavior.** If `party_q/r == party_prev_q/r` (or `prev` is null), the needle holds its last-known bearing with a gentle ±2° sway. We never show a random or "unknown" direction; we default to N when nothing has ever been recorded.
- **DM party-position control uses the existing mode system.** The world map canvas (`components/WorldMapClient.tsx`) has no right-click or context menu. Instead, it uses a toolbar mode system — `reveal`, `navigate`, `place-entity` — where the active mode determines what a hex click does. The party control adds a new `set-party` mode to the same toolbar. When active, clicking a hex writes `party_q/r` to `world_map`, demoting the previous values to `party_prev_*`. This follows the identical pattern of `place-entity` mode (lines 341–357), just writing to `world_map` instead of `world_entities`. No new pages, no bulk edit, no history.
- **Wind jitter parameters are grounded in real-world variability.** ±15° direction and ±3 mph speed. Real-world wind direction naturally varies ±20° over a 10-minute period in steady conditions (NOAA surface observation standards), and the Beaufort scale has ~5 mph bands at low speeds. The jitter produces realistic in-fiction variety without straying far from the real reading. Storm-class override bypasses jitter entirely.

## Open Questions

### Resolved During Planning

- **Compass source** → world-map party position every 10 minutes (user decision; AR/GPS deferred to the AR branch).
- **Wind source** → hybrid: real-world-seeded at session start with storm-class in-fiction override (user decision).
- **Where the circles go** → top-right column of the banner (below the weather pill on desktop, stacked above-everything on mobile). Session-page placement is the same right-edge column.
- **How often celestial updates** → every hour on an interval; sun/moon choice is driven by computed altitude, not wall-clock time.
- **Whether we should parse the existing `wind_label` text field** → no. We add structured columns alongside it and treat `wind_label` as display-only.

### Deferred to Implementation

- Exact SVG glyphs / stroke weights for sun, moon-phase wedge, wind arrow, compass needle — decided when implementing the presentational component against the site's warm-palette aesthetic.
- Whether the compass needle animation to a new bearing uses `ease-out-cubic` or a spring curve — eyeballed in place.
- Exact Open-Meteo query parameters — will be checked against the provider's current docs during implementation rather than baked into the plan.
- Whether the hourly celestial tick also triggers a rerender of the wind circle (to catch DST / sun-overhead edge cases) — decided once the wind circle exists and the edge case is observable.

## High-Level Technical Design

> *This illustrates the intended shape of the feature and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```
              ┌────────────────────────── PlayerBanner ──────────────────────────┐
              │                                                                   │
              │  (rotating banner image)                                          │
              │                                                                   │
              │    (existing weather overlay: atmosphere + particles)             │
              │                                                                   │
              │                                        ┌──────── AmbientCircles ┐ │
              │                                        │   ┌──────┐             │ │
              │                                        │   │ ☼ / ☾│  celestial  │ │
              │                                        │   └──────┘             │ │
              │                                        │   ┌──────┐             │ │
              │                                        │   │  ↗   │  wind       │ │
              │                                        │   └──────┘             │ │
              │                                        │   ┌──────┐             │ │
              │                                        │   │  N   │  compass    │ │
              │                                        │   └──────┘             │ │
              │                                        └────────────────────────┘ │
              └───────────────────────────────────────────────────────────────────┘
```

```
 Data flow
 ─────────

   real clock ──► lib/solar.ts + lib/lunar.ts ──┐
                                                 │
                                                 ▼
                                           AmbientCircles ◄──── hourly setInterval

   raven_weather row ──► /api/weather/current ──► AmbientCircles
        ▲
        │  (written at session start by seedSessionWeather)
        │
   Open-Meteo (real-world @ Citadel Tree)  ─────►  storm-override check
                                                       │
                                                       ▼
                                                   jitter & persist

   world_map row (party_q,r + prev_q,r) ──► /api/party/position ──► AmbientCircles
        ▲
        │  (updated from the DM world map "Party here" menu)
```

```
 Wind intensity → keyframe selector
 ───────────────────────────────────

   wind_speed_mph | condition        | data-intensity | keyframe amplitude
   ---------------+------------------+----------------+-------------------
   0–5            | calm / clear     | calm           | ±2°,  4s sine
   5–15           | windy (default)  | breezy         | ±5°,  2s sine
   15–30          | windy            | windy          | ±10°, 1s sine
   30+            | gale             | gale           | ±12°, 0.6s sine + 3–6s gust spikes
   ANY            | storm / thunder  | storm          | ±15°, 0.5s sine + 1–3s gust spikes + shear flicks
```

## Implementation Units

- [ ] **Unit 1: Schema additions**

**Goal:** Extend `raven_weather` and `world_map` with the structured columns the circles need. Purely additive; nothing existing breaks.

**Requirements:** R4, R5, R6

**Dependencies:** none

**Files:**
- Modify: `lib/schema.ts`
- Test: manual verification via `/api/weather/current` + a quick `SELECT` against the dev DB (no unit tests for DDL by convention in this repo)

**Approach:**
- Add `ALTER TABLE raven_weather ADD COLUMN IF NOT EXISTS wind_dir_deg INTEGER` and `ADD COLUMN IF NOT EXISTS wind_speed_mph INTEGER`. Both nullable; existing `wind_label` stays.
- Add `ALTER TABLE world_map ADD COLUMN IF NOT EXISTS party_q INTEGER`, `party_r INTEGER`, `party_prev_q INTEGER`, `party_prev_r INTEGER`, `party_moved_at BIGINT`. All nullable.
- Restart the dev server after the DDL lands (memoized `ensureSchema`).

**Patterns to follow:**
- Additive `ADD COLUMN IF NOT EXISTS` inside `ensureSchema`, each in its own `await pool.query(...).catch(() => {})`. See the SMS opt-in columns right after `raven_weather` in `lib/schema.ts` for exact shape.

**Test scenarios:**
- A fresh dev boot creates the columns; reboot against a real prod-shape DB picks them up.
- Existing `/api/weather/current` still returns the default row with `wind_dir_deg = null, wind_speed_mph = null`.
- `SELECT party_q FROM world_map WHERE id='default'` returns `NULL` initially.

**Verification:**
- `psql` against dev DB reports the new columns.
- `npm run build` is clean.

---

- [ ] **Unit 2: Presentational `<AmbientCircles>` component with solar helper and wind keyframes**

**Goal:** Create `lib/solar.ts`, extend `RavenWeatherRow` types, build the stateless presentational component with all three circles, and define the five wind-intensity keyframe blocks. This is one deliverable — the solar helper, types, SVG rendering, and animation are tightly coupled and not independently useful.

**Requirements:** R1, R3, R4, R5, R7

**Dependencies:** Unit 1 (for the type additions to line up with DB reality)

**Files:**
- Create: `lib/solar.ts`
- Create: `components/AmbientCircles.tsx`
- Modify: `lib/types.ts` (extend `RavenWeatherRow` with `wind_dir_deg?: number | null; wind_speed_mph?: number | null`)
- Modify: `app/api/weather/current/route.ts` — update the SELECT to include `wind_dir_deg` and `wind_speed_mph` so the new columns are actually returned in the JSON response
- Test: visual spot check on `/players/ashton` after Unit 3 lands

**Approach — solar helper:**
- Implement `getSolarPosition(date, lat, lng): { altitudeDeg, azimuthDeg, isDay }` using a published closed-form algorithm. Preferred: import the `suncalc` package (3 kB, BSD, zero deps) and wrap it so the rest of the codebase has a thin local API.
- `isDay` is simply `altitudeDeg > 0`.
- Use the Citadel Tree coordinates (`SHADOW_ANCHOR_LAT = 36.34289; SHADOW_ANCHOR_LNG = -88.85022`).

**Approach — presentational component:**
- Props: `{ celestial: { kind: 'sun' | 'moon'; altitudeDeg?: number; azimuthDeg?: number; moonPhase?: MoonPhase; illumination?: number }; wind: { dirDeg: number; intensity: 'calm'|'breezy'|'windy'|'gale'|'storm' }; compass: { bearingDeg: number; stationary: boolean } }`.
- Three stacked circles. **Sizing accounts for mobile banner overflow** (see note below): 36 px diameter on mobile, 52 px on desktop. Inline `style={{ display: 'flex', flexDirection: 'column', gap: 6 }}` on mobile, `gap: 10` on desktop.
- Celestial: SVG sun glyph positioned on an arc when `kind === 'sun'`, SVG moon disc with an overlapping shadow ellipse when `kind === 'moon'`. Use `illumination` to size the lit wedge.
- Wind: SVG arrow inside the circle, rotated by `dirDeg`. Animation via CSS keyframes (see below).
- Compass: SVG needle rotated by `bearingDeg`, with a tiny `wx-shimmer`-style gentle sway when `stationary === true`.
- Every circle is `pointer-events: none`, `aria-hidden`.

**Approach — mobile overflow fix:**
- The player banner is `h-48` (192 px) on mobile with `overflow-hidden`. Three circles at 52 px each + 10 px gaps = 176 px; positioned at `top: 72` they'd extend to 248 px and get clipped. Fix: shrink to 36 px circles + 6 px gaps on mobile = 120 px total. At `top: 56` that's 176 px — fits within 192 px. Desktop (`sm:h-72` = 288 px) uses the full 52 px + 10 px gap sizing with no overflow concern.

**Approach — wind keyframes:**
- Helper `resolveWindIntensity(condition, wind_speed_mph) -> intensity`:
  - If `condition` is `storm` or `thunderstorm` → `storm`.
  - Else if `condition` is `gale` → `gale`.
  - Else bucket `wind_speed_mph` (null → 'calm').
- Five keyframe blocks: `wx-wind-calm` (±2°, 4 s), `wx-wind-breezy` (±5°, 2 s), `wx-wind-windy` (±10°, 1 s), `wx-wind-gale` (±12°, 0.6 s + gust spikes), `wx-wind-storm` (±15°, 0.5 s + violent gusts + shear flicks).
- For gale/storm, layering base sway + gust spikes uses **comma-separated values in a single `animation` property** on the same element (not a wrapper div). Example: `animation: wx-wind-storm 0.5s linear infinite, wx-gust-violent 2s ease-in-out infinite`.
- Baseline rotation = `dirDeg`; the keyframe sways around that base using a parent-rotate + child-animate trick (parent sets `rotate(dirDeg)`, child does the swaying keyframe so the two compose cleanly).

**Patterns to follow:**
- `lib/lunar.ts` — pure math, exported named functions.
- `components/PlayerBannerWeather.tsx` — inline `KEYFRAMES` constant at top of file, inline style blocks, `pointer-events: none`, `aria-hidden`.

**Test scenarios:**
- `getSolarPosition(new Date('2026-06-21T17:00:00Z'), 36.34289, -88.85022)` returns `altitudeDeg > 60`.
- `getSolarPosition(new Date('2026-12-21T06:00:00Z'), ...)` returns `isDay === false`.
- Mount with `{ celestial: { kind: 'sun', altitudeDeg: 45 } }` — sun sits mid-arc.
- Mount with `{ wind: { dirDeg: 90, intensity: 'storm' } }` — arrow is east, animation is violent.
- Mount with `{ compass: { bearingDeg: 0, stationary: true } }` — needle points N and sways gently.
- `condition: 'storm', wind_speed_mph: 0` → intensity resolves to `storm` (storm override works).
- Three circles fit within the 192 px mobile banner without clipping.

**Verification:**
- `tsc --noEmit` clean.
- No console errors on first mount.
- Visual sanity on `/players/ashton` at both mobile and desktop widths.
- `/api/weather/current` JSON response includes `wind_dir_deg` and `wind_speed_mph` fields.

---

- [ ] **Unit 3: `<AmbientCirclesData>` wrapper with timers**

**Goal:** The data/effects layer that owns the intervals, fetches, and prop plumbing. Keeps presentational logic out of the network layer.

**Requirements:** R1, R2, R3, R4, R5

**Dependencies:** Unit 2

**Files:**
- Create: `components/AmbientCirclesData.tsx`
- Create: `app/api/party/position/route.ts` (GET — returns the `world_map` singleton's party fields)
- Test: manual — visible ticking over the course of an hour for celestial; force-trigger with `setInterval` shortening during dev

**Approach:**
- `'use client'`. Internal state: `celestial`, `wind`, `compass`.
- On mount:
  - Call `getSolarPosition` + `getMoonPhase` and derive the celestial shape. Kick off a `setInterval(..., 3600_000)` tick. Also add a `window.focus` listener that re-runs the celestial compute.
  - Fetch `/api/weather/current?playerId=...` (same endpoint `PlayerBannerWeather` uses — no new endpoint needed for wind) and derive `{ dirDeg, intensity }`. Re-fetch when the parent re-mounts; no polling interval (weather changes are DM-driven and infrequent).
  - Fetch `/api/party/position` and derive `{ bearingDeg, stationary }`. Kick off a `setInterval(..., 600_000)` poll. Cleanup on unmount.
- Passes props into `<AmbientCircles />` verbatim.
- Gracefully degrades: any failed fetch produces a sensible default (`clear` / N / stationary) so the circles still render.

**Nil-path for party position:** Before the DM ever clicks "Party here," all four party columns are NULL. The GET handler returns `{ party_q: null, party_r: null, party_prev_q: null, party_prev_r: null }`. The client handles this: when any coordinate is null, it renders `{ bearingDeg: 0, stationary: true }` (compass points N with gentle sway). The `bearingDeg` computation from `lib/geo.ts` is never called with null inputs — the null check happens in the data wrapper, not at the math layer. This means Unit 3 is independently verifiable without Unit 6 (party POST) — the compass simply shows its default N state.

**Patterns to follow:**
- `components/PlayerBannerWeather.tsx` — fetch-once, `useMemo`-derive display state, fail silent.
- `components/PlayerBanner.tsx` — `let alive = true` + cleanup idiom.

**Test scenarios:**
- Mount, wait for `/api/weather/current` and `/api/party/position` — circles populate without flicker.
- Deny both fetches — circles show the graceful fallback (sun/moon from pure math, wind calm, compass N).
- `/api/party/position` returns all nulls (no party position set yet) — compass shows N with gentle sway, no console errors.
- Stub `setInterval` to 1 s in dev and verify celestial re-computes without remounting the component.
- Switch the `world_map.party_q/r` via a direct SQL update and watch the compass swing on the next poll tick.

**Verification:**
- `tsc --noEmit` clean.
- No React warnings about `useEffect` missing deps.
- DevTools shows exactly one interval per timer, not a leak-on-rerender.

---

- [ ] **Unit 4: Mount on player banner and session pages**

**Goal:** Wire `<AmbientCirclesData>` into the surfaces the roadmap calls for.

**Requirements:** R1, R2

**Dependencies:** Unit 3

**Files:**
- Modify: `components/PlayerBanner.tsx` (mount `<AmbientCirclesData playerId={playerId} />` inside the banner container, positioned at the right edge below the weather pill)
- Modify: the session page surface per ROADMAP. The exact mount point is the DM home `/dm` sessions header and the `/dm/initiative` banner header — these already share a layout region where the 3 circles fit above the session boxes without colliding with the 5 action circles. If on review these two pages share a header component, the mount goes there once. If not, it mounts on both.

**Approach:**
- Banner mount uses absolute positioning in the same container the weather pill already lives in. Desktop: `position: absolute; top: 72; right: 16`, circles at 52 px + 10 px gap. Mobile: `top: 48; right: 10`, circles at 36 px + 6 px gap (total height 120 px, fits within the 192 px `h-48` banner with `overflow-hidden`).
- Session mount passes a `size` prop to the presentational component (slightly smaller on DM pages to leave room for the session controls). The `size` prop lives on the presentational `<AmbientCircles>`, not the data wrapper — the data wrapper just passes it through.

**Patterns to follow:**
- `PlayerBannerWeather.tsx` — the weather pill's `position: absolute; top: 14; right: 16` is the exact placement convention.
- The DM session pages already use inline-style positioning for their circles (`Session Control Bar` in `DESIGN.md`).

**Test scenarios:**
- `/players/ashton` on desktop and mobile — circles appear top-right of banner and don't overlap the weather pill.
- `/dm` and `/dm/initiative` on desktop — circles appear in the session header region without pushing the 5 action circles out of alignment.
- Rotate the banner image — the circles stay put (absolutely positioned, not flex-children).

**Verification:**
- `npm run build` clean.
- Visual pass on all four surfaces.
- Safari production build renders the circles (Tailwind v4 + Safari gotcha — confirm inline styles won.)

---

- [ ] **Unit 5: Session-start wind seeder**

**Goal:** At session START, seed `raven_weather` with real-world wind (jittered), unless in-fiction is storm-class.

**Requirements:** R4, R6

**Dependencies:** Unit 1 (columns exist)

**Files:**
- Create: `lib/weather-seed.ts` — server-only helper exposing `seedSessionWeather(): Promise<void>`
- Modify: `app/api/sessions/[id]/route.ts` — the POST handler's `action === 'start'` branch (lines 91–99). The seeder call goes after `resumeClock()` on line 99, using the same `.catch(() => {})` silent-degrade pattern already established there

**Approach:**
- `seedSessionWeather()`:
  1. Read the current `raven_weather` default row.
  2. If `condition` is in `{'storm','thunderstorm','gale'}` → return early. Storm dynamics override.
  3. Fetch `https://api.open-meteo.com/v1/forecast?latitude=36.34289&longitude=-88.85022&current=wind_speed_10m,wind_direction_10m,temperature_2m,weather_code` with an `AbortController` timeout of 5 s.
  4. On success: jitter wind direction by `±15°` and wind speed by `±3 mph`, clamp to `[0, 120]` mph and `[0, 360)` degrees.
  5. `UPDATE raven_weather SET wind_dir_deg = $1, wind_speed_mph = $2, temp_c = COALESCE(temp_c, $3), updated_at = now() WHERE hex_id = 'default'`.
  6. On failure: no-op (silent degrade — follows `lib/email.ts` precedent).
- The seeder is idempotent; if the DM rapidly starts / ends / starts a session, each call re-jitters. That's fine — wind in-fiction visibly changes a little each time, which is a feature.

**Patterns to follow:**
- `lib/email.ts` — silent-degrade helper that never throws.
- `lib/game-clock.ts` — server-only, no client import, single-purpose mutator.
- `AGENTS.md` / `CLAUDE.md` rule: **always** use `AbortController` with external fetches, **never** log full response bodies.

**Test scenarios:**
- With `raven_weather.condition = 'storm'` → the seeder returns without calling Open-Meteo (assertable by stubbing `fetch` and counting calls).
- With `raven_weather.condition = 'clear'` → the seeder calls Open-Meteo, writes jittered values, and the written values are within ±15° / ±3 mph of the reported values.
- With Open-Meteo timing out → the seeder swallows the error and the DB row is unchanged.
- With Open-Meteo returning an unexpected shape → seeder validates and bails without writing.

**Verification:**
- Start a session with `condition = 'clear'`, observe new `wind_dir_deg` / `wind_speed_mph` values in `raven_weather`.
- Start a session with `condition = 'storm'`, observe unchanged values.
- Railway logs do not contain any full fetch response body.

---

- [ ] **Unit 6: DM world-map "Party here" mode**

**Goal:** Minimal DM surface for setting the party's current hex, so the compass has something to compute.

**Requirements:** R5

**Dependencies:** Unit 1 (columns exist), Unit 3 (`/api/party/position` GET route)

**Files:**
- Modify: `components/WorldMapClient.tsx` — add `'set-party'` to the `Mode` type union (line 36) and to the `ModeToggle` options array (line 532). Add a `set-party` branch in the click handler (lines 300–360) following the `place-entity` pattern (lines 341–357). The existing toolbar has four modes (`reveal`, `pan`, `navigate`, `place-entity`), so `set-party` becomes the fifth.
- Create: `lib/party.ts` — server-only helper exposing `setPartyPosition(q: number, r: number): Promise<void>`
- Modify: `app/api/party/position/route.ts` — already created in Unit 5 as a GET; this unit adds the POST handler

**Approach:**
- Add a `set-party` mode button to the world map toolbar. When active, clicking a hex fires `POST /api/party/position` with `{ q, r }`. The handler (via `lib/party.ts`) reads current `party_q/r`, writes them into `party_prev_q/r`, then sets the new `party_q/r` and `party_moved_at = now()`. Single transaction.
- If prev is null (first ever placement), set both current and prev to the same `(q,r)` so the first compass reading is "stationary, pointing last-known direction (default N)".
- The world map canvas uses HTML5 Canvas with a mode system (`components/WorldMapClient.tsx`). The existing `place-entity` mode (lines 341–357) is the exact pattern to follow: it reads the hex under cursor, POSTs to an API, and updates local state. The new mode does the same thing, just writing to `world_map` instead of `world_entities`.
- Visual feedback: when `set-party` mode is active, the hovered hex gets a distinct stroke color (gold `#c9a84c` instead of the default hover yellow `#e6c66a`) so the DM can tell the mode is active. The current party hex gets a small filled circle marker on the canvas during render (similar to how `place-entity` shows entity icons).
- No drag. No arrows. No "where is the party right now" breadcrumb beyond the circle marker — the compass circle itself is the primary feedback channel.

**Patterns to follow:**
- `place-entity` mode in `components/WorldMapClient.tsx` (lines 341–357) — identical mode-branch pattern.
- `lib/game-clock.ts` mutator pattern: all writes go through one helper function, `setPartyPosition(q, r)` in `lib/party.ts` (new).
- `/api/party/position` GET handler (Unit 5) — same route, add POST.

**Test scenarios:**
- DM selects `set-party` mode, clicks hex (0,0). `world_map.party_q/r` becomes (0,0), `party_prev_*` becomes (0,0). Compass shows N with gentle sway (stationary).
- DM clicks hex (2,1) next. `party_prev_*` becomes (0,0), `party_q/r` becomes (2,1). Compass swings to ~NE on next poll tick.
- DM clicks outside a hex — no-op (canvas click handler already guards with `hitTestHex`).
- DM clicks the same hex twice — no-op (prev and current already match, no write needed).
- DM switches to `navigate` mode — clicking hexes reverts to normal navigation behavior, no party-position side effects.

**Verification:**
- `npm run build` clean.
- Dev smoke test: move party across 3 hexes and watch the compass rotate accordingly in a `/players/ashton` tab open in a second window.

## System-Wide Impact

- **Interaction graph:** Only two new callers touch `raven_weather`: the existing weather overlay (read) and the new session-start seeder (write). Only two new callers touch `world_map`: the new party-position GET and the new party-position POST. Existing handlers are untouched.
- **Error propagation:** Open-Meteo failure is absorbed by the seeder (silent degrade). `/api/party/position` failure leaves the compass showing its last-known bearing. Celestial failure is impossible (pure math).
- **State lifecycle risks:** The `party_prev_*` columns carry a small risk: if a write lands between the GET and the client's render, the client can briefly show a stale bearing. Acceptable — the next 10-minute poll resolves it.
- **API surface parity:** `/api/weather/current` gains two fields in the JSON payload. Existing clients (`PlayerBannerWeather.tsx`) ignore them. Safe.
- **Integration coverage:** The wind-circle storm-override is the trickiest behavior. A short server-side unit on `seedSessionWeather` and a component spot-check on `resolveWindIntensity` together cover the three main branches (storm override / bucketed speed / null fallback).

## Risks & Dependencies

- **No party-position tracking exists today.** This plan creates the first ever "party is at hex X" state. Downstream features (World AI location-aware proposals, Overheard geofencing) may later want to read from this same surface — worth flagging in the Common World plan pool. Not a blocker; the columns are additive.
- **Open-Meteo change.** Free tier, no SLA. The silent-degrade design means a Meteo outage never blocks a session start; the circle just keeps showing the previous wind.
- **Session-start hook location confirmed.** The START circle flows through `app/api/sessions/[id]/route.ts` POST handler, `action === 'start'` branch (lines 91–99). `resumeClock()` is called on line 99 with `.catch(() => {})`. The seeder hooks in right after, same pattern.
- **World map toolbar getting crowded.** Adding `set-party` is the fifth mode button (`reveal`, `pan`, `navigate`, `place-entity`, `set-party`). If more modes land (e.g., fog-of-war, measure distance), the toolbar needs a redesign. Five buttons is the practical limit before the toolbar needs grouping or a different interaction pattern.
- **Celestial accuracy.** `suncalc` is accurate to a few arc-minutes; the circle's visual resolution is coarser than that. Not a risk.
- **Moon-phase edge cases.** `lib/lunar.ts` is ±1 day accurate. Good enough for in-fiction display.
- **Battery on mobile.** Three concurrent `setInterval`s on the player banner is cheap (one hour, ten minutes, and no polling for wind). No wake locks.

## Documentation / Operational Notes

- **DESIGN.md** gets a new "Banner Ambient Circles" section under Layout / Player Banner, documenting the three-circle column, sizes, and the storm-override rule. One short paragraph.
- **ROADMAP.md** Shadow v2 line "3 vertical circles on player banner (compass, sun/moon phase, wind dir) — also on sessions" flips to `[x]` when all 6 units land.
- **No new env vars.** Open-Meteo is keyless.
- **No new Railway service.** Everything runs on the existing Next server.
- **Complexity answer (to Kevin's "how hard would this be?"):** the compass itself is a small component (Unit 2's SVG rendering) that reads a well-defined shape. The hard part is the **absence** of party-position data — Unit 1 and Unit 6 add that data model for the first time in the project, and Unit 6 puts a DM surface on top. Ballpark: Units 1–4 are a focused day of work; Units 5 and 6 add another half-day each. Total: 2 focused days across 6 units.

## Sources & References

- `components/PlayerBanner.tsx` — host component
- `components/PlayerBannerWeather.tsx` — keyframe pattern, fetch-once idiom, pill placement
- `lib/lunar.ts` — existing moon phase helper
- `lib/geo.ts` — `bearingDeg`, `compassWord`
- `lib/schema.ts` — `raven_weather`, `world_map`, `world_hexes` DDL sites
- `lib/game-clock.ts` — server-only mutator precedent
- `lib/email.ts` — silent-degrade external service precedent
- `DESIGN.md` — Player Banner section, Session Control Bar section, Weather layer bullet
- `ROADMAP.md` — Shadow v2 line 37 ("3 vertical circles on player banner")
- External: `suncalc` npm package (BSD), Open-Meteo free API
