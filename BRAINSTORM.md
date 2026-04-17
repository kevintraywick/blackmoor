# Brainstorm — Common World architecture

Working notes from the 2026-04-17 sessions. Not a plan, not a decision log — raw thoughts piled up to sift through later. When something here hardens into a decision it moves to `docs/plans/` or `DESIGN.md`.

Sections are numbered for easy reference. New numbers go at the end; existing numbers are stable so cross-references stay valid.

---

## 1. The shape of the thing — two layers

- **Campaign layer.** DM + player tools, scoped to one game. Player sheets, journal, session management, marketplace. This is what Shadow of the Wolf already is.
- **World layer.** Shared canon + living narrative, written by the World AI, read by all campaigns.
- The world layer is really three things fused: a **map** (hexes, terrain), a **living population** (NPCs, armies, caravans, storms), and a **canon record** (what happened, when, with what trust).
- A campaign is a *lens* onto the world. The world doesn't know about campaigns; campaigns subscribe.
- **Pocket mode** is worth preserving as a flag: a DM can opt a campaign out of Common and run a private world. Same schema. Hedge against DMs who don't want their canon touched.

## 2. The World AI as orchestrator, not singleton

- It's a conductor, not a brain. Weather agent, army agent, NPC-schedule agent, rumor agent — each with narrow scope, cheap model, own cadence.
- Orchestrator's job: budget + tempo + arbitration (two agents want to move the same NPC).
- An "agent" = a small durable process with its own memory, prompts, and tick rate.
- Haiku for cheap triage ("does anything need to happen in hex H this tick?") → Sonnet for actual narrative beats.
- DM is always author of record. World AI proposes; DM curates; only curated content publishes.

## 3. NPC layers — three tiers

Not all NPCs are equal. The system should stratify them because the cost, storage, and LLM-interaction shape differ wildly per layer.

- **Layer A — Ambient / Loop NPCs.** The baker. The smith. The dock-worker. Schedule-driven, positional. *Only value: proximity triggers.* When a player passes one, there's a chance of an overheard snippet, a greeting, a bit of color. Mostly math + small LLM flavor on encounter. Cheap.
- **Layer B — Mechanic NPCs.** Town criers, merchants, innkeepers, stable-masters, Raven Post vendors. These *do things* — they sell, they announce, they serve food, they hold purses. Each has a transactional surface the system implements.
- **Layer C — Hero NPCs.** Mentors, named lords, recurring allies/antagonists, faction leaders. Long memory, rich backstory, motivations, relationships. Full agent treatment — own goals, own agenda, own thread in the world's narrative. Expensive. Later down the road but will come.

Schema implication: probably one `npcs` table with a `tier` column (A/B/C), but the agent-loop runs different code paths per tier. Tier A is a cron; Tier C is a conversation.

## 4. Cross-campaign collisions — the heart of the pitch

- **Permissive canon edits.** Campaign A *can* burn a town to the ground without chronicler approval. Canon mutates. Chronicler can later undo or negotiate an outcome if they feel it's necessary. Ship first, arbitrate second. This matches how real collaborative fiction works.
- **Simultaneity is a feature, not a bug.** Two campaigns in the same location at the same in-fiction time is THE moment Blackmoor is built for. Two DMs cross paths because their maps organically grew into each other. This is where DMs find each other, share notes, potentially run crossover sessions. *This is the whole point of Common World.*
- **Maps expand.** Campaigns march over new terrain. Every session pushes the edges out. Collision isn't an edge case — it's the natural result of two DMs playing long enough.
- The system should **surface collisions proactively**. When two campaigns' explored hexes overlap (even without simultaneity), notify both DMs. "Hey, [@thewolf] — DM [@nightwright] is working adjacent to you. Want to compare notes?"
- Canon-lock-at-reference-≥-2 still applies for *invented* entities (Seraphax the dragon, the Iron League), but *destruction* and *state mutation* are immediate and reversible.

## 5. Time — the Common Year

- Every campaign has its own in-fiction clock. The world has **one Common Year**.
- **Years apart is fine.** Campaigns offset by years don't conflict — the older one becomes the history of the newer one. Reading Campaign A's journal is literally reading history books from Campaign B's perspective.
- **Close-in-time is where we adjudicate.** If two campaigns are within a year or two of each other and in the same region, one gets **brought forward** to the later campaign's clock. Restriction of Blackmoor's early days; acceptable cost.
- **Bringing forward ≠ losing content.** The "behind" campaign's past sessions still happened; the system just moves their *present* forward to sync. Think of it as a time-skip between sessions rather than a rewrite.
- **The world itself has a Common Year clock.** It advances with the frontier (most-advanced campaign in a region), not any individual DM's clock. Slower-moving campaigns "catch up" when they arrive.
- *Possible later knob:* let DMs opt into a "Historical" mode — deliberately running in the past of the Common Year, with read-only access to future world state as "prophecy."

## 6. Content pipeline is agentic end-to-end

- DM publishes headline → World AI proposes follow-up beats → DM curates → publishes → world state mutates → other campaigns' Raven Post feeds pick it up → players react in-fiction → those DMs pick up threads.
- This is a **Rumor Engine**, not a CMS.

---

## 7. H3 hex system

- Uber's open-source hex grid. 16 resolutions (0–15). Aperture-7 parent/child — one res-5 cell contains exactly 7 res-6 cells, recursively.
- Variable resolution is native. Higher res where campaigns are, coarser elsewhere. No stitching logic.
- Classic 6-mile D&D hex ≈ H3 res 6 (~36 km² each). Building-scale ≈ res 10. The whole canonical-scale ladder fits inside res 4–10 with room to spare.
- `k-ring` queries ("what's within N hexes of me?") are O(1) and pre-indexed. Free proximity + visibility queries.
- Cell IDs are 64-bit uints. Clean PKs, compact indexes, no UUID sprawl.
- Aggregation is free — weather at res-7 rolls up to res-5 by averaging 7 children. Same for population density, danger, MP reserves, whatever.
- Libraries: `h3-js` (Node), `h3` Postgres extension.
- **Decision tilt: adopt H3 before v5.** Retrofitting later would hurt. Simplifies v5–v7 plumbing: `campaign_id + h3_cell + resolution` becomes the natural shape of any scoped, spatial row.

## 8. Proximity constraint for new DMs

- New DM's claim must be within `k-ring(N)` of an existing claim. `N=1` = adjacent; `N=3` = a few days' travel.
- Forces overlap. Lone-wolf claims in empty territory are sterile — collisions are what make a world feel populated.
- Natural growth rings: dense core, expanding frontier. Looks like real settlement patterns.
- Escape valve: Cartographer/Chronicler tiers can seed remote claims (new continent, new island). Stops everyone piling onto one hex.

## 9. Earth as physics engine, not setting

The tension: fantasy's purpose is escape from the real world. But real-world data would make the world cheaper and richer.

**Resolution: borrow Earth's *rules*; invent Earth's *furniture*.**

Worth grabbing:
- **Coastlines + elevation** (GEBCO + SRTM). ~70% of a realistic world for free. Still name/place everything; don't hand-draw where the ocean is.
- **Day/night + moon phase + solstices/equinoxes/eclipses.** Cosmic, not local. Naturally magical. Already in the v12 plan.
- **Climate zones (Köppen).** Desert/temperate/tundra as a computed property of lat + elevation. NPC schedules, crop calendars, weather tables get realism for free.
- **Live weather (NOAA GFS).** Run real pressure systems as a simulator for in-fiction weather at remapped hex centers. Real hurricanes become in-fiction storms with real trajectories — but never named.
- **Prevailing winds + ocean currents.** Caravan + armada speeds become physics, not vibes. *(Critical for airship trade — see §12.)*
- **Aurora / solar-flare (NOAA SWPC).** Rare, real, fiction writes itself: "the sky danced last night."

Probably traps: Real place names. Real political borders. Real current disasters (wildfires, earthquakes — ethically queasy, jarring). Named real storms. Coastlines too recognizable (Italy's boot, Florida's finger) unless thoroughly scrambled.

**The laundering rule — stronger version.** Don't just rotate + mirror. *Remap* Earth regions to arbitrary Common World hex-atlas locations. Take a region's **data** (coastline shape, elevation profile, climate, prevailing wind vectors, seasonal weather) and teleport it to a different part of the Common World's grid. Sahara's climate lands on a hex cluster far from its real lat/lng. Scotland's highlands become part of a continent that doesn't exist on Earth. Physics-true, identity-stripped. Common World has its own geography, its own latitudes, its own seasons — which happen to look real because they are, underneath, real data just wearing a different face.

This also lets us **curate which regions to use**. We pick the most compelling real-world geographies (dramatic fjords, bone-white desert mesas, cloud-forest escarpments) and place them where they make narrative sense, ignoring the boring stuff. The world ends up more interesting than Earth, not less.

## 10. The twelve pentagons → astral voids

H3's icosahedral projection leaves 12 cells as pentagons rather than hexes. Cells near them distort slightly. Canon the quirk:

- **Navigable hazards.** Caravans + armadas route around them. A storm agent whose path crosses a void disperses or reappears elsewhere. Routing agents consult a map, not just geometry.
- **Cosmologically load-bearing.** Twelve is a great D&D number: twelve gods, twelve moons, twelve hells, twelve lost kingdoms, twelve Great Houses. Each pins to a void. Free cosmology.
- **Narrative event sinks.** Things that don't fit anywhere else — a lost city, a sunken god, a prison-for-a-dragon — get assigned to a void. World AI can propose beats about "the void near the west" without picking a real location.
- **Opt-in endgame content.** Approaching a void at low level should feel wrong. Gives the world a "here be dragons" edge without making the rest scary.
- **Real-world-to-fantasy laundering.** Real locations that happen to fall on pentagon cells disappear cleanly (on top of the §9 remap).
- **Twelve shared artifacts.** One legendary item per void — every campaign knows of them, none has them. Recovery is a multi-campaign affair. Canon-lock on reference ≥ 2 is built for this.
- **Mapping constraint satisfied.** "Don't claim a pentagon hex" becomes "you can't claim a void" in-fiction — DMs will want to write toward them, not live in them.
- **Natural variety.** 12 pentagons fall where they fall on the sphere — some ocean, some land, some coast. Gives 12 genuinely different void-sites (maelstroms, drowned cities, desert tears in the sky) without authoring. Geometry writes for us.

---

## 11. Factions & competition — the usual suspects plus one

The world has standing interest groups with their own agendas. Each is a candidate for its own Tier-C agent (see §3) with long-horizon goals. They *push* events into the world rather than just reacting.

**Standard set:**
- **Thieves' Guild(s)** — criminal, regional, fragmented. Multiple rival guilds per continent. Agenda: wealth, information, protection rackets. Canonical D&D trope, stays.
- **Assassins' Orders** — more disciplined than thieves. Faction-spawned (a house retains an order), mercenary (coin takes the job), or zealot (religious). Rarer than thieves, scarier.
- **Merchants' Leagues** — cross-border, interest-based. Trade routes, tariffs, lobbying, legal muscle. Arguably more powerful than any single crown.
- **Royalty.** Avoid "Kings" as a default term — feels generic and gendered. Worth reviewing D&D royalty canon (Forgotten Realms, Eberron, Greyhawk) for better terminology: **Houses, Holds, Reaches, Thrones, Marches, Dominions, Principalities, Archons, Suzerains**. Pick 3-5 that feel right and let DMs choose.
- **Religious Orders** — pantheon-tied, hierarchical. Their agenda is pilgrimage routes, relic recovery, heresy-hunting, and doctrinal conflict with other orders.

**New addition Kevin called for: Steampunk magic-engineering.** See §12.

Each faction should have:
- A **home hex** (or multiple, for multi-polar factions like merchants' leagues).
- **Territory of interest** (k-ring around home, plus any extended claims).
- **Current agenda** (updated by their agent on tick).
- **Relationships** with other factions (alliance, rivalry, neutrality) — modeled as a graph.
- **Visible surface** — what players can *see* of them (guild halls, merchant stalls, royal decrees, faction colors on NPCs).

## 12. Steampunk & the airship trade

Not pure high-fantasy — **Common World has a steampunk register**, focused on air trade rather than ground industrial revolution. Core mechanics:

- **Airships are the primary long-distance trade vehicle.** Fast, can cross voids (but shouldn't), expensive to operate.
- **Magic engines, not coal engines.** Steam is generated by **burning MP** — the airship is effectively a vessel (see §13) with a continuous slow discharge powering a propulsion system. No coal, no smokestacks in the ugly sense.
- **Air currents matter.** Real jet-stream data (§9) becomes the grid airships navigate. There are trade winds, doldrums, and storm fronts. Airship captains are as skilled as ship captains.
- **Infrastructure:** airship yards (shipbuilding), sky-docks (loading/unloading at elevation), refueling stations (MP depots), charting guilds (route expertise).
- **Aesthetic:** brass, riveted hulls, canvas gas envelopes, leather harnesses. Mages in goggles. Navigators with sextants calibrated to the moon's phase.
- **In-fiction tension:** airships are a *merchant's tool*, which tilts power toward the merchants' league. Crowns want them; orders don't always approve. Pirates of the air — absolutely yes.
- **Player-facing:** a party can book passage on an airship as a fast-travel option (with expense). Later: own an airship.

This is compatible with the rest of the fantasy register — sword-and-shield adventurers still exist, druids still commune with forests. Airships are a *technology layer* on top of the medieval register, not a replacement for it. Think Arcanum or Final Fantasy VI more than Bioshock Infinite.

## 13. Magic system — MP as a containable currency

**The core idea:** magic is a measurable, transferable resource. Called MP (magic points), modeled analogously to gold and HP but with containment rules.

### Containment — who can hold MP?

Three categories:

- **Natural holders.** Classes/races with innate magical affinity carry MP in their own body up to a cap. Druids, sorcerers, bards, clerics. Cap scales with level (e.g., `5 × level` MP for a druid). Beyond the cap, they need a vessel like anyone else.
- **Channelers.** Wizards, warlocks, artificers — can *use* MP but not *hold* it in body. They must draw from a vessel at the moment of casting.
- **Mundane.** Fighters, rogues, peasants. Can carry vessels but can't expend MP themselves. Can sell, trade, gift. Needs a magic-using companion (or an enchanted item that expends on a trigger) to actually cast.

### Vessels — where MP lives

Vessels have three properties: **capacity**, **recharge rate**, **volatility**.

- **Scrolls** — single-use. Consume the vessel on cast. Cheap, disposable.
- **Wands** — low capacity, fast recharge. Common.
- **Staves** — high capacity, slow recharge. Mage's daily driver.
- **Crystals / gems** — passive storage. No recharge on their own; refilled at nodes or by hand.
- **Enchanted items** — bespoke. A flame-blade that burns MP to flame on strike. A healing amulet that discharges on wound.
- **Tattoos / runes** — bound to flesh. Can't be stolen, can be extracted (painful, lore-rich). Rare.

Volatility: an overcharged vessel explodes. An uncontained MP transfer to a non-affinity holder burns or causes a wild-magic surge.

### Recharge mechanisms

This is where the world layer does real narrative work:

- **Ley lines.** Certain hexes are MP-rich. Sitting in them recharges vessels + natural holders. Ley-rich hexes are **world-level state** (per §7, stored at H3 cell level), not campaign-level. This makes MP supply a *geographic resource*.
- **Moon phases.** Full moon = faster recharge (reuses Earth moon data from §9). New moon = slowest. Eclipses = surge or drain, narratively potent.
- **Rituals.** Cast at specific places (standing stones, sacred springs, shrine-hexes) for a ritual recharge. Requires time + component cost.
- **Creature sources.** Kill a magical beast, drink its blood/use its essence. Gruesome but canonical D&D.
- **Time.** Slow ambient recharge, accelerated by rest. ~1 MP/hour for a natural holder, 0 for most vessels.

### Player-facing implementation

Add **MP** to the player sheet as a counter alongside HP and gold. Show:
- Natural capacity (if any) + current held.
- List of vessels with capacity / current / recharge state.
- Quick-cast: select vessel → see what spells it can fuel.

### Economic implications

MP has a **market price**. A filled scroll costs X gp. A wand with 20 MP costs more than an empty wand + 20 MP separately (artisan markup). This sets up §14.

### Open bits to think through later

- Exchange rates between MP and gold (region-dependent — see §14).
- Whether MP is *conserved* (fixed world supply) or *generated* (renewable per tick).
- Wild magic — what happens when MP goes wrong. Reuse 5e surge tables as a starting point.
- How artificers build engines (see §12).

## 14. Dual economy — gold and MP

Two economies running in parallel, each with its own merchants, taxes, banks, and markets. They interchange but are not fungible.

### The monetary economy (already modeled)

- gp / sp / cp. Standard D&D. In place on player sheets, marketplace, inventory card prices.
- Goods and services in Common item price sheet (v11 on the roadmap).

### The magic economy (new)

- MP priced as a commodity. **A filled vessel's MP content has a gp-equivalent price**, but MP itself also trades directly in magic-aware transactions.
- **Prices vary by geography.** A ley-rich region (high local supply) has cheap MP. A ley-poor region needs MP imported — by airship or caravan — so it's expensive. This creates trade routes naturally.
- **Magic merchants.** A subset of merchants specialize in vessels and MP. They're their own sub-faction within the merchants' league (§11).
- **Magic banks.** Guildhouse-run storage with interest. Leave your staff there, come back with it fuller. Loans against vessels are a thing.
- **MP taxation.** Religious orders collect tithes in MP, not gold. Crowns tax gold. This creates regional power balances — ley-rich regions have lots of MP but may be under religious rather than royal influence.
- **Black market for MP.** Stolen vessels. Extracted tattoos. The Thieves' Guild loves this.
- **Refining.** Raw MP (straight from a ley spring) is "unrefined" and volatile. Refined MP is stable, portable, marketable. Artisan step adds markup.

### The interchange rule

- **Exchange rate** is a **per-hex property**, updated by the world AI on economic ticks. E.g., "in the capital, 1 MP = 3 gp; on the northern frontier, 1 MP = 15 gp."
- Rates fluctuate based on: proximity to ley hexes, trade route disruptions, faction events, seasonal magic (moon phase can shift rates 10-20%).
- Players can arbitrage. Airship captains *are* arbitrageurs.

### Schema sketch

- `mp_reserves` per hex (ambient supply at that H3 cell).
- `mp_prices` per hex (current gp-per-MP).
- `vessels` table (owner_id, type, capacity, current_mp, recharge_rate, condition).
- Player sheet gains `natural_mp_cap`, `natural_mp_current`.
- NPCs can own vessels; merchants' inventories can include them.

### Why two economies, not one

- **Narrative layering.** Gold is the mundane world; MP is the arcane world. Characters move between them in roleplay.
- **Player specialization.** Non-magic builds (fighters, rogues) live mostly in gold. Mages live in both. Creates economic interdependence — parties need both.
- **World dynamism.** A ley-line depletion event (Campaign A's doing) ripples through the MP market for everyone. Gold unaffected. Makes world-shared state *felt* at the table.
- **Anti-grind.** A single currency gets hoarded. Two currencies with asymmetric scarcity create real trading decisions.

---

## 15. Practical knobs

- **Resolution tiers per DM class.** Newbies claim at res-7 (village/town cluster). Cartographers at res-5 (regions). World AI operates at res-4+ (nations, continents). Scope of authority legible.
- **k-ring claim rule.** Claim must be within k=N of an existing claim. Tune N over time to control sprawl.
- **Fog of world.** Start with one continent revealed; unrevealed hexes are "beyond known charts." New continents get discovered, not claimed from day one.
- **Per-world Earth-region remap.** Arbitrary source-to-target hex mapping (see §9 stronger laundering rule).

## 16. Unexpected unlocks

- **Real-time weather as a subscription, not a system.** Don't build a weather agent that invents storms — subscribe to NOAA at remapped hex centers and use what's happening. Weather becomes live data, not generated content. Cheaper, richer, more surprising.
- **AR globalizes.** If hexes have real lat/lng, the existing AR encounter pattern (player within 100m of Citadel Tree → SMS) generalizes planet-wide. Player in Tokyo on their claimed hex gets a different overheard than one in Nashville. The Raven Post Library mechanic becomes a planetary mechanic without rewriting anything.
- **Mappy gets grounded.** If Mappy knows the lat/lng of a local map's parent H3 cell, it can sanity-check scale against real-world dimensions of that place.
- **Ley + weather data combine.** Moon phase affects MP recharge AND weather simulation runs in the same tick. Magic and physics share the same clock.

---

## 17. Flagged but not dived into

- **Trust tiers** (Official / Whispered / Rumored / Prophesied). Huge design space. Medium implies trust, but *who* reports it matters too.
- **Moderation / three-strikes** for player comments. Outside v1 scope; surface will attract trolls.
- **Crossover sessions.** Bilateral handshake, joint initiative, dual-journal writes. Already on the ladder (v15).
- **Creative destruction** (DCs, build-effort symmetry). Feels like a different kind of agent — a physics agent.
- **D&D royalty canon research.** Pick the right terminology for Houses/Holds/Reaches/etc. (§11).
- **Wild magic surges** — reuse 5e surge tables, add world-consequence variants (§13).
- **Airship ownership / operation** as a player path (§12).
- **MP conservation vs generation** (§13 open bit).

---

## 18. Meta — sequencing into the roadmap

**Ladder renumbered 2026-04-18.** H3 adoption is now **v4**; everything v4+ shifted up one. See `ROADMAP.md` for the authoritative list.

Start with **plumbing** (v6–v8): DM identity, `campaigns` table, `campaign_id` on every scoped row, `/dm/[slug]/*` routes. Without this, the World AI has nowhere to write.

H3 adoption is **v4**, before DM identity — spatial keys baked in before the identity refactor. Retrofitting after would hurt.

Rough mapping of themes to roadmap versions (post-renumber):

| Theme | Version(s) |
|-------|------------|
| **H3 adoption** | **v4** (new) |
| DM identity | v6 |
| Multi-tenancy refactor | v7 |
| The flip (campaign_id NOT NULL, slug routes) | v8 |
| Read-only Common canvas | v9 |
| Claim mechanic + proximity rule | v10 (add `k-ring(N)` constraint) |
| Content lifecycle | v11 |
| NPC Layer A (ambient loops) | v12 (with world entities) |
| Factions — data model | v12 (entities layer) |
| Economy v1 — monetary | v12 (already planned as treasury/upkeep) |
| **Economy v2 — MP as currency** | **v12 or new v12.5** (slots alongside treasury work) |
| **Magic system — vessels, containment** | **v12 or new v12.5** (pairs with MP economy) |
| **Ley-line hex state** | v12 (geographic MP supply) |
| Raven Post propagation | v13 |
| Real-world data feeds (weather, moon, solar) | v13 |
| Earth-region remap | v13 (or dedicated version for cartography) |
| **Steampunk / airships** | **v14 or later** — requires MP economy + world trade routes |
| Creative destruction | v14 |
| Moderated comments | v15 |
| Crossover sessions + simultaneity tools | v16 (add overlap-notification surface) |
| NPC Layer B (mechanic NPCs) | v12–v14 spread |
| NPC Layer C (hero NPCs) | v18+ (portfolio / long agents) |

Proposed new ladder items to insert later:
- **v12.5 — Magic economy + vessels.** MP on player sheet, vessels table, ley-line hex state, per-hex MP pricing.
- **v14 (extend) — Airship trade infrastructure.** Airship yards as world entities, trade routes as lines on the map, passage-booking as a player flow.
- **v12 (extend) — Cross-campaign overlap detection + notification.** When two campaigns' explored hexes intersect, surface it to both DMs.

## 19. What to discuss next session

1. Should the magic economy slot into v12 or merit its own v12.5? (Leaning v12.5 — it's big enough.)
2. Naming the twelve voids — do we seed them in v9 or leave them blank for DMs to name through canon-lock?
3. Royalty terminology — research pass, then pick 3-5 default terms.
4. Walk through the v6–v8 plan one more time with this richer context and see if anything in the data model needs to change (note: `docs/plans/2026-04-11-003-feat-common-v3-multitenancy-plan.md` predates the renumber — its "v3/v4" internal references mean the old Common-ladder numbers, i.e. current v7/v8).
5. ~~Local map coordinates — hex vs square~~ **Decided 2026-04-18: square at the local level (see §20).**

## 20. Local map coordinates — decision

**Decided: local maps stay square. H3 lives at the world layer only.**

Rationale:
- 5e's entire combat math assumes squares (spell areas, weapon reach, flanking, AoE templates, diagonal movement). Forcing hex at the local level breaks 20 years of DM + player muscle memory.
- The map-art ecosystem (Dyson Logos, Mike Schley, Patreon creators, Roll20/Foundry assets) ships on square grids. DM submissions would be a constant conversion friction.
- No clean algorithmic path from a submitted square map to a playable hex map — each of the four approaches (overlay, 1:1 remap, image reprojection, fine hex substrate) has a deal-breaker.
- The coordinate-consistency benefit of H3 is internal, not user-facing. Each local map records an **H3 anchor cell** at the world layer (which world hex this local map sits in) + its own internal grid. Inside, coords stay (x, y) cells at whatever grid type the DM chose.

What this means for Mappy:
- Mappy detects the submitted grid as it does today (Square / Hex / None).
- Mappy does **not** attempt any square → hex conversion.
- Mappy adds one new responsibility later: assign or confirm the H3 anchor cell when the DM places a local map on the world grid (that's already on the roadmap as "World hex picker — place local maps on the world grid").

Hex local maps remain supported — old-school DMs who submit hex-gridded art keep the existing "Hex" option in the Grid Confirmation Panel, using axial/offset hex math internally (not H3 — H3 doesn't tile a finite rectangular map cleanly). Those DMs self-select; no forcing either way.
