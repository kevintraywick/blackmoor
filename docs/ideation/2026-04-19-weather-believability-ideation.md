---
date: 2026-04-19
topic: weather-believability
focus: use earth weather with a fantasy world map; what it takes for patterns to be roughly believable or at least not unbelievable
---

# Ideation: Earth weather for a fantasy world

Kevin wants to use real Earth weather data (NOAA GFS is on the v15 roadmap) on the Common World's fantasy geography. The hard question: how do you pipe live physical-reality data into an invented world without it feeling *wrong* — or worse, uncanny in a way that breaks immersion?

## Codebase Context

**Already decided / planned (BRAINSTORM.md):**
- §9: Borrow Earth's *rules*; invent Earth's *furniture*. The "laundering rule" — remap Earth regions to arbitrary Common World hex-atlas locations. Physics-true, identity-stripped.
- §9 ingredients flagged for use: GEBCO elevation, SRTM, Köppen climate zones, NOAA GFS live weather, NOAA SWPC aurora/solar, prevailing winds, ocean currents.
- §9 explicit traps: real place names, real storm names, current real disasters (ethically queasy), recognizable coastlines.
- §12 Steampunk + airships: prevailing winds become physics for airship trade routes, not vibes.
- v15 "News, weather, celestial" is the roadmap home for this work.

**Already shipped:**
- H3 spatial substrate (v3) — every CW hex has an H3 cell ID
- World anchor at Blaen Hafren with real lat/lng
- `lib/world-hex-mapping.ts` — projects CW coordinates to real Earth lat/lng
- `raven_weather` table (text-keyed, `condition / temp_c / wind_label`) — placeholder
- `world_hexes.weather_override` column — exists but unused
- DESIGN.md: "Environmental inheritance — local maps read current environmental state from parent world hex at game time"
- Globe 3D view now renders a NASA Earth texture as the sphere surface

**Gaps:**
- No biome / climate zone data per hex
- No elevation data per hex
- No weather-fetch job
- No weather → NPC behavior linkage
- `raven_weather` is single-row placeholder, not H3-cell-keyed
- No name / place-reference filter on any inbound real-world data

## Generated candidates (22 raw → 7 survivors)

### Survivors (in recommended order)

### 1. Biome-keyed hex substrate

**Description:** Every CW hex gets immutable climate metadata at seed time: Köppen zone (`Af`, `Cfb`, `Dfb`, `BWh`, etc.), elevation in meters (from GEBCO/SRTM), "is coastal / inland / mountain" flag, and a CW-latitude shim (the hex's CW latitude, independent of where Earth data gets sampled). All weather queries filter against these. A desert hex never shows snowfall; a tundra hex never shows rain-without-freeze.

**Rationale:** Believability is primarily a *consistency* problem, not a *fidelity* problem. If every hex has strong baseline attributes and weather is always compatible with them, players accept "implausible on Earth" as "how CW works" because it's internally coherent. This is the foundation every other weather idea rests on — without it, live data projected onto random hexes produces noise.

**Downsides:** Requires one-time seed job to tag 5,882 res-2 cells (or more if we go finer). Elevation data is public-domain but 1–3 GB uncompressed for global SRTM — need to slice to just CW's claimed region. Köppen classification requires temperature + precipitation means which we'd sample from a climate dataset (WorldClim is free, public domain).

**Confidence:** 90%
**Complexity:** Medium
**Status:** Unexplored

### 2. Prose-as-presentation (no numbers to players)

**Description:** The player never sees a temperature in °C, pressure in hPa, or wind speed in knots. World AI writes short DM-voice prose each time weather is referenced: *"A cold drizzle off the sea. The banners hang wet."* DM gets the underlying state (biome + current sample); players get language. The Raven Post broadsheet's weather line becomes a sentence, not a data point.

**Rationale:** The believability trap is trying to make real-world data *match* fantasy geography. Sidestep it by never exposing the raw data. Three words of DM-voice prose tell the player "it's a wet day" and that's all they need; no meteorological inspection is possible. Makes believability a *language-quality* problem, not a fidelity problem. Also aligns with DESIGN.md's "no AI purple prose" rule — terse, sensory, DM-voice.

**Downsides:** DM may want raw state for session planning. Keep the numeric state in the DM view; suppress from player view. Also means every weather beat is an Anthropic call — budget pressure. Mitigate via template cache (one generated sentence per (biome, condition) tuple, reused for a game-hour).

**Confidence:** 85%
**Complexity:** Low–Medium
**Status:** Unexplored

### 3. Weather → NPC consequence

**Description:** Ambient NPCs (Layer A from §3) adjust behavior by hex weather: smith closes the forge on storm days, caravan refuses to depart in blizzard, sailors get drunk waiting for wind, dockworkers double pay during rain, the hen yard floods and eggs are scarce. Weather feels real because it *does* things.

**Rationale:** Believability from consequence, not from data. When the DM opens Riverton on a rainy day and sees "Bakery: closed (flooding)" and "Market: sparse (wagons delayed)", weather stops being a numeric overlay and becomes texture. Massive payoff per unit effort — one schedule-modifier table, applied per NPC profession, delivers far more weather-feel than any amount of meteorological accuracy.

**Downsides:** Depends on NPC Layer A shipping (v12). Until then, purely additive. Schedule rules need curation — 10–15 professions × 4–6 weather states = manageable. Could ship this without live weather at all, just stats-driven.

**Confidence:** 85%
**Complexity:** Low (data table + one code path in NPC schedule)
**Status:** Unexplored

### 4. Stats-only weather (no live NOAA)

**Description:** Skip live NOAA entirely. Download a 30-year historical climate summary per Köppen zone (public, free — WorldClim + NOAA's historical normals). At each game-clock tick, draw a weather sample from that zone's distribution (log-normal precipitation, normal temperature, etc.). No live API dependency, no outage risk, no real-world ethics issues, infinite variety, perfectly deterministic if seeded.

**Rationale:** Kevin's ask is "not unbelievable." That bar is lower than "actually real." If the distribution of weather per biome matches Earth's historical distribution, no one can point at a wrong sample. And this is dramatically cheaper and more reliable than streaming GFS. Belongs as the MVP path.

**Downsides:** No tie-in to real-world events (no "the sky danced last night" from actual aurora). No drama from a real hurricane season. Entirely procedural — some DMs may want the real-world resonance. Mitigate by layering idea 5 on top when desired.

**Confidence:** 90%
**Complexity:** Medium (climatology data sourcing + per-zone distribution code)
**Status:** Unexplored

### 5. Static climate + live anomaly layer

**Description:** Baseline weather is procedural from each hex's biome (idea 4). NOAA GFS is only pulled for *anomalies* — solar flares, named hurricanes, unusual auroras, eclipses (NOAA SWPC has space weather data). Anomalies get laundered (idea 7), translated to random CW continents, and enter the world as rare narrative events. 99% of the time the weather is procedural; 1% of the time something real and strange happens.

**Rationale:** Captures the magic of "the sky really did dance last night" — the moments where real-world data becomes uncanny in-fiction texture — without the unbelievability risk of raw projected NOAA GFS. Keeps the API budget tiny (only fires when SWPC reports something unusual). Makes the world feel alive without needing to match Earth day-to-day.

**Downsides:** Adds a second data pipeline on top of idea 4. Requires "anomaly detector" — rules for which SWPC / GFS readings cross the narrative threshold. Not v15 MVP; adds in v15 phase 2.

**Confidence:** 80%
**Complexity:** Medium
**Status:** Unexplored

### 6. Continent-coherent storm translation (if using live GFS)

**Description:** When we *do* project live GFS onto CW, do it per-continent. Pick an origin Earth region (e.g., North Atlantic), slice its storm polygons, rotate + translate as a unit onto a target CW continent. Preserve spatial structure — a Gulf Stream storm moving east-northeast stays a coherent storm moving east-northeast on the target continent. Apply EMA smoothing across k-ring neighbors for mid-resolution sampling. Never sample per-hex from random Earth locations.

**Rationale:** The noise of per-hex random sampling is the single biggest unbelievability risk. Weather in real life is *correlated at scale* — neighbors have similar conditions because storms are big. Continent-coherent translation preserves that; per-hex sampling destroys it. This is how you use live GFS without making the world look like TV static.

**Downsides:** Significant engineering. Per-continent registration (which Earth region maps to which CW continent?) is a one-time editorial + math job. Storm-polygon translation needs great-circle-correct rotation. Smoothing the edges (where a translated continent meets ocean on CW) gets fussy. Probably a v15 phase 3 / v16 concern.

**Confidence:** 70%
**Complexity:** High
**Status:** Unexplored

### 7. Safety bundle: time-lag + name-launder + budget cap

**Description:** Three small rules applied to any live data pipeline:
- **7-day time lag** on GFS ingest. Avoid broadcasting real-time disasters as entertainment.
- **Name / place laundering**. Strip all station names, city names, county names, and NOAA-assigned storm names before storage. The "Hurricane Boston" scenario is a brand-killer.
- **Budget cap** per the Q4 agent-budget pattern. Weather fetch + storage + LLM narration stays under $2/mo for MVP; hard-cap at $5/mo. Kill switch in `/dm/campaign` already set up from the v12 work.

**Rationale:** Not new features, but non-negotiable guardrails. Must land with *any* live-data feature. Cheap. Preventable-disaster-avoidance.

**Downsides:** Small tax on implementation, but each is <1 day. The time-lag is the one with real user impact — "live" weather isn't live. Belief tradeoff: 7-day lag weather on a fantasy world is still 100% believable; it's not pitching "this is Earth right now."

**Confidence:** 95%
**Complexity:** Low
**Status:** Unexplored

## Rejection Summary

| # | Idea | Reason rejected |
|---|------|-----------------|
| 1 | Latitude-based temperature shim | Absorbed into #1 (Biome-keyed substrate) — too small to stand alone |
| 3 | Continental drift reassignment (full-globe) | Over-engineered for MVP; folded into #6 as the live-data path |
| 4 | Laundered storm tracks (standalone) | Component of #6, not a standalone idea |
| 6 | EMA smoothing across k-ring | Technical detail of #6, not a standalone idea |
| 7 | Season from CW calendar | Important but a one-liner addition to #1, not a standalone idea |
| 8 | Sparse anchor sampling + interpolation | Performance optimization; premature until we have scale problems |
| 9 | Named-storm laundering (standalone) | Absorbed into #7 (Safety bundle) |
| 12 | Prevailing winds for airships | Already decided in BRAINSTORM §12; not new |
| 13 | Place-name blacklist | Absorbed into #7 |
| 14 | Authority-tier visibility caps | Clever but adds complexity without clear believability payoff; defer to post-beta if ever |
| 15 | Altitude-correct climate (standalone) | Absorbed into #1 — elevation is part of the substrate |
| 16 | Time-lagged playback (standalone) | Absorbed into #7 |
| 17 | Budget guardrail (standalone) | Absorbed into #7 |
| 19 | ML-generated synthetic weather | Overkill for MVP; resurface in v20+ if we have training data pipelines |
| 20 | Prose-only presentation (standalone) | Promoted to #2 |
| 21 | Signal/noise push | Small tactic; rolls into #5's "only when interesting" logic |

## Session Log
- 2026-04-19: Initial ideation — 22 candidates generated, 7 survivors
