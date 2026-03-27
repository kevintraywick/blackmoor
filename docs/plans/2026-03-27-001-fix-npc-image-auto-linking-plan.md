---
title: "fix: Auto-link NPC images from public/images/NPCs/"
type: fix
status: active
date: 2026-03-27
---

# fix: Auto-link NPC images from public/images/NPCs/

## Overview

NPC images in `public/images/NPCs/` are never auto-linked when creating or naming NPCs. The SRD lookup auto-fills stats (HP, AC, speed, CR) but ignores `image_path`. This means NPCs like "Orc" show a letter fallback even though `orc.png` exists. Names with spaces or mixed case (e.g. "Flame Skull") don't resolve to their filename (`flameskull.png`).

## Problem Frame

The DM creates an NPC called "Orc". Stats auto-fill from the SRD. But the portrait stays blank because `image_path` is never set — despite `public/images/NPCs/orc.png` existing. The DM must manually type `images/NPCs/orc.png` into a text field, which is error-prone and easy to forget. Compound names like "Flame Skull" are worse — the file is `flameskull.png` (no space), so even a manual attempt often 404s.

## Requirements Trace

- R1. When a new NPC is named and a matching image exists in `public/images/NPCs/`, `image_path` should auto-populate
- R2. Name normalization must handle spaces, underscores, and mixed case ("Flame Skull" -> "flameskull", "Giant Spider" -> "giant_spider")
- R3. Auto-link must not overwrite a manually set or uploaded `image_path`
- R4. Adding a new PNG to `public/images/NPCs/` should require zero code changes — just drop the file and rebuild
- R5. Existing NPCs with null `image_path` that match an image file should be backfilled

## Scope Boundaries

- No UI changes to the image_path text field or portrait picker
- No fuzzy/Levenshtein matching — slug normalization is sufficient for the naming conventions in use
- No runtime filesystem reads — the manifest is build-time only
- No changes to the upload flow (UUID-based uploads are unaffected)

## Context & Research

### Relevant Code and Patterns

- `lib/srd-hp.ts` — `SRD_CREATURES` record and `lookupSrd()` normalization pattern (trim + lowercase + partial match)
- `components/NpcPageClient.tsx:194-209` — `handleNameChange()` where SRD auto-fill happens; the patch/autosave pattern to mirror
- `lib/imageUrl.ts` — `resolveImageUrl()` expects paths like `images/NPCs/orc.png`
- `lib/schema.ts` — `ensureSchema()` runs inline migrations on boot; backfill SQL goes here
- `public/images/NPCs/` — 10 files, naming: lowercase, underscores for spaces, `.png`

### Institutional Learnings

- Images must be committed to git before Railway serves them — the manifest only references committed files, so this is naturally safe

## Key Technical Decisions

- **Build-time manifest over SRD extension**: At 100+ images, a generated manifest scales without manual edits. A prebuild script scans the folder and emits a TS module.
- **Slug normalizer as shared utility**: Both the manifest lookup and `lookupSrd` need the same normalization. Centralizing it prevents divergence.
- **Backfill in ensureSchema()**: The project already uses inline migrations here. A one-time `UPDATE` with a subquery is idempotent and runs on next deploy.
- **Numbered variants (e.g. `ettercap2.png`) are included in the manifest**: They map to slug `ettercap2`, which won't match a plain "Ettercap" name. This is correct — numbered variants are for manual assignment to specific NPC instances, not auto-linking.
- **Partial matching for images**: Mirror `lookupSrd`'s partial-match behavior. "Goblin Archer" should match `goblin.png` if no `goblin_archer.png` exists. Exact match takes priority.

## Open Questions

### Resolved During Planning

- **Q: Where does the manifest generator live?** A: `scripts/generate-npc-image-manifest.ts`, run via a modified `build` script in `package.json`. This keeps it separate from application code.
- **Q: What format for the manifest?** A: A TS file exporting `Record<string, string>` mapping normalized slug to relative path (e.g. `{ "flameskull": "images/NPCs/flameskull.png" }`). Importable by both client and server code.
- **Q: Should the backfill run every boot or once?** A: Every boot is fine — the UPDATE is idempotent (`WHERE image_path IS NULL OR image_path = ''`) and the manifest is small. It self-heals if new images are added.

### Deferred to Implementation

- Exact slug normalization edge cases (hyphens, apostrophes in creature names) — handle as discovered
- Whether `wolf_skeleton.png` matches any SRD creature — may be a custom creature with no auto-link target

## Implementation Units

- [ ] **Unit 1: Slug normalizer utility**

  **Goal:** Create a shared function that normalizes creature names to filename slugs.

  **Requirements:** R2

  **Dependencies:** None

  **Files:**
  - Create: `lib/npc-images.ts`

  **Approach:**
  - Export `toCreatureSlug(name: string): string` — trims, lowercases, strips non-alphanumeric characters except underscores
  - Two normalization variants needed: one that strips all separators (`flameskull`), one that preserves underscores (`giant_spider`). The manifest stores both forms as keys pointing to the same path.
  - Follow the naming and export conventions of `lib/imageUrl.ts`

  **Patterns to follow:**
  - `lookupSrd` normalization in `lib/srd-hp.ts:345`

  **Test scenarios:**
  - "Flame Skull" -> "flameskull"
  - "Giant Spider" -> "giantspider" (and also matches "giant_spider" via underscore-stripped key)
  - "Orc" -> "orc"
  - "  Goblin  " -> "goblin" (whitespace trimming)

  **Verification:**
  - The function is importable and handles all filename patterns in `public/images/NPCs/`

- [ ] **Unit 2: Build-time manifest generator**

  **Goal:** Auto-generate a typed image manifest from the filesystem at build time.

  **Requirements:** R1, R4

  **Dependencies:** Unit 1

  **Files:**
  - Create: `scripts/generate-npc-image-manifest.ts`
  - Create: `lib/npc-image-manifest.ts` (generated, gitignored — or committed; see approach)
  - Modify: `package.json` (build script)

  **Approach:**
  - The script reads `public/images/NPCs/`, strips extensions, generates both slug variants (with and without underscores) as keys, and writes `lib/npc-image-manifest.ts`
  - The generated file exports a `Record<string, string>` — keys are normalized slugs, values are relative paths like `images/NPCs/flameskull.png`
  - For `giant_spider.png`, the manifest contains both `"giantspider"` and `"giant_spider"` pointing to the same path
  - Modify `package.json` build script: `"build": "tsx scripts/generate-npc-image-manifest.ts && next build"`
  - Also add to dev script so it runs on dev startup
  - The generated file should be committed so Railway builds don't need `tsx` at build time — alternatively, add `tsx` as a dev dependency. Decide during implementation based on what's simpler.

  **Patterns to follow:**
  - `SRD_CREATURES` record structure in `lib/srd-hp.ts`

  **Test scenarios:**
  - Script produces valid TypeScript when run against current `public/images/NPCs/`
  - `giant_spider.png` produces entries for both `giantspider` and `giant_spider`
  - `ettercap2.png` produces entry for `ettercap2` (does not collide with `ettercap`)
  - Empty directory produces empty record

  **Verification:**
  - Running the script produces `lib/npc-image-manifest.ts` with correct entries for all 10 current files
  - `next build` succeeds with the modified build command

- [ ] **Unit 3: Auto-link image in handleNameChange**

  **Goal:** When the DM names an NPC and a matching image exists, auto-set `image_path`.

  **Requirements:** R1, R2, R3

  **Dependencies:** Unit 1, Unit 2

  **Files:**
  - Modify: `components/NpcPageClient.tsx`
  - Modify: `lib/npc-images.ts` (add lookup function)

  **Approach:**
  - Add `lookupNpcImage(name: string): string | undefined` to `lib/npc-images.ts` — normalizes the name with `toCreatureSlug`, looks up in the manifest, returns the path or undefined
  - Mirror `lookupSrd`'s partial-match pattern: exact slug match first, then check if any manifest key starts with or ends with the slug
  - In `handleNameChange`, after the SRD stat patch block, add a separate image check: if `!values.image_path`, call `lookupNpcImage(value)` and add `image_path` to the patch if found
  - The image check should run independently of the SRD match — an NPC named "Wolf Skeleton" might have an image but no SRD stats
  - Guard: only set `image_path` when it's currently empty/null, matching the existing `if (!values.hp_roll)` guard pattern

  **Patterns to follow:**
  - The existing SRD patch block in `handleNameChange` (lines 197-208)
  - The `if (!values.ac) patch.ac = match.ac` conditional pattern

  **Test scenarios:**
  - Type "Orc" -> `image_path` auto-set to `images/NPCs/orc.png`
  - Type "Flame Skull" -> `image_path` auto-set to `images/NPCs/flameskull.png`
  - Type "Giant Spider" -> `image_path` auto-set to `images/NPCs/giant_spider.png`
  - Type "Goblin Archer" -> `image_path` auto-set to `images/NPCs/goblin.png` (partial match)
  - Type "Dragon" -> no image set (no matching file)
  - NPC already has uploaded image -> auto-link skipped (R3)

  **Verification:**
  - Creating a new NPC named "Orc" shows the orc portrait immediately
  - Renaming an NPC to "Flame Skull" shows the flameskull portrait
  - Uploading a custom image and then renaming does not overwrite the upload

- [ ] **Unit 4: Backfill existing NPCs**

  **Goal:** Set `image_path` on existing NPCs whose names match image files.

  **Requirements:** R5

  **Dependencies:** Unit 1, Unit 2

  **Files:**
  - Modify: `lib/schema.ts` (add backfill in `ensureSchema()`)

  **Approach:**
  - Import the manifest and `toCreatureSlug` in `schema.ts`
  - After existing migrations, run an idempotent backfill: for each manifest entry, `UPDATE npcs SET image_path = $path WHERE LOWER(REPLACE(name, ' ', '')) = $slug AND (image_path IS NULL OR image_path = '')`
  - This runs on every boot but only affects rows with empty `image_path`, so it's safe to repeat
  - Consider also matching underscore-stripped names for compound creatures

  **Patterns to follow:**
  - Existing `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` pattern in `ensureSchema()`

  **Test scenarios:**
  - Existing NPC named "Orc" with null `image_path` gets updated to `images/NPCs/orc.png`
  - Existing NPC named "Flame Skull" with null `image_path` gets updated to `images/NPCs/flameskull.png`
  - Existing NPC with a manually set `image_path` is not overwritten
  - Existing NPC with an uploaded image path (`uploads/npcs/...`) is not overwritten

  **Verification:**
  - After server restart, previously imageless NPCs matching known filenames show portraits

## System-Wide Impact

- **Session menagerie:** NPCs created from catalog entries already copy `image_path` — once catalog NPCs are backfilled or auto-linked, menagerie copies inherit the image automatically. No changes needed.
- **Player view:** Player sheets reference `image_path` for NPC display — auto-linked images will appear there too with no changes.
- **Build pipeline:** Adding `tsx` to the build step means Railway needs it available. Verify `tsx` is in `devDependencies` or `dependencies`.

## Risks & Dependencies

- **`tsx` availability on Railway:** The build script needs `tsx` to run TypeScript. If Railway only installs `dependencies` (not `devDependencies`), the script may fail. Mitigation: check Railway's nixpacks config; if needed, move `tsx` to `dependencies` or write the script in plain JS.
- **Manifest staleness in dev:** If the DM adds images during development without restarting the dev server, the manifest won't update. Mitigation: the manifest regenerates on every `next dev` start, which is frequent enough for this use case.

## Sources & References

- Ideation: conversation above (2026-03-27)
- Key code: `lib/srd-hp.ts`, `components/NpcPageClient.tsx`, `lib/schema.ts`
