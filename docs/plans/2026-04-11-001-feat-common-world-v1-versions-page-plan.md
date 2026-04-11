# Common v1 — `/do` Roadmap Page

**Date:** 2026-04-11
**Status:** ready, being built in this session
**Owner:** Kevin (@kevin / @thewolf)
**Estimate:** 1 day

## Goal

Add a public roadmap page at `/do` that shows **two parallel version ladders** — one for **Shadow of the Wolf** (the campaign's web features) and one for **Common World** (the multi-tenant platform). Sourced from a single `TODO.md` at build time using inline version tags. No DB, no admin UI.

The page exists so that (1) Kevin can see the whole roadmap in one place while working, and (2) future DMs visiting the platform can see where it's going and trust it's being built.

## Terminology context (read this first)

- **Shadow of the Wolf** (slug: `shadow`) — Kevin's D&D campaign. Has its own version ladder.
- **Common World** (or just **Common**) — the platform that hosts many campaigns. Has its own version ladder.
- **Blackmoor** — internal codebase name, never user-visible.
- **Grey Assassins Guild, LLC** — legal entity. Goes in copyright footer.
- No more "phases" — always "versions."

## Data source — one file, version tags

Per Kevin's decision (Q3 answered): **one `TODO.md` file**, with version tags inline on each item:

```markdown
- [ ] Build /do roadmap page <!-- common-v1 -->
- [x] Session control bar <!-- shadow-v1 -->
- [ ] Mobile marketplace <!-- shadow-v2 -->
- [ ] Multi-tenancy refactor <!-- common-v3 -->
```

**Tag format:** `<!-- {ladder}-v{number} -->` where `ladder ∈ {shadow, common}` and `number` is a positive integer. Untagged items go to an "Unversioned" bucket and don't appear on `/do` until they're assigned.

**Status:** derived from the markdown checkbox — `[x]` = built, `[ ]` = planned. An inline `<!-- in-progress -->` tag on the line marks it as currently being worked on. `<!-- deferred -->` strikes it through.

## Version definitions (as of 2026-04-11)

See `docs/plans/` for detailed plan docs on each version. Summary:

### Shadow version ladder

No formal ladder yet — Shadow's features accumulate in `TODO.md` as tagged items. Kevin maintains it as Shadow evolves. The `/do` page renders whatever tags are present.

### Common version ladder

| Version | Scope |
|---------|-------|
| **v1** | This `/do` page. Copyright footer. Ships today. |
| **v2** | DM identity groundwork: `dms` table, magic-link login, `/login`, `/dms/[handle]` stub. One DM only for now, no multi-tenancy yet. |
| **v3** | Multi-tenancy refactor. Every scoped table gains `campaign_id`. Strangler-fig-style against a dev DB (pending Kevin's confirmation). |
| **v4** | The flip: drop singleton campaign, route `/dm/*` → `/dm/[slug]/*`. Shadow URL becomes `/dm/shadow/...`. |
| **v5** | Read-only Common World at `/common-world`. Covenant page, blacklist, seeded hero locations. Browse only. |
| **v6** | Claim mechanism + publishing pipeline + Cartographer queue + SMS approval. |
| **v7** | Content lifecycle daemon (active → dormant 60d → ruin 90d → lost +30d). Adoption. Canon-locking at 2 refs. Naming etiquette with translation pass. |
| **v8** | Common world entities (storms/ships/caravans/armies). World AI movement. Treasury columns. Common item price sheet. |
| **v9** | News propagation with distance-based delay. Real-world moon phase + celestial + local weather downlink. |
| **v10** | Creative destruction. `object_dc`, build-effort symmetry, physical-interaction gate. |
| **v11** | Moderated comments on towns, bridges, hero NPCs, bespoke items, taverns/inns, landmarks (6 kinds). |
| **v12** | Crossover sessions. Bilateral handshake + joint initiative + dual-journal writes. |
| **v13** | Public DM signup + Loremaster tier + delegated moderation + `/common-world/chronicle`. |
| **v14** | Contributor portfolio pages `/dms/[handle]` (logged-in only). |
| **v15** | ERC-20 token bridge — planning doc only; implementation is its own major effort. |

## Page layout

Two side-by-side columns on desktop, single column stacked on mobile. Each column is a ladder; ladders render their versions as stacked cards.

```
┌──────────────────────────┬──────────────────────────┐
│   Shadow of the Wolf     │      Common World        │
│                          │                          │
│  ┌─── v1 ───┐            │  ┌─── v1 ───┐            │
│  │ ● done    │           │  │ ◐ /do     │           │
│  │ ● done    │           │  │ ● footer  │           │
│  └───────────┘           │  └───────────┘           │
│                          │                          │
│  ┌─── v2 ───┐            │  ┌─── v2 ───┐            │
│  │ ○ banner  │           │  │ ○ login   │           │
│  │ ○ mkt     │           │  │ ○ /dms    │           │
│  └───────────┘           │  └───────────┘           │
└──────────────────────────┴──────────────────────────┘
```

### Visual

- Shadow column: warm brown accent (`#6b4f2a`), aged parchment card backgrounds.
- Common column: warm gold accent (`#c9a84c`).
- Glyphs: `●` built (gold), `◐` in progress (pulsing), `○` planned (outline), `✕` deferred (strikethrough).
- Typography: EB Garamond for titles, Geist for labels. Per DESIGN.md.
- Page width: `max-w-[1000px]` centered. Scroll the page, not the columns.
- No hidden dropdowns, no collapsed versions — everything visible per DESIGN.md "no hidden controls" rule.

## Copyright footer (lands with v1)

`app/layout.tsx` gains a site-wide footer with:

```
© 2026 Grey Assassins Guild, LLC    ·    Roadmap
```

The "Roadmap" link goes to `/do`. "Grey Assassins Guild, LLC" is the legal entity per Kevin's 2026-04-11 answer. Never show "Blackmoor" user-visibly.

## Implementation

### 1. Parser script — `scripts/build-do-page.mjs`

Runs as a prebuild step. Reads `TODO.md`, parses inline version tags, writes a static JSON artifact.

**Where:** `public/do.json` (accessible at runtime via `fetch('/do.json')` or, better, imported at module scope during server render).

**Schema:**

```ts
type DoPayload = {
  generated_at: string;              // ISO
  ladders: {
    shadow: DoLadder;
    common: DoLadder;
  };
};

type DoLadder = {
  [version: string]: DoFeature[];    // keyed by "v1", "v2", etc.
};

type DoFeature = {
  id: string;                        // stable hash of source line
  title: string;
  status: 'built' | 'in_progress' | 'planned' | 'deferred';
  source_line: number;
};
```

**Parser rules:**
- Walk `TODO.md` line-by-line.
- Match `- [ ]` or `- [x]` list items.
- Strip checkboxes and tags from the title.
- Extract `<!-- {ladder}-v{n} -->` for ladder + version assignment.
- Extract `<!-- in-progress -->` for status override.
- Extract `<!-- deferred -->` for status override.
- Untagged items are silently dropped (not shown on `/do`).
- If a tag is malformed (e.g. `<!-- common-v -->`), emit a build warning but don't fail the build.

### 2. Page — `app/do/page.tsx`

Server component. Imports the static JSON artifact. Renders two columns side-by-side.

- Responsive: `flex-col` on mobile, `flex-row` on `sm:` per DESIGN.md responsive conventions. Use inline `style={{ display: 'flex' }}` for flex because Tailwind v4 has known issues in Safari prod (per CLAUDE.md).
- No client JS needed. Pure server render.

### 3. Copyright footer — `app/layout.tsx`

Add a `<footer>` inside the existing layout. Styled to match the site aesthetic (warm brown, small caps, no intrusive border). Fixed at the bottom of the page content, not viewport-fixed.

### 4. Wire prebuild

`package.json` scripts section gains a `prebuild` step that runs the parser before `next build`. The dev server also gets a lightweight watcher so editing `TODO.md` triggers a JSON regeneration.

Actually — per Kevin's Q3 answer and the "one file" simplicity principle, let me simplify: **no prebuild step, no JSON artifact, no watcher.** Read `TODO.md` directly in the server component using `fs/promises` at module scope. Next.js caches it per build automatically. Much simpler, works fine for a small file.

Revised implementation:

- `app/do/page.tsx` reads `TODO.md` via `import { readFile } from 'node:fs/promises'` inside the page component.
- Parses it in-memory on server render. Result is cached by Next's build cache.
- No `scripts/` file, no `public/do.json`, no prebuild.

## Verification

- `npm run build` succeeds.
- `/do` renders both columns.
- At least one item per visible version shows.
- Mobile view at 375px stacks cleanly.
- Copyright footer appears on every page.
- `npx tsc --noEmit 2>&1 | grep -v ".next/types"` clean.
- Added `/do` link visible in footer.

## Non-goals

- No admin UI.
- No authentication.
- No DB.
- No tag auto-assignment — Kevin tags items as he decides their version.
- No date tracking per item in v1 (can add later if needed).

## Open questions

None blocking. Kevin's earlier concerns all resolved.
