# Roadmap

The roadmap for **Common World** (the platform) and the campaigns running on it. Shadow of the Wolf is the flagship campaign. This file is parsed at build time and rendered at `/do`.

Each item is a checkbox list entry with a version tag. Tags look like `<!-- common-v4 -->`. Untagged items are ignored. Versions run v3 (maps, in flight) through v21 (planning horizon).

Status is read from the checkbox: `[x]` = built, `[ ]` = planned. Add `<!-- in-progress -->` to mark partial work. Note: this file is a snapshot — the DB (`roadmap_items` table) is the ground truth.

---

### Shipped

Archived 2026-04-16. Item rows live in the `roadmap_items` table and still render collapsed under each version's "completed" pill on `/do` when any active work remains in the version.

**Shadow one — the site itself.** Player sheets, inventory, HP, gold, DM journal, public journey log, NPC session management, Map Builder (world/local + canonical scale), inventory card builder, DM messages + whispers + boons, poison counter, initiative tracker, "Are You In?" availability page with quorum email, invitation system, nightly DB backup.

**Shadow two — polish + the living world.** Three vertical banner circles (compass, sun/moon phase, wind), Ajax in DM nav, mobile marketplace redesign, Raven Post World AI hardening, player-side Sendings pane.

### v3 — Map Builder

- [ ] Merge feat/map-builder PR to main (editor, world map, local maps, canonical scale) <!-- common-v3 -->
- [ ] Mappy N-direction detection on uploaded maps <!-- common-v3 -->
- [ ] Mappy scale sanity check (flag grid vs AI discrepancy) <!-- common-v3 -->
- [ ] Builder canvas image rendering at canonical scale <!-- common-v3 -->
- [ ] Fog of war — player-facing world map with revealed hexes only <!-- common-v3 -->
- [ ] Player-facing local map view (read-only, inherits fog state) <!-- common-v3 -->
- [ ] Upload classification dialog — world addition vs local map <!-- common-v3 -->
- [ ] World hex picker — place local maps on the world grid <!-- common-v3 -->
- [ ] Local map session event publishing (asset placed, map opened, party marker) <!-- common-v3 -->
- [ ] Seed world map refresh (the hand-painted canvas Common sits on) <!-- common-v3 -->
- [ ] World map party marker visible to players <!-- common-v3 -->
- [ ] Print mode for map builder <!-- common-v3 -->
- [x] Hand-painted 2D hex terrain tiles (Baumgart Basic Terrain Set, replacing KayKit 3D renders) <!-- common-v3 -->
- [x] Terrain painting mode on world map (paint mode, palette, Baumgart sprite rendering, cursor fix) <!-- common-v3 -->
- [ ] Three.js hex renderer for world map (3D tiles, elevation, lighting, water) <!-- common-v3 -->
- [ ] Scale reference tools (d6 anchor, ruler-in-image, template overlay) <!-- common-v3 -->

### v4 — Spatial substrate (H3)

- [ ] Add `h3-js` dependency and `lib/h3.ts` helpers (cell ↔ lat/lng, k-ring, parent/child, pentagon-cell lookup) <!-- common-v4 -->
- [ ] Schema: nullable `h3_cell bigint` + `h3_res smallint` columns on spatial tables (world hexes, local maps, NPCs, AR encounters) <!-- common-v4 -->
- [ ] World anchor: pick real lat/lng and H3 resolution for current Shadow world map <!-- common-v4 -->
- [ ] Backfill: existing world-hex (col,row) coords → `h3_cell` at chosen resolution <!-- common-v4 -->
- [ ] Dual-write: world-map writes populate `h3_cell` alongside legacy (col,row); reads remain on legacy path <!-- common-v4 -->

### v5 — Housekeeping + ops

- [ ] `/do` roadmap page reading ROADMAP.md <!-- common-v5 --> <!-- in-progress -->
- [x] Copyright footer site-wide (© Grey Assassins Guild, LLC) <!-- common-v5 -->
- [ ] Backup cadence bumped to every 4 hours during refactor weeks <!-- common-v5 -->

### v6 — DM identity

- [ ] `dms` table with handle, email, chronicler_handle, tier <!-- common-v6 -->
- [ ] Magic-link login via Resend <!-- common-v6 -->
- [ ] `/login` page <!-- common-v6 -->
- [ ] `/dms/[handle]` stub (logged-in only) <!-- common-v6 -->
- [ ] Signup allowlist gate (env-var) <!-- common-v6 -->

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

### v10 — Claim + publish (contributor flow)

- [ ] 1-hex claim mechanic for newbies <!-- common-v10 -->
- [ ] 100-hex map-drop claim for map-bringers (Cartographer tier) <!-- common-v10 -->
- [ ] First-publish 48h queue for Cartographer tier <!-- common-v10 -->
- [ ] Chronicler queue dashboard <!-- common-v10 -->
- [ ] SMS approval via Twilio (10 min SLA target) <!-- common-v10 -->
- [ ] Author tracking: `author_dm_id` on content tables <!-- common-v10 -->
- [ ] Publish flow for towns, roads, NPCs, items <!-- common-v10 -->

### v11 — Content lifecycle + canon

- [ ] Lifecycle daemon: active → dormant 60d → ruin 90d → lost +30d <!-- common-v11 -->
- [ ] Ruin adoption UI <!-- common-v11 -->
- [ ] `common_entity_references` + canon-lock at count ≥ 2 <!-- common-v11 -->
- [ ] Naming etiquette check with translation pass <!-- common-v11 -->
- [ ] Watchlist for first-campaign DMs <!-- common-v11 -->

### v12 — Living world + economy

- [ ] `common_world_entities` table (storms, ships, caravans, armies) <!-- common-v12 -->
- [ ] World AI movement loop on common-clock tick <!-- common-v12 -->
- [ ] `treasury_gp` / `treasury_sp` / `treasury_cp` on campaigns <!-- common-v12 -->
- [ ] Upkeep ledger + debit per common-day <!-- common-v12 -->
- [ ] Common item price sheet (`/common-world/prices`) <!-- common-v12 -->
- [ ] `/dm/[slug]/treasury` page <!-- common-v12 -->
- [ ] DM game clock advance UI on world map (advance N hours/days, entity tick) <!-- common-v12 -->

### v13 — News, weather, celestial

- [ ] Raven Post Common Desk (inbox of nearby/tagged common-world headlines) <!-- common-v13 -->
- [ ] Distance-based arrival delay by item kind <!-- common-v13 -->
- [ ] Trust-tier degradation by hex distance <!-- common-v13 -->
- [ ] Real-world moon phase → global celestial events <!-- common-v13 -->
- [ ] Local weather derived from common weather layer <!-- common-v13 -->
- [ ] Environment pill on local maps (weather + day/night from parent hex) <!-- common-v13 -->

### v14 — Creative destruction

- [ ] `destructible_kind` enum on common_entities <!-- common-v14 -->
- [ ] `object_dc` + build-effort symmetry rule <!-- common-v14 -->
- [ ] Physical-interaction gate for destruction <!-- common-v14 -->
- [ ] `destroyed` / `rebuilt` lifecycle states <!-- common-v14 -->
- [ ] Research brief: 5e DMG object rules + siege warfare DCs <!-- common-v14 -->

### v15 — Moderated comments

- [ ] Comment surface on towns, bridges, hero NPCs, bespoke items, taverns/inns, landmarks <!-- common-v15 -->
- [ ] In-fiction tone rules enforcement <!-- common-v15 -->
- [ ] Three-strike moderation flow <!-- common-v15 -->

### v16 — Crossover sessions

- [ ] Bilateral crossover handshake <!-- common-v16 -->
- [ ] Joint initiative order <!-- common-v16 -->
- [ ] Dual-journal writes <!-- common-v16 -->

### v17 — Internal battle-test (synthetic campaigns)

- [ ] Synthetic DM + player personas (3–5 DMs, 4-player parties each, varied tiers) <!-- common-v17 -->
- [ ] Scripted end-to-end run: onboarding → first claim → publish → 5+ sessions → content-lifecycle triggers <!-- common-v17 -->
- [ ] Cross-campaign collision + crossover session scenarios exercised <!-- common-v17 -->
- [ ] World-AI loops under synthetic load (entity movement, weather, rumors) <!-- common-v17 -->
- [ ] Economy + common price-sheet flow exercised across 3+ campaigns <!-- common-v17 -->
- [ ] Performance baseline + bug triage pass from battle-test findings <!-- common-v17 -->

### v18 — Closed beta (real DMs)

- [ ] Recruit 5–10 real DMs from existing network <!-- common-v18 -->
- [ ] DM self-serve onboarding docs (can a new DM reach first claim without handholding?) <!-- common-v18 -->
- [ ] Beta covenant page — what's stable, what isn't, what may change <!-- common-v18 -->
- [ ] In-app feedback capture + weekly sync cadence <!-- common-v18 -->
- [ ] Usage telemetry — per-feature touch rates, drop-off points <!-- common-v18 -->
- [ ] Closed-beta exit criteria (crash rate, NPS, feature completeness) gating public launch <!-- common-v18 -->

### v19 — Public launch

- [ ] Flip signup allowlist off (public DM signup opens) <!-- common-v19 -->
- [ ] Loremaster tier operations <!-- common-v19 -->
- [ ] Delegated moderation for Loremasters <!-- common-v19 -->
- [ ] `/common-world/chronicle` public activity log <!-- common-v19 -->
- [ ] Research TODO: ethical content moderation best practices for D&D <!-- common-v19 -->

### v20 — Contributor portfolios

- [ ] `/dms/[handle]` full portfolio page (logged-in only) <!-- common-v20 -->
- [ ] Cross-campaign DM history surface <!-- common-v20 -->
- [ ] Reference graph visualization <!-- common-v20 -->

### v21 — ERC-20 token bridge (planning only)

- [ ] Planning doc for common currency ERC-20 token <!-- common-v21 -->
- [ ] Legal review (KYC, tax, real-money stakes) <!-- common-v21 -->
