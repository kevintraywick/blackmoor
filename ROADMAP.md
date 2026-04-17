# Roadmap

The public roadmap for **Shadow of the Wolf** (the campaign site) and **Common World** (the platform). This file is parsed at build time and rendered at `/do`.

Each item is a checkbox list entry with a version tag. Tags look like `<!-- shadow-v2 -->` or `<!-- v6 -->`. Untagged items are ignored. Shadow and Common share one version sequence: Shadow is v1–v3, Common starts at v4.

Status is read from the checkbox: `[x]` = built, `[ ]` = planned. Add `<!-- in-progress -->` to mark partial work. Note: this file is a snapshot — the DB (`roadmap_items` table) is the ground truth.

---

## Shadow of the Wolf

> The D&D campaign site Kevin uses at the table with his players. One campaign, one site. Pre-dates Common World.

### Shadow v1 — live

- [x] Player sheets with inventory, HP, gold, character details <!-- shadow-v1 -->
- [x] Session control bar (start/pause/end, long rest, roll initiative) <!-- shadow-v1 -->
- [x] DM journal + public journey log <!-- shadow-v1 -->
- [x] NPC session management + HP tracking + long-rest heal <!-- shadow-v1 -->
- [x] Map Builder with world/local hierarchy and canonical scale <!-- shadow-v1 -->
- [x] Inventory card builder (magic items, scrolls, spells) <!-- shadow-v1 -->
- [x] DM messages + whispers + boons <!-- shadow-v1 -->
- [x] Poison counter with long-rest healing <!-- shadow-v1 -->
- [x] Initiative tracker with session events <!-- shadow-v1 -->
- [x] "Are You In?" availability page with quorum email <!-- shadow-v1 -->
- [x] Invitation system for players <!-- shadow-v1 -->
- [x] Nightly DB backup via GitHub Actions <!-- shadow-v1 -->
- [x] Review Common v1/v2/v3 plan docs (top priority — unblocks Common work) <!-- shadow-v1 -->
- [x] Archive legacy Realm Walker TODO <!-- shadow-v1 -->



### Shadow v1 — in flight


### Shadow v2 — planned

- [x] 3 vertical circles on player banner (compass, sun/moon phase, wind dir) — also on sessions <!-- shadow-v2 -->
- [x] Add Ajax to DM nav pane next to DM circle <!-- shadow-v2 -->
- [x] Mobile marketplace redesign <!-- shadow-v2 -->
- [x] Raven Post World AI hardening <!-- shadow-v2 -->
- [x] Sendings pane on player's own page <!-- shadow-v2 -->



### Shadow v3 — maps

- [ ] Merge feat/map-builder PR to main (editor, world map, local maps, canonical scale) <!-- shadow-v3 -->
- [ ] Mappy N-direction detection on uploaded maps <!-- shadow-v3 -->
- [ ] Mappy scale sanity check (flag grid vs AI discrepancy) <!-- shadow-v3 -->
- [ ] Builder canvas image rendering at canonical scale <!-- shadow-v3 -->
- [ ] Fog of war — player-facing world map with revealed hexes only <!-- shadow-v3 -->
- [ ] Player-facing local map view (read-only, inherits fog state) <!-- shadow-v3 -->
- [ ] DM game clock advance UI on world map (advance N hours/days, entity tick) <!-- shadow-v3 -->
- [ ] Environment pill on local maps (weather + day/night from parent hex) <!-- shadow-v3 -->
- [ ] Upload classification dialog — world addition vs local map <!-- shadow-v3 -->
- [ ] World hex picker — place local maps on the world grid <!-- shadow-v3 -->
- [ ] Local map session event publishing (asset placed, map opened, party marker) <!-- shadow-v3 -->
- [ ] Seed world map refresh (the hand-painted canvas Common sits on) <!-- shadow-v3 -->
- [ ] World map party marker visible to players <!-- shadow-v3 -->
- [ ] Print mode for map builder <!-- shadow-v3 -->
- [x] Hand-painted 2D hex terrain tiles (Baumgart Basic Terrain Set, replacing KayKit 3D renders) <!-- shadow-v3 -->
- [x] Terrain painting mode on world map (paint mode, palette, Baumgart sprite rendering, cursor fix) <!-- shadow-v3 -->
- [ ] Three.js hex renderer for world map (3D tiles, elevation, lighting, water) <!-- shadow-v3 -->
- [ ] Scale reference tools (d6 anchor, ruler-in-image, template overlay) <!-- shadow-v3 -->
- [ ] Language overlay map <!-- shadow-v3 -->


---

## Common World

> The multi-tenant shared-canon platform that will host many campaigns. Designed 2026-04-10/11. Full plan docs in `docs/plans/`.

### v4 — current

- [ ] `/do` roadmap page reading ROADMAP.md <!-- common-v4 --> <!-- in-progress -->
- [ ] Copyright footer site-wide (© Grey Assassins Guild, LLC) <!-- common-v4 -->
- [ ] Backup cadence bumped to every 4 hours during refactor weeks <!-- common-v4 -->



### v5 — DM identity groundwork

- [ ] `dms` table with handle, email, chronicler_handle, tier <!-- common-v5 -->
- [ ] Magic-link login via Resend <!-- common-v5 -->
- [ ] `/login` page <!-- common-v5 -->
- [ ] `/dms/[handle]` stub (logged-in only) <!-- common-v5 -->
- [ ] Signup allowlist gate (env-var) <!-- common-v5 -->



### v6 — multi-tenancy refactor

- [ ] Dev DB provisioned on Railway <!-- common-v6 -->
- [ ] `campaigns` table with partial unique index on one-active-per-DM <!-- common-v6 -->
- [ ] `campaign_id` nullable columns on every scoped table <!-- common-v6 -->
- [ ] `getCampaignId()` helper in `lib/db.ts` <!-- common-v6 -->
- [ ] API route migration pass (reads) <!-- common-v6 -->
- [ ] API route migration pass (writes) <!-- common-v6 -->
- [ ] `lib/world.ts` + `lib/raven-post.ts` + `lib/world-ai-*.ts` rescoped <!-- common-v6 -->
- [ ] Shadow backfill — every existing row gets `shadow` campaign_id <!-- common-v6 -->



### v7 — the flip

- [ ] `campaign_id` NOT NULL + foreign keys <!-- common-v7 -->
- [ ] Routes restructured: `/dm/*` → `/dm/[slug]/*` <!-- common-v7 -->
- [ ] `/dm` redirects to `/dm/[active-slug]` <!-- common-v7 -->
- [ ] Old singleton `campaign` table dropped <!-- common-v7 -->
- [ ] Full smoke test as @thewolf and as unauthenticated visitor <!-- common-v7 -->



### v8 — read-only Common World

- [ ] `/common-world` browse page <!-- common-v8 -->
- [ ] `common_hexes` table <!-- common-v8 -->
- [ ] `common_entities` table <!-- common-v8 -->
- [ ] `common_clock` singleton <!-- common-v8 -->
- [ ] `/common-world/covenant` page with 7 rules <!-- common-v8 -->
- [ ] Content blacklist page (firearms, modern tech, etc.) <!-- common-v8 -->
- [ ] Seeded central region hand-painted via Map Builder <!-- common-v8 -->
- [ ] Seeded wilds via AI generation <!-- common-v8 -->



### v9 — claim + publish

- [ ] 1-hex claim mechanic for newbies <!-- common-v9 -->
- [ ] 100-hex map-drop claim for map-bringers (Cartographer tier) <!-- common-v9 -->
- [ ] First-publish 48h queue for Cartographer tier <!-- common-v9 -->
- [ ] Chronicler queue dashboard <!-- common-v9 -->
- [ ] SMS approval via Twilio (10 min SLA target) <!-- common-v9 -->
- [ ] Author tracking: `author_dm_id` on content tables <!-- common-v9 -->
- [ ] Publish flow for towns, roads, NPCs, items <!-- common-v9 -->



### v10 — content lifecycle

- [ ] Lifecycle daemon: active → dormant 60d → ruin 90d → lost +30d <!-- common-v10 -->
- [ ] Ruin adoption UI <!-- common-v10 -->
- [ ] `common_entity_references` + canon-lock at count ≥ 2 <!-- common-v10 -->
- [ ] Naming etiquette check with translation pass <!-- common-v10 -->
- [ ] Watchlist for first-campaign DMs <!-- common-v10 -->



### v11 — world entities + economy

- [ ] `common_world_entities` table (storms, ships, caravans, armies) <!-- common-v11 -->
- [ ] World AI movement loop on common-clock tick <!-- common-v11 -->
- [ ] `treasury_gp` / `treasury_sp` / `treasury_cp` on campaigns <!-- common-v11 -->
- [ ] Upkeep ledger + debit per common-day <!-- common-v11 -->
- [ ] Common item price sheet (`/common-world/prices`) <!-- common-v11 -->
- [ ] `/dm/[slug]/treasury` page <!-- common-v11 -->



### v12 — news propagation + celestial

- [ ] Raven Post Common Desk (inbox of nearby/tagged common-world headlines) <!-- common-v12 -->
- [ ] Distance-based arrival delay by item kind <!-- common-v12 -->
- [ ] Trust-tier degradation by hex distance <!-- common-v12 -->
- [ ] Real-world moon phase → global celestial events <!-- common-v12 -->
- [ ] Local weather derived from common weather layer <!-- common-v12 -->



### v13 — creative destruction

- [ ] `destructible_kind` enum on common_entities <!-- common-v13 -->
- [ ] `object_dc` + build-effort symmetry rule <!-- common-v13 -->
- [ ] Physical-interaction gate for destruction <!-- common-v13 -->
- [ ] `destroyed` / `rebuilt` lifecycle states <!-- common-v13 -->
- [ ] Research brief: 5e DMG object rules + siege warfare DCs <!-- common-v13 -->



### v14 — moderated comments

- [ ] Comment surface on towns, bridges, hero NPCs, bespoke items, taverns/inns, landmarks <!-- common-v14 -->
- [ ] In-fiction tone rules enforcement <!-- common-v14 -->
- [ ] Three-strike moderation flow <!-- common-v14 -->



### v15 — crossover sessions

- [ ] Bilateral crossover handshake <!-- common-v15 -->
- [ ] Joint initiative order <!-- common-v15 -->
- [ ] Dual-journal writes <!-- common-v15 -->



### v16 — public signup

- [ ] Flip signup allowlist off (public DM signup opens) <!-- common-v16 -->
- [ ] Loremaster tier operations <!-- common-v16 -->
- [ ] Delegated moderation for Loremasters <!-- common-v16 -->
- [ ] `/common-world/chronicle` public activity log <!-- common-v16 -->
- [ ] Research TODO: ethical content moderation best practices for D&D <!-- common-v16 -->



### v17 — contributor portfolios

- [ ] `/dms/[handle]` full portfolio page (logged-in only) <!-- common-v17 -->
- [ ] Cross-campaign DM history surface <!-- common-v17 -->
- [ ] Reference graph visualization <!-- common-v17 -->



### v18 — ERC-20 token bridge (planning only)

- [ ] Planning doc for common currency ERC-20 token <!-- common-v18 -->
- [ ] Legal review (KYC, tax, real-money stakes) <!-- common-v18 -->

