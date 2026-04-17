# Brainstorm — Common World architecture

Working notes from the 2026-04-17 session. Not a plan, not a decision log — raw thoughts piled up to sift through later. When something here hardens into a decision it moves to `docs/plans/` or `DESIGN.md`.

---

## The shape of the thing — two layers

- **Campaign layer.** DM + player tools, scoped to one game. Player sheets, journal, session management, marketplace. This is what Shadow of the Wolf already is.
- **World layer.** Shared canon + living narrative, written by the World AI, read by all campaigns.
- The world layer is really three things fused: a **map** (hexes, terrain), a **living population** (NPCs, armies, caravans, storms), and a **canon record** (what happened, when, with what trust).
- A campaign is a *lens* onto the world. The world doesn't know about campaigns; campaigns subscribe.
- **Pocket mode** is worth preserving as a flag: a DM can opt a campaign out of Common and run a private world. Same schema. Hedge against DMs who don't want their canon touched.

## The World AI as orchestrator, not singleton

- It's a conductor, not a brain. Weather agent, army agent, NPC-schedule agent, rumor agent — each with narrow scope, cheap model, own cadence.
- Orchestrator's job: budget + tempo + arbitration (two agents want to move the same NPC).
- An "agent" = a small durable process with its own memory, prompts, and tick rate.
- Haiku for cheap triage ("does anything need to happen in hex H this tick?") → Sonnet for actual narrative beats.
- DM is always author of record. World AI proposes; DM curates; only curated content publishes.

## NPC loops — the baker pattern

- Probably **data-first, LLM-garnished**. A schedule table (`npc_id, hex_from, hex_to, depart_hour, arrive_hour, activity`) is cheap and deterministic.
- The *loop* is hand-authored (or AI-seeded). The *garnish* (what the baker's doing when encountered) is LLM-generated on query.
- Players don't poll NPC positions — the world answers "who's at hex H at time T?" on demand. Schedule → position is math.
- Events (bakery fire!) override loops. Loops resume when the override clears.
- Loops are a **pattern**, not an NPC feature. Caravan loops, patrol loops, trade-route loops, pilgrimage loops all share the shape.

## Cross-campaign collisions — the interesting part

- If Campaign A burns a town to the ground and it becomes canon, Campaign B sees ruins next session. **This is the pitch.**
- Canon-locking at reference-count ≥ 2 exists because single-DM assertions can't unilaterally bind the world.
- Destruction equivalent: does Campaign A burning a town lock on their say-so alone, or does it need chronicler approval? (Probably chronicler, given stakes.)
- **Simultaneity is fiction.** Two campaigns can't both "be in the town" at the same in-fiction moment unless they crossover-session. The world timestamp resolves this.
- Proximity constraint (see H3 notes) means NPC/narrative overlap between campaigns becomes automatic, not a feature we have to build.

## Time is the hardest part

- Every campaign has its own clock. The world has one clock. They drift.
- Possible rule: world clock advances to the **frontier** of the most-advanced campaign. Other campaigns experience it as "catching up" — when they arrive at the burned town, it's been burned for months.
- This means the world has a **present** but each campaign has a **lagging present**.
- Tick cadence still unresolved — does the world advance on any DM's game-clock advance, or a world-level clock (real time? cron? DM "advance the world" button)? All three are viable; pick per-feature.

## Content pipeline is agentic end-to-end

- DM publishes headline → World AI proposes follow-up beats → DM curates → publishes → world state mutates → other campaigns' Raven Post feeds pick it up → players react in-fiction → those DMs pick up threads.
- This is a **Rumor Engine**, not a CMS.

---

## H3 hex system

- Uber's open-source hex grid. 16 resolutions (0–15). Aperture-7 parent/child — one res-5 cell contains exactly 7 res-6 cells, recursively.
- Variable resolution is native. Higher res where campaigns are, coarser elsewhere. No stitching logic.
- Classic 6-mile D&D hex ≈ H3 res 6 (~36 km² each). Building-scale ≈ res 10. The whole canonical-scale ladder fits inside res 4–10 with room to spare.
- `k-ring` queries ("what's within N hexes of me?") are O(1) and pre-indexed. Free proximity + visibility queries.
- Cell IDs are 64-bit uints. Clean PKs, compact indexes, no UUID sprawl.
- Aggregation is free — weather at res-7 rolls up to res-5 by averaging 7 children. Same for population density, danger, whatever.
- Libraries: `h3-js` (Node), `h3` Postgres extension.
- **Decision tilt: adopt H3 before v5.** Retrofitting later would hurt. Simplifies v5–v7 plumbing: `campaign_id + h3_cell + resolution` becomes the natural shape of any scoped, spatial row.

## Proximity constraint for new DMs

- New DM's claim must be within `k-ring(N)` of an existing claim. `N=1` = adjacent; `N=3` = a few days' travel.
- Forces overlap. Lone-wolf claims in empty territory are sterile — collisions are what make a world feel populated.
- Natural growth rings: dense core, expanding frontier. Looks like real settlement patterns.
- Escape valve: Cartographer/Chronicler tiers can seed remote claims (new continent, new island). Stops everyone piling onto one hex.

## Earth as physics engine, not setting

The tension: fantasy's purpose is escape from the real world. But real-world data would make the world cheaper and richer.

**Resolution: borrow Earth's *rules*; invent Earth's *furniture*.**

Worth grabbing:
- **Coastlines + elevation** (GEBCO + SRTM). ~70% of a realistic world for free. Still name/place everything; don't hand-draw where the ocean is.
- **Day/night + moon phase + solstices/equinoxes/eclipses.** Cosmic, not local. Naturally magical. Already in the v12 plan.
- **Climate zones (Köppen).** Desert/temperate/tundra as a computed property of lat + elevation. NPC schedules, crop calendars, weather tables get realism for free.
- **Live weather (NOAA GFS).** Run real pressure systems as a simulator for in-fiction weather at transformed hex centers. Real hurricanes become in-fiction storms with real trajectories — but never named.
- **Prevailing winds + ocean currents.** Caravan + armada speeds become physics, not vibes.
- **Aurora / solar-flare (NOAA SWPC).** Rare, real, fiction writes itself: "the sky danced last night."

Probably traps:
- Real place names. Real political borders. Real current disasters (wildfires, earthquakes — ethically queasy, jarring). Named real storms. Coastlines too recognizable (Italy's boot, Florida's finger) — rotate/mirror them.

**The laundering rule.** Strip geographic identity on ingest. Per-world rotation + mirror + optional hex-ID shuffle. Every DM sits on a transformed Earth. Patterns feel real — coastlines where coastlines belong, deserts at right latitudes, monsoons where they should land — but nobody can point and say "that's France."

## The twelve pentagons → astral voids

H3's icosahedral projection leaves 12 cells as pentagons rather than hexes. Cells near them distort slightly. Canon the quirk:

- **Navigable hazards.** Caravans + armadas route around them. A storm agent whose path crosses a void disperses or reappears elsewhere. Routing agents consult a map, not just geometry.
- **Cosmologically load-bearing.** Twelve is a great D&D number: twelve gods, twelve moons, twelve hells, twelve lost kingdoms, twelve Great Houses. Each pins to a void. Free cosmology.
- **Narrative event sinks.** Things that don't fit anywhere else — a lost city, a sunken god, a prison-for-a-dragon — get assigned to a void. World AI can propose beats about "the void near the west" without picking a real location.
- **Opt-in endgame content.** Approaching a void at low level should feel wrong. Gives the world a "here be dragons" edge without making the rest scary.
- **Real-world-to-fantasy laundering.** Real locations that happen to fall on pentagon cells disappear cleanly.
- **Twelve shared artifacts.** One legendary item per void — every campaign knows of them, none has them. Recovery is a multi-campaign affair. Canon-lock on reference ≥ 2 is built for this.
- **Mapping constraint satisfied.** "Don't claim a pentagon hex" becomes "you can't claim a void" in-fiction — DMs will want to write toward them, not live in them.
- **Natural variety.** 12 pentagons fall where they fall on the sphere — some ocean, some land, some coast. Gives 12 genuinely different void-sites (maelstroms, drowned cities, desert tears in the sky) without authoring. Geometry writes for us.

---

## Practical knobs

- **Resolution tiers per DM class.** Newbies claim at res-7 (village/town cluster). Cartographers at res-5 (regions). World AI operates at res-4+ (nations, continents). Scope of authority legible.
- **k-ring claim rule.** Claim must be within k=N of an existing claim. Tune N over time to control sprawl.
- **Fog of world.** Start with one continent revealed; unrevealed hexes are "beyond known charts." New continents get discovered, not claimed from day one.
- **Per-world rotation + mirror.** Earth transformed differently per deployment (or per world, if we ever run more than one).

## Unexpected unlocks

- **Real-time weather as a subscription, not a system.** Don't build a weather agent that invents storms — subscribe to NOAA at transformed hex centers and use what's happening. Weather becomes live data, not generated content. Cheaper, richer, more surprising.
- **AR globalizes.** If hexes have real lat/lng, the existing AR encounter pattern (player within 100m of Citadel Tree → SMS) generalizes planet-wide. Player in Tokyo on their claimed hex gets a different overheard than one in Nashville. The Raven Post Library mechanic becomes a planetary mechanic without rewriting anything.
- **Mappy gets grounded.** If Mappy knows the lat/lng of a local map's parent H3 cell, it can sanity-check scale against real-world dimensions of that place.

---

## Flagged but not dived into

- **Trust tiers** (Official / Whispered / Rumored / Prophesied). Huge design space. Medium implies trust, but *who* reports it matters too.
- **Reputation & factions as world entities** with their own agents (the Thieves' Guild has an agenda; it pushes events).
- **Economy** (treasury, upkeep, prices that travel with trust-degradation by distance). Sleeping dragon — probably its own v.
- **Creative destruction** (DCs, build-effort symmetry). Feels like a different kind of agent — a physics agent.
- **Moderation / three-strikes** for player comments. Outside v1 scope; surface will attract trolls.
- **Crossover sessions.** Bilateral handshake, joint initiative, dual-journal writes. Already on the ladder (v15).

---

## Meta

- Start with **plumbing** (v5–v7): DM identity, `campaigns` table, `campaign_id` on every scoped row, `/dm/[slug]/*` routes. Without this, the World AI has nowhere to write.
- Adopt H3 *before* v5 so spatial keys are baked into the identity refactor from day one.
- v8 is the read-only canvas.
- v11 is when agents (armies, weather, caravans, NPC loops) start moving.
- Shape of the system (layered, agent-orchestrated, schedule-driven, canon-locked by reference) is worth sketching once before writing SQL.
