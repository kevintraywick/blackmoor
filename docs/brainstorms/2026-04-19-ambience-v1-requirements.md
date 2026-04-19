---
date: 2026-04-19
topic: ambience-v1
---

# Ambience v1 — biome substrate, prose weather, party-hex live forecast

## Problem Frame

The Common World needs to *feel* alive between and during sessions — grey rain off the sea, snow at altitude, a named storm at the tavern door. Weather is the most sensory lever. The challenge: piping real Earth weather data into a fantasy world without making it unbelievable.

The deliverable is framed as "weather" but the substrate (hex-tagged biome + elevation + coastal flag) and presentation layer (prose-as-output, not numbers) double as foundation for day/night, seasons, magic-zone rendering (v14 MP), and NPC schedules (v12). Treat it as **Ambience v1**, with weather as the lead user-facing feature.

Source: `docs/ideation/2026-04-19-weather-believability-ideation.md`.

## Requirements

### R1. Biome-keyed hex substrate (seed-time)

Every H3 cell that is or could be touched by a campaign gets immutable metadata tagged at seed time:

- Köppen climate zone code (e.g. `Cfb`, `BWh`, `Dfb`)
- Elevation in meters
- Coastal / inland / mountain flag (derived from elevation + distance to water)
- CW latitude (the hex's latitude in the Common World frame, independent of Earth)

These attributes are computed from the hex's Earth-projected lat/lng once, stored, and never recomputed at runtime. Every weather query consults them to filter out egregiously-wrong samples (no snow on a desert cell, etc.).

Storage tier for the MVP is every res-2 cell that contains at least one Shadow res-6 hex, plus their res-1 and res-0 ancestors. Full-globe tagging is deferred to v9 work.

### R2. Stats-only weather for non-party hexes

Every hex that is *not* the current party hex gets weather drawn from a historical climate distribution keyed on its Köppen zone + season. No live API pulls. Deterministic per `(hex, game_time_hour)` seed so weather is stable across refreshes.

MVP treats this as on-demand: a hex's weather is computed only when a caller asks for it. No pre-computation job.

### R3. Live GFS forecast for the party hex (session-scoped)

At session start — when the DM opens `/dm` or presses `START` on the Session Control Bar — the system pulls the 7-day NOAA GFS forecast for the party hex's Earth lat/lng and caches it for the duration of the session.

- **Granularity:** party hex = `world_map.party_q/r` (the single shared cell for the group, as dual-written to `h3_cell`).
- **Playback:** as the DM advances the game clock, the cached forecast plays forward — `game_time_hour + 0h` reads the forecast's t=0; after advancing 36 in-fiction hours, reads t=36h. A real Earth storm at t+36h shows up in-fiction 36 hours after session start.
- **Relocation:** if the party hex changes mid-session, the cached forecast does **not** re-fetch. The party uses the session-start hex's forecast until next session. Next session's session-start fetch picks up the new location.
- **Season mismatch:** real-now GFS data is used regardless of in-fiction season. No historical lookup, no offset math. DMs narrate around any mismatch. Shadow's clock tracks real-time closely enough that this is rarely jarring, and no campaign is a "pocket" (all are Common World canon) so there's no alternative-calendar complexity in v1.

### R4. Prose-as-presentation (no numbers to players)

All player-facing weather references are short DM-voice sentences. Players never see °C, hPa, wind in knots, or precipitation in mm/hr. The raw state is preserved in the data layer for the DM's own use; rendering to players strips numbers and replaces them with sensory prose.

The prose *must* be consistent with the hex's biome metadata (R1) — the filter runs before any language is generated.

### R5. Three weather surfaces

Weather is rendered to three places in v1:

- **Player sheet banner.** A one-line ambient sentence under each player's portrait (*"Grey sky. Raincoats out."*). Updates as the game clock advances.
- **Session Control Bar DM badge.** Small weather chip visible only to the DM. Shows the raw state on hover/click (biome, temp, wind, precip, pressure) and the prose version inline.
- **Broadsheet weather column.** A dedicated block on the Raven Post front page showing today + the next 2 in-fiction days as prose, one sentence each. Refreshed per issue.

The three Raven Post front-page one-line weather blurb, the Journey map overlay, and any player-side raw data displays are **out of scope for v1**.

### R6. Name and place-reference laundering

Any string entering storage from a NOAA/SWPC/external feed is filtered before persist:

- Real place names (cities, counties, stations, country names) stripped.
- Real assigned storm names (NOAA hurricane names, typhoon designations) stripped.
- Replaced with in-fiction generated names seeded by (continent, year, season) so they're consistent session-to-session within a campaign.

This applies to MVP because the party-hex live GFS pull is the first entry point for real-world strings and must not expose them.

## Success Criteria

- **SC1.** A DM starting a session sees a weather line in the SCB badge, each player's banner renders a weather sentence consistent with Shadow's biome, and the Raven Post broadsheet's weather column shows three prose forecast lines. All three surfaces reflect the same underlying session-start state.
- **SC2.** Advancing the game clock by N in-fiction hours during a session changes the player banner and the broadsheet forecast column to reflect the playback-forward state. The DM badge updates similarly.
- **SC3.** A player opening their sheet never sees a number, unit, or real-world place/storm name in any weather-derived text.
- **SC4.** Weather shown is always consistent with the hex's biome — a desert-coded hex never produces a "snow falls" prose line, regardless of what the GFS sample says.
- **SC5.** A session that runs offline (NOAA feed unreachable) still renders weather on all three surfaces by falling back to stats-only (R2) for the party hex.

## Scope Boundaries

Explicitly **out of v1** (tracked as follow-up roadmap items below):

- NPC schedule consequences (weather → smith closes, caravan delays). Requires v12 NPC Layer A first. → **v12 item.**
- Rare anomaly layer (SWPC aurora/flares, eclipses, supermoons as rare global events). → **v15 phase 2 item.**
- Continent-coherent storm translation (projecting real GFS onto CW continents with rotation + smoothing for non-party hexes). → **v15 phase 3 / v16 item.**
- Raven Post front-page one-line weather blurb.
- Journey map weather overlay.
- Player-visible raw data displays of any kind.
- Per-campaign custom calendars or season offsets.
- Weather that changes per-player within the same party (multi-party-location support is v19 crossover scope).

## Key Decisions

- **Reframed as Ambience v1.** The substrate (biome + elevation + coastal flag) and presentation pattern (prose, not numbers) serve day/night, magic-zone rendering, NPC schedules, and seasons beyond just weather. Naming the deliverable "Ambience v1" surfaces this compounding value in planning.
- **Granularity = party hex, not per-player.** One fetch per session, one forecast shared by all players in the campaign. Split-party scenarios are a v19 concern.
- **Session-start fetch with 7-day forecast playback.** One GFS pull per session; forecast plays forward with the game clock. Zero incremental API cost within a session.
- **Session-locked forecast.** Party relocation mid-session does not re-fetch. Simpler, predictable, cheap; any narrative awkwardness is a DM problem.
- **Ignore season mismatch in v1.** Real-now GFS regardless of in-fiction season. DM narrates around. Not a problem while Shadow's clock is close to real-time and no campaign is pocket.
- **Stats-only is on-demand, not pre-computed.** No global weather cron. A hex's current weather is computed when queried. Keeps implementation small.
- **Name laundering reinstated.** Originally dropped with #7 safety bundle, but exposing "Hurricane Boston" or station IDs to players is a brand-stopper. 1-hour filter, goes in.
- **Budget cap reused from Q4 agent-budget work (v12).** GFS + narration Anthropic calls stay under the existing $8/$15 per-campaign cap; no new budget machinery.

## Dependencies / Assumptions

- **H3 substrate (v3) shipped** — `world_hexes.h3_cell` and `world-hex-mapping` are in production. ✓
- **World anchor (v3) shipped** — Blaen Hafren's lat/lng is canonical. ✓
- **Game clock (`lib/game-clock.ts`) exists** — session time advance is already a code path. ✓
- **Session Control Bar exists** — adding a weather chip is an additive DOM change. ✓
- **Spend ledger (`lib/spend.ts`) exists** — can gate GFS fetches with existing budget infrastructure. ✓
- **WorldClim / Köppen data source reachable** — public domain climate data, one-time download. Confirmed available but not yet evaluated for licensing / format friction.
- **NOAA GFS public API reachable from Railway** — the GFS server is free, no API key required; rate limits exist but are lenient for session-start-only use. To be confirmed during planning.

## Outstanding Questions

### Resolve Before Planning

- None.

### Deferred to Planning

- [Affects R1][Needs research] What's the right public source for Köppen climate data at H3-res-2 granularity? WorldClim bio-climatic variables are ~1km raster and easy to resample, but might be overkill. Planning should sample a couple of sources and choose.
- [Affects R1][Needs research] Same for elevation — GEBCO vs SRTM vs a smaller dataset sufficient for res-2 average elevation.
- [Affects R2][Technical] Exact distribution format for the stats-only layer — per-Köppen-zone per-month histograms vs normal/log-normal parameters. Planning should pick based on the climate data format.
- [Affects R3][Needs research] NOAA GFS access path — direct HTTP from the NOMADS server vs a Python intermediary. Stay all-TS if possible.
- [Affects R3][Technical] Forecast cache storage shape — JSON blob per session vs a proper `weather_session_cache` table. Planning to decide based on how many simultaneous sessions we expect.
- [Affects R4][Technical] Prose generation — pre-seeded library of ~50 short lines rotated deterministically by `(biome, state-bucket)` vs Haiku calls with template cache. Both are pre-authorized; planning picks based on prose-quality testing.
- [Affects R5][Technical] Journey map update mechanism for the banner — SSE vs polling vs page-reload-on-session-advance. Existing infrastructure decides.
- [Affects R6][Technical] Regex + NER-based place filter vs a curated denylist of NOAA station IDs. Probably both.
- [Affects R3] Pentagon/void hex behavior for party hex — should never happen in practice (party lives on land) but should fail gracefully to stats-only if it does.

## Next Steps

→ `/ce:plan` for structured implementation planning.

**Before planning, add the follow-up items to the roadmap:**
- v12: "Weather → NPC schedule consequence — professions react to hex weather (smith closes on storm, caravan delays, etc.)"
- v15: "Rare anomaly layer — SWPC aurora + solar flares + eclipses + supermoons as in-fiction global events"
- v15 or v16: "Continent-coherent storm translation — project live GFS onto CW continents per-continent with rotation and EMA smoothing, enabling live weather for non-party hexes"
