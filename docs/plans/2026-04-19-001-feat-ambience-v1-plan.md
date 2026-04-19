---
title: Ambience v1 — biome substrate, prose weather, party-hex live forecast
type: feat
status: active
date: 2026-04-19
origin: docs/brainstorms/2026-04-19-ambience-v1-requirements.md
---

# Ambience v1 — biome substrate, prose weather, party-hex live forecast

## Overview

Ambience v1 turns the Common World's weather layer from a single-row `'default'` placeholder into a real substrate: every H3 hex carries climate metadata (Köppen zone + elevation + coastal flag), the party hex pulls a 7-day NOAA GFS forecast at session start and plays it forward along the game clock, and three render surfaces (player banner, DM Session Control Bar chip, Raven Post broadsheet column) show weather as short DM-voice prose — never numbers. Name-laundering at the ingest boundary prevents real-world place/storm references from reaching the DB.

The framing is deliberately "Ambience" not "Weather": the substrate and prose pattern compound into day/night, seasons, magic-zone rendering (v14 MP), and NPC schedules (v12).

## Problem Frame

Shadow and every future Common World campaign needs a weather layer that feels alive without feeling fake. The existing `raven_weather` row + `lib/weather-seed.ts` pulled a single Open-Meteo data point for the world anchor on session start — enough to drive the banner's atmosphere particles, but not enough to carry storms across a session, not keyed to real H3 cells, and with no believability guardrails. The ideation produced a believability-first design (see origin doc): biome-locked samples, prose presentation, live data scoped tightly to where players actually are, and static statistical fill everywhere else.

## Requirements Trace

From `docs/brainstorms/2026-04-19-ambience-v1-requirements.md`:

- **R1.** Biome-keyed hex substrate (Köppen + elevation + coastal + cw_latitude), immutable at seed.
- **R2.** Stats-only weather for non-party hexes, keyed on Köppen zone + season, deterministic per `(hex, game_time_hour)`.
- **R3.** Live NOAA GFS 7-day forecast for the party hex, pulled once at session start, played forward along the game clock. Session-locked on party relocation. Real-now Earth time with no season translation.
- **R4.** Prose-as-presentation: no numbers to players. Biome-filtered, sensory, DM-voice.
- **R5.** Three surfaces — player sheet banner, SCB DM chip, broadsheet forecast column. RP front-page blurb + Journey overlay explicitly deferred.
- **R6.** Name/place-reference laundering at ingest (strip NOAA station IDs, county/city strings, storm names) before persist.

Success criteria SC1-SC5 in the origin doc.

## Scope Boundaries

Deferred to roadmap follow-ups (all slotted per the brainstorm):
- NPC schedule consequences → v12 #106
- Rare anomaly layer (SWPC aurora/solar flare events beyond the existing `lib/almanac.ts`) → v15 phase 2
- Continent-coherent storm translation for non-party hexes → v15 #115
- Front-page weather blurb, Journey map overlay, player-visible raw data
- Per-campaign calendars / season offsets (no pocket mode → not needed)
- Per-player weather inside the same party (v19 crossover)

## Context & Research

### Relevant Code and Patterns

**External API helper shape (`lib/retry.ts`, `lib/spend.ts`, `lib/anthropic-pricing.ts`):**
- Env-var gate → `canSpend(service)` gate → `withRetry(fetch)` with `AbortSignal.timeout()` → parse → `record({ service, amount_usd, units, unit_kind, details, ref })` → silent-degrade on any failure.
- Never log full payloads, tokens, or PII (CLAUDE.md rule).

**Session start hook (`app/api/sessions/[id]/route.ts:92-101`):**
- `action: 'start'` is the single existing insertion point. Already calls `seedSessionWeather()` — we swap the callee and extend the result shape.
- `action: 'end'` calls `pauseClock()`; no re-fetch on resume (session-locked per R3).

**Game clock (`lib/game-clock.ts`):**
- `advanceGameTime(seconds)` is the only mutator of `game_time_seconds`. Transactional; ticks `world_entities` waypoints in the same commit.
- Forecast playback is read-through: `forecast_index = clamp((current_game_seconds - session_start_game_seconds) / 3600, 0, forecast_length - 1)`. No DB write on tick.

**SSE wiring (`lib/events.ts`, `lib/useSSE.ts`, `app/api/events/route.ts`):**
- `broadcast(table, id, action)` from any route → `useSSE('table', id, onEvent)` on the client. Visibility-aware reconnect, exponential backoff, ref-based callback.
- **Gap:** `/api/clock/advance/route.ts` does NOT currently call `broadcast()`. Unit 8 adds this.
- Existing consumer: `components/SplashNav.tsx` (presence only).

**H3 substrate (`lib/h3.ts`, `lib/h3-world-data.ts`, `lib/world-hex-mapping.ts`):**
- `prepareResolution(resolution, shadowRes6Cells, anchorCell)` already walks H3 at any res and rolls descendants to ancestors. Pattern reused for biome seeding.
- `cellToBigInt` / `bigIntToCell` for DB `h3_cell BIGINT` storage.

**LLM call patterns:**
- `lib/raven-draft.ts` (Haiku, JSON-in-text) — the right shape for the per-issue broadsheet forecast column.
- `lib/mappy.ts` (Sonnet, tool-use structured output) — overkill for prose; reference only.
- `lib/world-ai-draft.ts` — `anthropicCost(model, in, out, cacheRead)` pricing helper lives here; reuse.

**Client-safe split pattern (`lib/game-clock.ts` vs `lib/game-clock-format.ts`):**
- Client components can't transitively import `lib/db.ts` (Turbopack chokes on `tls`). Mirror the pattern: `lib/ambience-prose.ts` (pure, client-safe) vs `lib/ambience-weather.ts` (server, DB + API).

**Schema conventions (`lib/schema.ts`):**
- `ensureSchema` memoized; DDL wrapped in `.catch(() => {})`. Dev server restart required after DDL changes.
- H3 column loop at 681-687 is the pattern for new spatial tables.
- `raven_world_ai_proposals` is the JSONB-blob precedent for cached structured data.

**Three surface insertion points:**
- `components/PlayerBanner.tsx:82` — absolute-positioned prose line below the ambient circles (banner has no text today).
- `components/DmSessionsClient.tsx:414` — after the final divider, column 4 in the SCB's flex row.
- `components/RavenBroadsheet.tsx` — already receives `weather` prop but never renders it; grid has an empty `.` cell at `(row 3, col 3)` for the forecast slot.

### Institutional Learnings

No `docs/solutions/` in this repo. Live precedents in `lib/` replace it:
- `lib/weather-seed.ts` — session-start Open-Meteo pull. Replace.
- `lib/almanac.ts` — hardcoded 2026–2027 celestial events, pure-math, no API. Keep as-is; complements ambience without overlapping.
- `lib/lunar.ts`, `lib/solar.ts` — client-safe astronomical math; available for banner prose if we want moon-phase callouts.

### External References

Skipped — codebase has strong local precedents for every touched layer. NOAA NOMADS URL patterns can be validated during implementation.

## Key Technical Decisions

- **Name laundering at ingest, not at render** (R6). If a real storm name or station ID hits the DB, some surface will leak it eventually. Filter happens inside the NOAA helper before any persist. Single boundary, single filter.
- **Prose-template library for MVP, Haiku only for the broadsheet forecast column.** Banner + SCB render 1-3 short lines that change on every clock tick — LLM cost and latency aren't worth it for a template-solvable problem. The broadsheet forecast is per-issue (maybe 3×/week) and benefits from variety — Haiku justified.
- **SSE for live updates, never polling.** Infrastructure is already production-ready; N polling loops per player when the server knows exactly when state changed is wasteful.
- **JSONB blob per session for the forecast cache.** One row per session, payload is ~25-50 KB for 7-day GFS. Mirrors `raven_world_ai_proposals` pattern. Avoids row-per-forecast-hour overhead.
- **Replace `lib/weather-seed.ts`, don't duplicate.** Rename to `lib/ambience-weather.ts` and extend. Keep the silent-degrade + `AbortSignal.timeout()` shape.
- **Pentagon/void hex fallback (R3 deferred Q).** If the party hex is a pentagon (astral void), skip the GFS pull and serve stats-only. In practice the party never lives on a void.
- **Spend gating via a new `noaa_gfs` service in `SpendService`.** Free API but gated for kill-switch parity with other services. One seed row in `raven_budget_caps`, soft cap $1 (symbolic).
- **Season mismatch left to DMs.** No calendar-lookup math in v1 (origin doc Q7).
- **Client-safe helper split.** `lib/ambience-prose.ts` (no DB imports) for rendering; `lib/ambience-weather.ts` (server) for fetching + caching + reading.

## Open Questions

### Resolved During Planning

- **Forecast cache shape:** JSONB blob per session. Resolved via research (precedent: `raven_world_ai_proposals`).
- **Banner update mechanism:** SSE `broadcast('game_clock', ...)`. Resolved via research.
- **Prose generation approach:** template library for banner+SCB, Haiku for broadsheet. Resolved via research.
- **Name filter approach:** regex + curated denylist of NOAA AWIPS/WMO station IDs + NOAA hurricane/typhoon name rolls. NER deemed overkill.
- **Pentagon/void hex behavior:** skip GFS pull, serve stats-only.

### Deferred to Implementation

- **[Needs research] NOAA GFS access path.** Direct HTTP from `nomads.ncep.noaa.gov` GRIB2 vs a lighter JSON endpoint (api.weather.gov). First implementation decision in Unit 2.
- **[Needs research] Köppen climate data source at H3 res-2 granularity.** Likely WorldClim bio-climatic variables (public domain), but format evaluation deferred to Unit 1.
- **[Needs research] Elevation data source.** GEBCO vs SRTM vs aggregate. Deferred to Unit 1.
- **[Technical] Stats distribution format.** Histograms per (Köppen, month) vs normal-distribution parameters. Picked in Unit 4.
- **[Technical] Exact `raven_weather` row disposition.** Drop, keep for rollback safety, or migrate. Picked in Unit 3.

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

### Data flow

```
Session start
  └─ action: 'start' → seedSessionAmbience(session_id, party_cell)
                                          │
                                          ├─ fetchGfsForecast(lat, lng)   ← NOAA GFS
                                          │    └─ launderPlaceNames()
                                          ├─ canSpend('noaa_gfs') gate
                                          └─ INSERT ambience_session_cache (session_id, forecast JSONB)

Clock advance
  └─ advanceGameTime(sec) → broadcast('game_clock', 'default', 'patch')
                                          │
                                          ▼
                                   (SSE to all clients)

Client read
  └─ useSSE('game_clock', 'default', refetch) → GET /api/ambience/banner
                                                 │
                                                 ├─ read ambience_session_cache
                                                 ├─ index = clamp(delta_hours, 0, 167)
                                                 ├─ sample_state = forecast[index] + biome_filter
                                                 └─ prose = renderProse(biome, sample_state)
                                                       │
                                                       └─ lib/ambience-prose.ts (template lib)
```

### Biome substrate shape

```
ambience_hex_substrate
  h3_cell        BIGINT PRIMARY KEY
  h3_res         SMALLINT NOT NULL
  koppen         TEXT NOT NULL            -- e.g. 'Cfb', 'BWh'
  elevation_m    INTEGER NOT NULL
  coastal        BOOLEAN NOT NULL
  cw_latitude    REAL NOT NULL
  seeded_at      TIMESTAMPTZ NOT NULL DEFAULT now()
```

### Session forecast cache shape

```
ambience_session_cache
  session_id         TEXT PRIMARY KEY
  party_h3_cell      BIGINT NOT NULL
  fetched_at_real    TIMESTAMPTZ NOT NULL
  session_game_start BIGINT NOT NULL       -- snapshot of game_time_seconds at fetch
  forecast           JSONB NOT NULL        -- 168-element array of hourly states
```

## Implementation Units

### Phase 1 — Substrate + stats foundation

- [ ] **Unit 1: Biome-keyed hex substrate table + seeding script**

**Goal:** Every H3 cell that Shadow touches (and each cell's res-0/1/2 ancestors) has immutable Köppen + elevation + coastal + cw_latitude metadata available to all downstream lookups.

**Requirements:** R1

**Dependencies:** None (H3 substrate is already shipped)

**Files:**
- Create: `lib/ambience-substrate.ts` (reader: `getSubstrate(h3_cell)`)
- Create: `scripts/seed-biome-substrate.mjs`
- Modify: `lib/schema.ts` (new `ambience_hex_substrate` table + index on `h3_res`)
- Modify: `lib/types.ts` (new `BiomeSubstrate` interface)
- Test: `scripts/_test-biome-substrate.mjs` (inline-script smoke test)

**Approach:**
- Seed script walks the same H3 cells `lib/h3-world-data.ts::prepareResolution` produces (res-0, res-1, res-2) plus any revealed res-6 cells. Pulls Köppen from WorldClim bio-climatic raster (evaluate at Unit 1 time — likely GeoTIFF → sample via `rasterio` Python helper OR resample to a small JSON lookup keyed on `(lat, lng)` once and bundle as a static asset).
- Elevation from GEBCO (lighter than SRTM; still public domain). One-time 240MB download, sampled to per-cell means, stored in DB.
- Coastal flag: `distance_to_coastline_km < X` using GEBCO's bathymetry (0 = ocean, positive = above sea level) — any cell within 2 hops of negative elevation is coastal.
- `cw_latitude` is the hex center's lat/lng → CW latitude (currently same as Earth lat since no remap engine yet).

**Patterns to follow:**
- Table creation mirrors `schema.ts:681-687` h3_cell column loop
- Script envelope mirrors `scripts/seed-world-anchor.mjs` (env loading + pg pool)
- Reader pattern mirrors `lib/world-anchor.ts::getWorldAnchor()`

**Test scenarios:**
- Seed runs successfully against Railway; every touched cell has a row
- `getSubstrate()` returns null for a nonexistent cell (not-throws)
- Blaen Hafren res-6 cell gets `koppen='Cfb'` (marine temperate)
- A desert-region cell (if any CW hex projects to one) gets `koppen='BWh'`
- Re-running the seed is idempotent — `ON CONFLICT DO NOTHING` protects existing rows

**Verification:** Count of rows in `ambience_hex_substrate` equals count of distinct H3 cells across res-0/1/2/6 for Shadow's data. Spot-check 3 cells by biome.

---

- [ ] **Unit 2: NOAA GFS fetcher + name laundering**

**Goal:** A single helper function that takes lat/lng, pulls a 7-day hourly forecast from NOAA's public API, strips all real-world place/name references, and returns a validated structured array. Silent-degrades on any network/parse error.

**Requirements:** R3, R6

**Dependencies:** None

**Files:**
- Create: `lib/noaa-gfs.ts` (`fetchForecast(lat, lng): Promise<ForecastHour[] | null>`)
- Create: `lib/raven-name-filter.ts` (exported: `launderText(s: string): string`)
- Create: `lib/raven-name-denylist.ts` (curated arrays: NOAA AWIPS/WMO station IDs, real city names, NOAA hurricane/typhoon rolls)
- Modify: `lib/types.ts` (`ForecastHour`, `WeatherState`)
- Modify: `lib/types.ts::SpendService` — add `'noaa_gfs'`
- Modify: `lib/schema.ts` — seed `raven_budget_caps` row for `'noaa_gfs'`
- Test: `scripts/_test-noaa-gfs.mjs` (inline-script, hits real API once)
- Test: `scripts/_test-name-filter.mjs` (pure TS, no network)

**Approach:**
- First implementation decision in this unit: NOAA NOMADS GRIB2 (industry standard, needs parsing) vs `api.weather.gov` JSON (simpler, possibly coarser spatial). Research at unit-start — prefer JSON if it covers 7-day hourly at the needed granularity.
- Timeout: 20s via `AbortSignal.timeout(20_000)`. `withRetry` wrapper.
- Laundering is applied to *every string field* in the response before it crosses the function boundary. Denylist match replaces with generic tag (`[station]`, `[storm]`).
- Validate shape via Zod or manual guards — reject if any hour is missing required fields.
- Record spend with `record({ service: 'noaa_gfs', amount_usd: 0, units: 1, unit_kind: 'fetch' })` — free but ledger-visible.
- Gate with `canSpend('noaa_gfs')`.

**Patterns to follow:**
- `lib/elevenlabs.ts` (env gate + timeout + spend record + silent-null)
- `lib/retry.ts::withRetry`

**Test scenarios:**
- Known-good lat/lng (Blaen Hafren 52.48, -3.73) returns a non-null 168-element array
- 24.0.0.1 or unreachable URL returns null, no throw
- Laundering strips `"near Boston, MA"` → `"near [place]"` in a test string
- Laundering leaves a generic string like `"moderate rain"` unchanged
- Budget gate returns null when `canSpend('noaa_gfs')` is false

**Verification:** Running the test script against Railway (env vars) produces a 168-hour forecast array with no real place names in any string field.

---

### Phase 2 — Session cache + playback

- [ ] **Unit 3: Session ambience cache + replace `weather-seed.ts`**

**Goal:** Session start pulls the forecast once, caches it keyed on `session_id`, and is the single source of truth for all weather reads during that session. Replaces `lib/weather-seed.ts`.

**Requirements:** R3

**Dependencies:** Unit 2

**Files:**
- Create: `lib/ambience-weather.ts` (`seedSessionAmbience(session_id, h3_cell)`, `getSessionForecast(session_id)`)
- Delete: `lib/weather-seed.ts` (replaced)
- Modify: `lib/schema.ts` (new `ambience_session_cache` table)
- Modify: `app/api/sessions/[id]/route.ts` (swap `seedSessionWeather` call for `seedSessionAmbience`)
- Modify: `lib/types.ts` (`AmbienceSessionCache`)
- Test: `scripts/_test-session-cache.mjs`

**Approach:**
- `seedSessionAmbience(session_id, h3_cell)`:
  1. Look up the hex's lat/lng (reuse `cellToLatLng` from `lib/h3.ts`).
  2. If pentagon (via `isPentagon`), return early — stats-only path.
  3. Call `fetchForecast(lat, lng)` from Unit 2.
  4. Snapshot `game_time_seconds` via `getGameClock()`.
  5. Upsert to `ambience_session_cache` keyed on `session_id`.
- Existing `raven_weather` row (`hex_id='default'`) stays for now — read path swaps, but old row untouched for rollback safety. Drop in a follow-up PR.

**Patterns to follow:**
- `lib/world-anchor.ts::getWorldAnchor` (reader with fallback)
- `lib/weather-seed.ts` (the thing we're replacing — take the envelope)
- Session-start hook: `app/api/sessions/[id]/route.ts:92-101`

**Test scenarios:**
- `seedSessionAmbience('test-session', valid-cell)` writes a row; re-run is idempotent upsert
- Pentagon cell: no row written, no error
- NOAA fetch failure: no row written, no error (silent-degrade)
- Running `action: 'start'` on a real session triggers the seed and produces a cache row

**Verification:** After `POST /api/sessions/X/route { action: 'start' }`, `ambience_session_cache` has a row with a 168-element forecast for the party hex, and the Railway logs show no errors from the NOAA helper.

---

- [ ] **Unit 4: Forecast-playback + stats-only read path**

**Goal:** Pure reader functions that return the *current* weather state for any hex at the current game time — using the session forecast for the party hex, falling back to biome-stats for non-party hexes or when no cache exists.

**Requirements:** R2, R3

**Dependencies:** Unit 1, Unit 3

**Files:**
- Modify: `lib/ambience-weather.ts` — add `getCurrentState({ session_id, h3_cell, game_time_seconds })`
- Create: `lib/ambience-stats.ts` (pure, no DB) — `sampleFromBiome({ koppen, month, game_time_hour }): WeatherState`
- Create: `data/ambience/biome-distributions.json` (static — per-Köppen monthly histograms or normal params)
- Create: `scripts/build-biome-distributions.mjs` — one-time generator from 30-year climate normals
- Test: `scripts/_test-playback.mjs`

**Approach:**
- `getCurrentState`:
  1. If `h3_cell === partyCell(session_id)` and cache row exists: `forecast_index = clamp((current - session_game_start) / 3600, 0, 167)`; return `forecast[index]`.
  2. Else (or on missing cache): look up `ambience_hex_substrate.koppen` and call `sampleFromBiome({ koppen, month, game_time_hour })`.
- `sampleFromBiome` is deterministic — seeded by a hash of `(koppen, game_time_hour)` — same (hex, hour) always returns the same weather even across refreshes. Uses a Mulberry32 PRNG or similar.
- Biome filter is applied to forecast samples *before* they reach the renderer: if `forecast[i].condition === 'snow'` but `koppen ∈ {A, BWh}`, coerce to the zone's appropriate analog (tropical storm, duststorm).
- Stats distribution format (deferred Q): start with normal-dist parameters per `(koppen, month)` for temperature, and categorical per-month probability tables for condition type. Buildable from NOAA normals + WorldClim bio-climatic.

**Patterns to follow:**
- `lib/game-clock.ts` clock-reading pattern for `getGameClock()`
- `lib/game-clock-format.ts` client-safe split (but this file is server-ish — splits into both a client and server half)

**Test scenarios:**
- Party hex with cache, game_time 0h after session start → returns `forecast[0]`
- Party hex with cache, game_time 36h after session start → returns `forecast[36]`
- Party hex with cache, game_time 200h after session start → returns `forecast[167]` (clamped)
- Non-party hex with biome substrate → deterministic per `(hex, hour)`, same call returns same result
- Forecast sample with impossible biome combo is coerced (snow-in-desert test)

**Verification:** Running the test script across a sweep of game times produces a smooth time-series for the party hex (matches forecast), and neighbors show biome-plausible weather.

---

### Phase 3 — Prose presentation

- [ ] **Unit 5: Prose template library + server composer**

**Goal:** A pure client-safe helper that turns `WeatherState + BiomeSubstrate + timeOfDay` into a short DM-voice sentence, plus a server-side endpoint the three surfaces call. Haiku is used only for the broadsheet forecast column.

**Requirements:** R4, R5

**Dependencies:** Unit 1, Unit 4

**Files:**
- Create: `lib/ambience-prose.ts` (pure, no DB) — `renderProse({ koppen, state, timeOfDay }): string`
- Create: `data/ambience/prose-templates.json` — ~50-100 template lines keyed on `(koppen-family, condition-bucket, time-of-day)`
- Create: `lib/ambience-forecast-prose.ts` — Haiku call for broadsheet's 3-day forecast column
- Create: `app/api/ambience/banner/route.ts` — returns `{ prose, state }` for a given `player_id` or `session_id`
- Create: `app/api/ambience/forecast/route.ts` — returns 3 prose lines for the broadsheet
- Test: `scripts/_test-prose-render.mjs`

**Approach:**
- Template library: hand-authored ~50 short lines up front, 5-6 Köppen-family buckets × 4-6 condition buckets × 2 time-of-day tags. Selection deterministic per `(hex, game_time_hour)` hash.
- Banner/SCB/broadsheet today+current lines use the template library. Zero LLM cost.
- Broadsheet 3-day-ahead column uses `lib/ambience-forecast-prose.ts` — a Haiku call that takes the forecast slice and returns 3 one-sentence lines. Gated via `canSpend('anthropic')`. Cached per-issue in `raven_issue_draft` (existing table).
- `lib/ambience-prose.ts` must not import anything from `lib/db.ts` or `lib/schema.ts` — client components import it directly.

**Patterns to follow:**
- `lib/game-clock-format.ts` (client-safe split)
- `lib/raven-draft.ts` (Haiku + JSON-in-text + spend gating) — mirror shape for forecast prose

**Test scenarios:**
- Marine temperate + moderate rain + afternoon → recognizable `"A wet wind off the sea."` family output
- Hot desert + clear + midday → `"Dust thick on the tongue."` family output
- Same (biome, state, hour) across calls returns the same line (deterministic)
- Haiku forecast call: given a 3-day slice, returns exactly 3 lines
- Haiku forecast call: budget-gated — returns null when `canSpend('anthropic')` is false

**Verification:** A DM on Shadow sees a weather prose line on each player banner matching the biome + forecast playback state. Broadsheet forecast column shows 3 distinct lines per issue.

---

### Phase 4 — Three surfaces

- [ ] **Unit 6: Player sheet banner surface**

**Goal:** Each player's `/players/[id]` page shows a single-line weather sentence under the ambient banner that updates when the DM advances the clock.

**Requirements:** R4, R5

**Dependencies:** Unit 5, Unit 8 (SSE broadcast)

**Files:**
- Modify: `components/PlayerBanner.tsx` — add a prose line after line 82
- Modify: `components/PlayerBannerWeather.tsx` — extend the `/api/weather/current` fetch to also pull the new `/api/ambience/banner` response (or fold the two)
- Test: manual QA + SSE console log

**Approach:**
- Fetch `/api/ambience/banner?playerId=X` on mount.
- Subscribe to SSE `('game_clock', 'default')` via `useSSE`; on event, re-fetch.
- Render the prose as a one-line caption; absolute-positioned below the ambient circles per `components/PlayerBanner.tsx:82`.
- Use inline styles for positioning (Tailwind v4 Safari-in-production gotcha per CLAUDE.md).

**Patterns to follow:**
- `components/SplashNav.tsx` (only current SSE consumer)
- `components/PlayerBannerWeather.tsx:227-232` (existing `/api/weather/current` fetch shape)

**Test scenarios:**
- Loading `/players/ajax` shows a weather line consistent with Shadow's biome
- DM advancing the clock via `/api/clock/advance` triggers a re-fetch (SSE fires) within ~1s
- Clock pause: line stays the same; no re-fetch
- Network drop: line persists (stale-while-reconnecting via `useSSE` backoff)

**Verification:** Open `/players/ajax` in one browser, advance the game clock in another (as DM), confirm the line updates within a second without page reload.

---

- [ ] **Unit 7: Session Control Bar DM chip**

**Goal:** The DM sees a compact weather chip in the SCB with the current prose line inline and the raw state on hover.

**Requirements:** R4, R5

**Dependencies:** Unit 5, Unit 8

**Files:**
- Modify: `components/DmSessionsClient.tsx` — add column 4 after line 414's divider
- Create: `components/DmWeatherChip.tsx` (small component, `/api/ambience/banner` fetch + hover card)

**Approach:**
- Fourth flex-column group after the existing `Time | Long Rest | Players` row. Same visual weight as the other columns.
- Chip displays the prose line; hover reveals `{ koppen, temp, wind, precip, pressure, condition }` — DM-only raw state.
- Subscribes to SSE game_clock events like Unit 6.

**Patterns to follow:**
- `components/DmSessionsClient.tsx:343` (existing 3-column flex pattern)
- `components/RavenWeatherPill.tsx` (chip styling reference, but swap to warm palette)

**Test scenarios:**
- Chip shows prose line at session start
- Hover reveals the raw weather state (numbers shown to DM)
- Clock advance triggers prose update within ~1s
- Chip renders correctly in Safari production (inline-style grid, per CLAUDE.md gotcha)

**Verification:** DM page shows a weather chip in the SCB; hover shows numbers; advancing time refreshes both.

---

- [ ] **Unit 8: Raven Post broadsheet forecast column**

**Goal:** The RP broadsheet's grid fills its empty `(row 3, col 3)` cell with a "Forecast" block showing today + next 2 in-fiction days as prose, one sentence each.

**Requirements:** R4, R5

**Dependencies:** Unit 5

**Files:**
- Modify: `components/RavenBroadsheet.tsx` — populate the empty grid cell with a forecast section
- Modify: `components/RavenPostPlayer.tsx` (or wherever the broadsheet receives its data) — pass the forecast payload
- Modify: `app/api/raven-post/.../route.ts` (confirm exact file during implementation) — include the forecast column in the issue payload
- Create (if needed): `app/api/ambience/forecast/route.ts` — returns the 3-line forecast for the current issue

**Approach:**
- Grid area: add `forecast` to `grid-template-areas`, replacing the `.` at `(row 3, col 3)`.
- Three prose lines rendered stacked: "Today", "+1 day", "+2 days" headers over each sentence.
- Forecast lines are generated once per issue (issue-refresh cadence) via `lib/ambience-forecast-prose.ts` (Haiku) — cached in `raven_issue_draft` via an additional column.
- `components/RavenBroadsheet.tsx` already receives `weather: RavenWeatherRow` prop (line 191) but doesn't render it — activate it + add new `forecast: ForecastColumn` prop.

**Patterns to follow:**
- `components/RavenBroadsheet.tsx:92-107` grid layout (LAYOUT_CSS)
- Mobile collapse at line 128
- `raven_issue_draft` schema for per-issue cached data

**Test scenarios:**
- Broadsheet shows the Forecast column at the bottom-right on desktop
- Mobile layout collapses the column below the other grid sections
- Forecast lines match the cached forecast playback 0h / 24h / 48h
- Haiku call falls back to a default line if `canSpend('anthropic')` is false

**Verification:** Visit `/raven-post` on Shadow; see 3 prose forecast lines in the bottom-right grid cell. Advance the clock or publish a new issue → lines refresh.

---

### Phase 5 — SSE broadcast on clock advance

- [ ] **Unit 9: Broadcast on game-clock events**

**Goal:** Any time the game clock advances (or a session starts/ends), SSE fires so the three surfaces refresh without polling.

**Requirements:** R5 (implicit — feeds all surface refreshes)

**Dependencies:** None (but Units 6-8 depend on this)

**Files:**
- Modify: `app/api/clock/advance/route.ts` — add `broadcast('game_clock', 'default', 'patch')` after the successful advance
- Modify: `app/api/sessions/[id]/route.ts` — add the same broadcast after `action: 'start'` succeeds and after `action: 'end'`
- Test: manual QA with `curl` + browser-side console

**Approach:**
- Single line addition at the end of each handler. No new helper needed.
- The existing `lib/events.ts::broadcast` is idempotent and safe to call on every tick.

**Patterns to follow:**
- `app/api/presence/route.ts:46` — the only current producer

**Test scenarios:**
- `POST /api/clock/advance { seconds: 3600 }` triggers a game_clock SSE event visible in the browser's event stream
- `POST /api/sessions/X/route { action: 'start' }` triggers an event
- `action: 'end'` triggers an event
- An error mid-advance (e.g. paused clock) does NOT broadcast (only on success)

**Verification:** Open `/api/events` in a browser tab (or curl --no-buffer), advance the clock, see a `data: { table: 'game_clock', ... }` line within a second.

---

## System-Wide Impact

- **Interaction graph:** Session-start and clock-advance hooks become active producers on SSE. All three surfaces are active consumers. Ripples possible in any other client component that later subscribes to `game_clock`.
- **Error propagation:** NOAA fetch failure → null cache row → stats-only fallback on reads. Never throws up to the surface. Failed broadcast is logged but doesn't fail the tick.
- **State lifecycle risks:** Forecast cache is session-scoped. If a session is deleted without `action: 'end'`, the cache row is orphaned — add `ON DELETE CASCADE` on `session_id`. Forecast playback index clamps to valid range; no undefined-access risk.
- **API surface parity:** `/api/weather/current` currently returns a `RavenWeatherRow` shape. Ambience v1 adds `/api/ambience/banner` returning a different shape. `/api/weather/current` stays for the ambient circles component. Two parallel shapes during transition; converge post-v1.
- **Integration coverage:** End-to-end tests cover session start → cache populated → clock advance → SSE → client refresh → prose updates. Unit-level tests for laundering + prose rendering cover edge cases.

## Risks & Dependencies

- **WorldClim / GEBCO data size.** WorldClim bio-climatic at the needed resolution is ~100MB–1GB. Build-time resample to a small JSON lookup for only touched hexes keeps runtime light. Validate data pipeline in Unit 1.
- **NOAA API shape variance.** `api.weather.gov` is stable; NOMADS GRIB2 needs a parsing library (wgrib2 or similar). Bias toward api.weather.gov unless it's insufficient.
- **Prose quality.** Template library might feel repetitive after 50+ sessions. Solvable by expanding templates later (no code change) or escalating to Haiku per-state (configurable). Not a v1 blocker.
- **Client bundle drag.** If `lib/ambience-prose.ts` accidentally imports something that pulls `lib/db.ts`, Turbopack fails with `Can't resolve 'tls'`. Enforce via tsc + manual import audit at the end of each unit.
- **Name filter completeness.** First-session leak of a NOAA storm name is a brand-stopper. Denylist needs to be conservative (prefer over-strip). Add a manual QA pass where a dev inspects the forecast cache JSONB for suspicious strings before public rollout.

## Documentation / Operational Notes

- Update `DESIGN.md` "Raven Post Broadsheet — Layout 1 v1" section once the forecast column lands — add a `(12)` entry for the new grid cell.
- Update `COMMS.md` with a "NOAA GFS — session-start forecast" entry mirroring the Resend entry shape.
- Add `NOAA_GFS_API_KEY` to Railway if api.weather.gov requires one (it doesn't currently, but check at Unit 2 time).
- Rollout note: biome substrate seed is a one-time job; can run off-peak. Session cache populates per-session; no migration needed.

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-19-ambience-v1-requirements.md](../brainstorms/2026-04-19-ambience-v1-requirements.md)
- **Ideation document:** [docs/ideation/2026-04-19-weather-believability-ideation.md](../ideation/2026-04-19-weather-believability-ideation.md)
- **Related code:**
  - `lib/weather-seed.ts` — to be replaced
  - `lib/spend.ts`, `lib/retry.ts`, `lib/anthropic-pricing.ts` — helper patterns
  - `lib/events.ts`, `lib/useSSE.ts` — SSE infrastructure
  - `lib/h3.ts`, `lib/h3-world-data.ts`, `lib/world-hex-mapping.ts` — H3 foundation
  - `lib/game-clock.ts`, `lib/game-clock-format.ts` — clock + client-safe split pattern
  - `lib/raven-draft.ts`, `lib/world-ai-draft.ts` — LLM helper shapes
  - `components/PlayerBanner.tsx`, `components/DmSessionsClient.tsx`, `components/RavenBroadsheet.tsx` — three surface insertion points
- **Roadmap slotting:**
  - v15 #85 — Biome-keyed hex substrate (this plan's Unit 1)
  - v15 #111 — Weather MVP / Ambience v1 (this plan)
  - v15 #115 — Continent-coherent storm translation (follow-up, not this plan)
  - v12 #106 — Weather → NPC consequence (follow-up, depends on v12 NPC Layer A)
