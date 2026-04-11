# Roadmap

The public roadmap for **Shadow of the Wolf** (the campaign site) and **Common World** (the platform). This file is parsed at build time and rendered at `/do`.

Each item is a checkbox list entry with a version tag. Tags look like `<!-- shadow-v2 -->` or `<!-- common-v3 -->`. Untagged items are ignored.

Status is read from the checkbox: `[x]` = built, `[ ]` = planned. Add `<!-- in-progress -->` to mark partial work. Add `<!-- deferred -->` to strike through.

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

### Shadow v2 — planned

- [ ] 3 vertical circles on player banner (compass, sun/moon phase, wind dir) — also on sessions <!-- shadow-v2 -->
- [ ] Mobile marketplace redesign <!-- shadow-v2 -->
- [ ] Player-to-player trading <!-- shadow-v2 -->
- [ ] Mappy N-direction detection on uploaded maps <!-- shadow-v2 -->
- [ ] Raven Post World AI hardening <!-- shadow-v2 -->
- [ ] Sendings pane on player's own page <!-- shadow-v2 -->
- [ ] Seed world map refresh (the hand-painted canvas Common sits on) <!-- shadow-v2 -->

---

## Common World

> The multi-tenant shared-canon platform that will host many campaigns. Designed 2026-04-10/11. Full plan docs in `docs/plans/`.

### Common v1 — current

- [ ] `/do` roadmap page reading ROADMAP.md <!-- common-v1 --> <!-- in-progress -->
- [ ] Copyright footer site-wide (© Grey Assassins Guild, LLC) <!-- common-v1 -->
- [ ] Backup cadence bumped to every 4 hours during refactor weeks <!-- common-v1 -->

### Common v2 — DM identity groundwork

- [ ] `dms` table with handle, email, chronicler_handle, tier <!-- common-v2 -->
- [ ] Magic-link login via Resend <!-- common-v2 -->
- [ ] `/login` page <!-- common-v2 -->
- [ ] `/dms/[handle]` stub (logged-in only) <!-- common-v2 -->
- [ ] Signup allowlist gate (env-var) <!-- common-v2 -->

### Common v3 — multi-tenancy refactor

- [ ] Dev DB provisioned on Railway <!-- common-v3 -->
- [ ] `campaigns` table with partial unique index on one-active-per-DM <!-- common-v3 -->
- [ ] `campaign_id` nullable columns on every scoped table <!-- common-v3 -->
- [ ] `getCampaignId()` helper in `lib/db.ts` <!-- common-v3 -->
- [ ] API route migration pass (reads) <!-- common-v3 -->
- [ ] API route migration pass (writes) <!-- common-v3 -->
- [ ] `lib/world.ts` + `lib/raven-post.ts` + `lib/world-ai-*.ts` rescoped <!-- common-v3 -->
- [ ] Shadow backfill — every existing row gets `shadow` campaign_id <!-- common-v3 -->

### Common v4 — the flip

- [ ] `campaign_id` NOT NULL + foreign keys <!-- common-v4 -->
- [ ] Routes restructured: `/dm/*` → `/dm/[slug]/*` <!-- common-v4 -->
- [ ] `/dm` redirects to `/dm/[active-slug]` <!-- common-v4 -->
- [ ] Old singleton `campaign` table dropped <!-- common-v4 -->
- [ ] Full smoke test as @thewolf and as unauthenticated visitor <!-- common-v4 -->

### Common v5 — read-only Common World

- [ ] `/common-world` browse page <!-- common-v5 -->
- [ ] `common_hexes` table <!-- common-v5 -->
- [ ] `common_entities` table <!-- common-v5 -->
- [ ] `common_clock` singleton <!-- common-v5 -->
- [ ] `/common-world/covenant` page with 7 rules <!-- common-v5 -->
- [ ] Content blacklist page (firearms, modern tech, etc.) <!-- common-v5 -->
- [ ] Seeded central region hand-painted via Map Builder <!-- common-v5 -->
- [ ] Seeded wilds via AI generation <!-- common-v5 -->

### Common v6 — claim + publish

- [ ] 1-hex claim mechanic for newbies <!-- common-v6 -->
- [ ] 100-hex map-drop claim for map-bringers (Cartographer tier) <!-- common-v6 -->
- [ ] First-publish 48h queue for Cartographer tier <!-- common-v6 -->
- [ ] Chronicler queue dashboard <!-- common-v6 -->
- [ ] SMS approval via Twilio (10 min SLA target) <!-- common-v6 -->
- [ ] Author tracking: `author_dm_id` on content tables <!-- common-v6 -->
- [ ] Publish flow for towns, roads, NPCs, items <!-- common-v6 -->

### Common v7 — content lifecycle

- [ ] Lifecycle daemon: active → dormant 60d → ruin 90d → lost +30d <!-- common-v7 -->
- [ ] Ruin adoption UI <!-- common-v7 -->
- [ ] `common_entity_references` + canon-lock at count ≥ 2 <!-- common-v7 -->
- [ ] Naming etiquette check with translation pass <!-- common-v7 -->
- [ ] Watchlist for first-campaign DMs <!-- common-v7 -->

### Common v8 — world entities + economy

- [ ] `common_world_entities` table (storms, ships, caravans, armies) <!-- common-v8 -->
- [ ] World AI movement loop on common-clock tick <!-- common-v8 -->
- [ ] `treasury_gp` / `treasury_sp` / `treasury_cp` on campaigns <!-- common-v8 -->
- [ ] Upkeep ledger + debit per common-day <!-- common-v8 -->
- [ ] Common item price sheet (`/common-world/prices`) <!-- common-v8 -->
- [ ] `/dm/[slug]/treasury` page <!-- common-v8 -->

### Common v9 — news propagation + celestial

- [ ] Raven Post Common Desk (inbox of nearby/tagged common-world headlines) <!-- common-v9 -->
- [ ] Distance-based arrival delay by item kind <!-- common-v9 -->
- [ ] Trust-tier degradation by hex distance <!-- common-v9 -->
- [ ] Real-world moon phase → global celestial events <!-- common-v9 -->
- [ ] Local weather derived from common weather layer <!-- common-v9 -->

### Common v10 — creative destruction

- [ ] `destructible_kind` enum on common_entities <!-- common-v10 -->
- [ ] `object_dc` + build-effort symmetry rule <!-- common-v10 -->
- [ ] Physical-interaction gate for destruction <!-- common-v10 -->
- [ ] `destroyed` / `rebuilt` lifecycle states <!-- common-v10 -->
- [ ] Research brief: 5e DMG object rules + siege warfare DCs <!-- common-v10 -->

### Common v11 — moderated comments

- [ ] Comment surface on towns, bridges, hero NPCs, bespoke items, taverns/inns, landmarks <!-- common-v11 -->
- [ ] In-fiction tone rules enforcement <!-- common-v11 -->
- [ ] Three-strike moderation flow <!-- common-v11 -->

### Common v12 — crossover sessions

- [ ] Bilateral crossover handshake <!-- common-v12 -->
- [ ] Joint initiative order <!-- common-v12 -->
- [ ] Dual-journal writes <!-- common-v12 -->

### Common v13 — public signup

- [ ] Flip signup allowlist off (public DM signup opens) <!-- common-v13 -->
- [ ] Loremaster tier operations <!-- common-v13 -->
- [ ] Delegated moderation for Loremasters <!-- common-v13 -->
- [ ] `/common-world/chronicle` public activity log <!-- common-v13 -->
- [ ] Research TODO: ethical content moderation best practices for D&D <!-- common-v13 -->

### Common v14 — contributor portfolios

- [ ] `/dms/[handle]` full portfolio page (logged-in only) <!-- common-v14 -->
- [ ] Cross-campaign DM history surface <!-- common-v14 -->
- [ ] Reference graph visualization <!-- common-v14 -->

### Common v15 — ERC-20 token bridge (planning only)

- [ ] Planning doc for common currency ERC-20 token <!-- common-v15 -->
- [ ] Legal review (KYC, tax, real-money stakes) <!-- common-v15 -->
