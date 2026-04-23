# Roadmap

The roadmap for **Common World** (the platform) and the campaigns running on it. Shadow of the Wolf is the flagship campaign. This file is parsed at build time and rendered at `/do`.

Each item is a checkbox list entry with a version tag. Tags look like `<!-- common-v4 -->`. Untagged items are ignored. Versions run v3 (spatial substrate, in flight) through v24 (planning horizon).

Status is read from the checkbox: `[x]` = built, `[ ]` = planned. Add `<!-- in-progress -->` to mark partial work. Note: this file is a snapshot — the DB (`roadmap_items` table) is the ground truth.

---

### Shipped

Archived 2026-04-16. Item rows live in the `roadmap_items` table and still render collapsed under each version's "completed" pill on `/do` when any active work remains in the version.

**Shadow one — the site itself.** Player sheets, inventory, HP, gold, DM journal, public journey log, NPC session management, Map Builder (world/local + canonical scale), inventory card builder, DM messages + whispers + boons, poison counter, initiative tracker, "Are You In?" availability page with quorum email, invitation system, nightly DB backup.

**Shadow two — polish + the living world.** Three vertical banner circles (compass, sun/moon phase, wind), Ajax in DM nav, mobile marketplace redesign, Raven Post World AI hardening, player-side Sendings pane.

### v3 — Spatial substrate (H3)

- [x] Add `h3-js` dependency and `lib/h3.ts` helpers (cell ↔ lat/lng, k-ring, parent/child, pentagon-cell lookup) <!-- common-v3 -->
- [x] Schema: nullable `h3_cell bigint` + `h3_res smallint` columns on spatial tables (world hexes, local maps, NPCs, AR encounters) <!-- common-v3 -->
- [x] World anchor: pick real lat/lng and H3 resolution for current Shadow world map <!-- common-v3 -->
- [x] Backfill: existing world-hex (col,row) coords → `h3_cell` at chosen resolution <!-- common-v3 -->
- [x] Dual-write: world-map writes populate `h3_cell` alongside legacy (col,row); reads remain on legacy path <!-- common-v3 -->
- [x] Mappy sanity-checks local-map scale against real-world dimensions at the H3 anchor cell <!-- common-v3 -->

### v4 — Map Builder

- [x] Merge feat/map-builder PR to main (editor, world map, local maps, canonical scale) <!-- common-v4 -->
- [ ] Mappy N-direction detection on uploaded maps <!-- common-v4 -->
- [ ] Mappy scale sanity check (flag grid vs AI discrepancy) <!-- common-v4 -->
- [ ] Builder canvas image rendering at canonical scale <!-- common-v4 -->
- [ ] Fog of war — player-facing world map with revealed hexes only <!-- common-v4 -->
- [ ] Player-facing local map view (read-only, inherits fog state) <!-- common-v4 -->
- [ ] Upload classification dialog — world addition vs local map <!-- common-v4 -->
- [x] World hex picker — place local maps on the world grid <!-- common-v4 -->
- [ ] Local map session event publishing (asset placed, map opened, party marker) <!-- common-v4 -->
- [ ] Seed world map refresh (the hand-painted canvas Common sits on) <!-- common-v4 -->
- [ ] World map party marker visible to players <!-- common-v4 -->
- [ ] Print mode for map builder <!-- common-v4 -->
- [x] Hand-painted 2D hex terrain tiles (Baumgart Basic Terrain Set, replacing KayKit 3D renders) <!-- common-v4 -->
- [x] Terrain painting mode on world map (paint mode, palette, Baumgart sprite rendering, cursor fix) <!-- common-v4 -->
- [ ] Three.js hex renderer for world map (3D tiles, elevation, lighting, water) <!-- common-v4 -->
- [ ] Scale reference tools (d6 anchor, ruler-in-image, template overlay) <!-- common-v4 -->
- [x] World — 3D globe at `/dm/globe-3d` (react-three-fiber, rotatable, res-1/res-2 swap, Shadow presence overlay, astral-void markers) <!-- common-v4 -->

### v5 — Housekeeping + ops

- [ ] `/do` roadmap page reading ROADMAP.md <!-- common-v5 --> <!-- in-progress -->
- [x] Copyright footer site-wide (© Grey Assassins Guild, LLC) <!-- common-v5 -->
- [ ] Backup cadence bumped to every 4 hours during refactor weeks <!-- common-v5 -->

### v6 — DM identity

- [ ] `dms` table with handle, email, chronicler_handle, tier <!-- common-v6 -->

### v7 — Campaign scoping (multi-tenancy)

- [ ] Dev DB provisioned on Railway <!-- common-v7 -->
- [ ] `campaigns` table with partial unique index on one-active-per-DM <!-- common-v7 -->
- [ ] `campaign_id` nullable columns on every scoped table <!-- common-v7 -->
- [ ] `getCampaignId()` helper in `lib/db.ts` <!-- common-v7 -->
- [ ] API route migration pass (reads) <!-- common-v7 -->
- [ ] API route migration pass (writes) <!-- common-v7 -->
- [ ] `lib/world.ts` + `lib/raven-post.ts` + `lib/world-ai-*.ts` rescoped <!-- common-v7 -->
- [ ] Shadow backfill — every existing row gets `shadow` campaign_id <!-- common-v7 -->

### v8 — Cutover — `campaign_id` NOT NULL

- [ ] `campaign_id` NOT NULL + foreign keys <!-- common-v8 -->
- [ ] Routes restructured: `/dm/*` → `/dm/[slug]/*` <!-- common-v8 -->
- [ ] `/dm` redirects to `/dm/[active-slug]` <!-- common-v8 -->
- [ ] Old singleton `campaign` table dropped <!-- common-v8 -->
- [ ] Full smoke test as @thewolf and as unauthenticated visitor <!-- common-v8 -->

### v9 — Read-only Common World

- [ ] `/common-world` browse page <!-- common-v9 -->
- [ ] `common_hexes` table <!-- common-v9 -->
- [ ] `common_entities` table <!-- common-v9 -->
- [ ] `common_clock` singleton <!-- common-v9 -->
- [ ] `/common-world/covenant` page with 7 rules <!-- common-v9 -->
- [ ] Content blacklist page (firearms, modern tech, etc.) <!-- common-v9 -->
- [ ] Seeded central region hand-painted via Map Builder <!-- common-v9 -->
- [ ] Seeded wilds via AI generation <!-- common-v9 -->
- [ ] Language overlay map <!-- common-v9 -->
- [ ] Seed the twelve astral voids at pentagon cells (named cosmological placeholders) <!-- common-v9 -->
- [ ] World-scale fog: unrevealed continents are "beyond known charts" until discovered <!-- common-v9 -->

### v10 — Claim + publish (contributor flow)

- [ ] 1-hex claim mechanic for newbies <!-- common-v10 -->
- [ ] 100-hex map-drop claim for map-bringers (Cartographer tier) <!-- common-v10 -->
- [ ] First-publish 48h queue for Cartographer tier <!-- common-v10 -->
- [ ] Chronicler queue dashboard <!-- common-v10 -->
- [ ] SMS approval via Twilio (10 min SLA target) <!-- common-v10 -->
- [ ] Author tracking: `author_dm_id` on content tables <!-- common-v10 -->
- [ ] Publish flow for towns, roads, NPCs, items <!-- common-v10 -->
- [ ] k-ring(N) proximity rule — new DM claims must be adjacent to existing claims <!-- common-v10 -->
- [ ] Chronicler override — undo or negotiate a contested canon mutation after-the-fact <!-- common-v10 -->
- [ ] Resolution tiers by DM class — newbie claims at res-7, Cartographer at res-5, World AI at res-4+ <!-- common-v10 -->

### v11 — Content lifecycle + canon

- [ ] Lifecycle daemon: active → dormant 60d → ruin 90d → lost +30d <!-- common-v11 -->
- [ ] Ruin adoption UI <!-- common-v11 -->
- [ ] `common_entity_references` + canon-lock at count ≥ 2 <!-- common-v11 -->
- [ ] Naming etiquette check with translation pass <!-- common-v11 -->
- [ ] Watchlist for first-campaign DMs <!-- common-v11 -->
- [ ] Cross-campaign overlap detection + notification (surface when two campaigns' explored hexes intersect) <!-- common-v11 -->
- [ ] Common Year alignment rules (close-in-time campaigns bring-forward to world frontier) <!-- common-v11 -->

### v12 — Living world (entities + agents)

- [ ] `common_world_entities` table (storms, ships, caravans, armies) <!-- common-v12 -->
- [ ] World AI movement loop on common-clock tick <!-- common-v12 -->
- [ ] DM game clock advance UI on world map (advance N hours/days, entity tick) <!-- common-v12 -->
- [ ] NPC Layer A — ambient/loop NPCs (hex-schedule data model, baker pattern) <!-- common-v12 -->
- [ ] Weather → NPC schedule consequence — professions react to hex weather (smith closes on storm, caravan delays, dockers double-rate in rain) <!-- common-v12 -->
- [ ] NPC Layer B scaffold — mechanic NPCs (merchants, criers, innkeepers) <!-- common-v12 -->
- [ ] Factions table (thieves, assassins, merchants, religious orders, royalty) <!-- common-v12 -->
- [ ] Faction agents with agendas + pairwise relationships <!-- common-v12 -->
- [ ] Pentagon/void routing — entities route around the twelve voids <!-- common-v12 -->
- [ ] Overheard-on-pass — Layer A NPC proximity triggers Discord snippet <!-- common-v12 -->
- [ ] Agent cost budget + kill switch — per-campaign monthly cap on Haiku/Sonnet calls, DM-visible pause control <!-- common-v12 -->
- [ ] Add `hard_cap_usd` to budget caps — auto-pause when MTD crosses hard cap <!-- common-v12 -->
- [ ] Per-call Anthropic cost estimator — reject calls with estimated cost > $0.10 <!-- common-v12 -->
- [ ] Auto-downgrade Sonnet → Haiku when MTD crosses 50% of hard cap <!-- common-v12 -->
- [ ] Campaign-scoped spend caps — ledger + caps keyed on `campaign_id` <!-- common-v12 -->
- [ ] Founder emergency kill-all — admin endpoint pauses every campaign's World AI <!-- common-v12 -->
- [ ] World AI pause toggle on `/dm/campaign` — live, campaign-scoped, instant effect <!-- common-v12 -->

### v13 — Economy — monetary

- [ ] `treasury_gp` / `treasury_sp` / `treasury_cp` on campaigns <!-- common-v13 -->
- [ ] Upkeep ledger + debit per common-day <!-- common-v13 -->
- [ ] Common item price sheet (`/common-world/prices`) <!-- common-v13 -->
- [ ] `/dm/[slug]/treasury` page <!-- common-v13 -->

### v14 — Magic system + MP economy

- [ ] MP on player sheet — natural capacity + current held (per-class/race cap) <!-- common-v14 -->
- [ ] `vessels` table — owner, type, capacity, current_mp, recharge_rate, condition <!-- common-v14 -->
- [ ] Affinity classification — natural / channeler / mundane on player sheets <!-- common-v14 -->
- [ ] Ley-line hex state — per-hex MP reserves and regeneration <!-- common-v14 -->
- [ ] Per-hex MP pricing + regional gp↔MP exchange rates <!-- common-v14 -->
- [ ] Magic merchants + magic banks (storage, loans, interest) <!-- common-v14 -->
- [ ] Moon-phase recharge modifier on vessels + natural holders <!-- common-v14 -->
- [ ] Wild-magic surge tables (5e-based) + world-consequence variants <!-- common-v14 -->

### v15 — News, weather, celestial

- [x] Biome-keyed hex substrate — Köppen zone + elevation + coastal flag per hex (foundation for all weather, magic zones, NPC schedules) <!-- common-v15 -->
- [ ] Raven Post Common Desk (inbox of nearby/tagged common-world headlines) <!-- common-v15 -->
- [ ] Distance-based arrival delay by item kind <!-- common-v15 -->
- [ ] Trust-tier degradation by hex distance <!-- common-v15 -->
- [ ] Real-world moon phase → global celestial events <!-- common-v15 -->
- [ ] Local weather derived from common weather layer <!-- common-v15 -->
- [ ] Environment pill on local maps (weather + day/night from parent hex) <!-- common-v15 -->
- [x] NOAA GFS weather subscription → in-fiction storms (identity-laundered) <!-- common-v15 -->
- [x] Weather MVP (Ambience v1) — session-start GFS forecast for party hex + prose presentation + banner/SCB/broadsheet surfaces (docs/brainstorms/2026-04-19-ambience-v1-requirements.md) <!-- common-v15 -->
- [ ] Continent-coherent storm translation — project live GFS onto CW continents with rotation + EMA smoothing (lets live weather scale beyond the party hex) <!-- common-v15 -->
- [ ] NOAA SWPC aurora/solar-flare feed → sky-danced events <!-- common-v15 -->
- [ ] Trust tiers on items (Official / Whispered / Rumored / Prophesied) <!-- common-v15 -->
- [ ] Earth-region remap engine — per-world rotation/mirror/shuffle of real geography <!-- common-v15 -->
- [ ] Look-dev pass: Open-Meteo heatmap overlay — sample cloud_cover on a regular lat/lng grid, paint to canvas, wrap as transparent sphere texture (alternative path to NASA GIBS; full control + uses integration we already run) <!-- common-v15 -->

### v16 — Steampunk + airships

- [ ] Airship yards as world entities at anchor hexes <!-- common-v16 -->
- [ ] Airship trade routes as world entities (lines between yards) <!-- common-v16 -->
- [ ] MP-burning engine mechanics — vessels power propulsion <!-- common-v16 -->
- [ ] Air-current navigation using laundered real jet-stream data <!-- common-v16 -->
- [ ] Passage-booking flow for player parties (fast travel option) <!-- common-v16 -->
- [ ] Sky-pirates as faction (steampunk air-raid mechanics) <!-- common-v16 -->

### v17 — Creative destruction

- [ ] `destructible_kind` enum on common_entities <!-- common-v17 -->
- [ ] `object_dc` + build-effort symmetry rule <!-- common-v17 -->
- [ ] Physical-interaction gate for destruction <!-- common-v17 -->
- [ ] `destroyed` / `rebuilt` lifecycle states <!-- common-v17 -->
- [ ] Research brief: 5e DMG object rules + siege warfare DCs <!-- common-v17 -->

### v18 — Moderated comments

- [ ] Comment surface on towns, bridges, hero NPCs, bespoke items, taverns/inns, landmarks <!-- common-v18 -->
- [ ] In-fiction tone rules enforcement <!-- common-v18 -->
- [ ] Three-strike moderation flow <!-- common-v18 -->

### v19 — Crossover sessions

- [ ] Bilateral crossover handshake <!-- common-v19 -->
- [ ] Joint initiative order <!-- common-v19 -->
- [ ] Dual-journal writes <!-- common-v19 -->
- [ ] Same-location-same-time surfacing (two parties in same hex at same in-fiction time) <!-- common-v19 -->

### v20 — Internal battle-test (synthetic campaigns)

- [ ] Synthetic DM + player personas (3–5 DMs, 4-player parties each, varied tiers) <!-- common-v20 -->
- [ ] Scripted end-to-end run: onboarding → first claim → publish → 5+ sessions → content-lifecycle triggers <!-- common-v20 -->
- [ ] Cross-campaign collision + crossover session scenarios exercised <!-- common-v20 -->
- [ ] World-AI loops under synthetic load (entity movement, weather, rumors) <!-- common-v20 -->
- [ ] Economy + common price-sheet flow exercised across 3+ campaigns <!-- common-v20 -->
- [ ] Performance baseline + bug triage pass from battle-test findings <!-- common-v20 -->

### v21 — Closed beta (real DMs)

- [ ] Login system — decide between magic link / OAuth / passkey (review before build) <!-- common-v21 -->
- [ ] `/login` page <!-- common-v21 -->
- [ ] `/dms/[handle]` stub (logged-in only) <!-- common-v21 -->
- [ ] Signup allowlist gate (env-var) <!-- common-v21 -->
- [ ] Recruit 5–10 real DMs from existing network <!-- common-v21 -->
- [ ] DM self-serve onboarding docs (can a new DM reach first claim without handholding?) <!-- common-v21 -->
- [ ] Beta covenant page — what's stable, what isn't, what may change <!-- common-v21 -->
- [ ] In-app feedback capture + weekly sync cadence <!-- common-v21 -->
- [ ] Usage telemetry — per-feature touch rates, drop-off points <!-- common-v21 -->
- [ ] Closed-beta exit criteria (crash rate, NPS, feature completeness) gating public launch <!-- common-v21 -->

### v22 — Public launch

- [ ] Flip signup allowlist off (public DM signup opens) <!-- common-v22 -->
- [ ] Loremaster tier operations <!-- common-v22 -->
- [ ] Delegated moderation for Loremasters <!-- common-v22 -->
- [ ] `/common-world/chronicle` public activity log <!-- common-v22 -->
- [ ] Research TODO: ethical content moderation best practices for D&D <!-- common-v22 -->

### v23 — Contributor portfolios

- [ ] `/dms/[handle]` full portfolio page (logged-in only) <!-- common-v23 -->
- [ ] Cross-campaign DM history surface <!-- common-v23 -->
- [ ] Reference graph visualization <!-- common-v23 -->
- [ ] NPC Layer C — hero NPCs as long-horizon agents with memory + agendas <!-- common-v23 -->

### v24 — ERC-20 token bridge (planning only)

- [ ] Planning doc for common currency ERC-20 token <!-- common-v24 -->
- [ ] Legal review (KYC, tax, real-money stakes) <!-- common-v24 -->
