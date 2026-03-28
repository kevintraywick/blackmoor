---
title: "fix: NPC HP dice roll fails for suffixed/legacy creatures"
type: fix
status: active
date: 2026-03-27
---

# fix: NPC HP dice roll fails for suffixed/legacy creatures

## Overview

The dice button on the NPC page silently does nothing for many creatures (Orc, Wolf Skeleton_2, Ettercap_4, etc.) because their `hp_roll` field is empty in the database. These NPCs were created before the SRD auto-fill feature was added to `handleNameChange`. Additionally, `lookupSrd` has a match-priority bug where "Wolf Skeleton" matches "wolf" instead of "skeleton".

## Problem Frame

When the DM clicks the dice button to roll initial HP for an NPC, `handleRollHp` reads `values.hp_roll`. If empty, it silently returns. NPCs created before the SRD auto-fill feature have empty `hp_roll` — the only way to populate it today is to clear the name field and re-type it (non-obvious) or manually type the formula (requires SRD knowledge).

## Requirements Trace

- R1. Existing NPCs with empty `hp_roll` should be backfilled from SRD on next schema init
- R2. `lookupSrd` should strip `_N` suffixes and prefer the most specific match (endsWith before startsWith)
- R3. The dice button should attempt SRD lookup as a fallback when `hp_roll` is empty, rather than silently failing

## Scope Boundaries

- NOT adding new creatures to the SRD list
- NOT changing the dice notation parser (`lib/dice.ts`)
- NOT modifying how `handleNameChange` auto-fills on NPC creation (it already works correctly for new NPCs)

## Context & Research

### Relevant Code and Patterns

- `lib/srd-hp.ts:lookupSrd` — two-tier matching: exact key, then `startsWith`/`endsWith` partial. No suffix stripping.
- `lib/npc-images.ts:lookupNpcImage` — normalizes with `toCreatureSlug()` which strips non-alphanumeric chars. Has same `startsWith`/`endsWith` partial matching. Used as pattern reference.
- `lib/schema.ts` lines 227-238 — `image_path` backfill: selects NPCs with empty field, calls lookup function, updates matches. Idempotent. Runs once per process via `ensureSchema()`.
- `components/NpcPageClient.tsx:handleRollHp` (line 63) — reads `values.hp_roll`, returns early if empty, calls `rollDice()`.
- `components/NpcPageClient.tsx:handleDuplicate` (line 119) — copies `hp_roll` from source to duplicate. Duplicates of NPCs with empty `hp_roll` also get empty `hp_roll`.

### Match Priority Bug

`lookupSrd("Wolf Skeleton")` returns wolf (2d8+2) instead of skeleton (2d8+4) because `Object.entries` iteration hits "wolf" before "skeleton" via `startsWith`. The creature's base type is "skeleton" — D&D naming convention is `[Modifier] [BaseCreature]`, so `endsWith` should take priority.

## Key Technical Decisions

- **Strip `_N` suffix in `lookupSrd`**: Use the same `/_\d+$/` pattern already used by `incrementedName` in `NpcPageClient.tsx`. Strip before any matching.
- **Prefer endsWith over startsWith**: Reverting partial match order to try `endsWith` first handles "Wolf Skeleton" → "skeleton" correctly. This matches D&D naming convention where the base creature comes last.
- **Prefer longest match**: Among partial matches, prefer the longest creature key. This prevents "bat" from matching before "giant bat" when the name is "giant bat rider".
- **Backfill follows image_path pattern exactly**: Same query structure, same idempotent guard, same per-row loop.
- **Dice button fallback**: When `hp_roll` is empty, `handleRollHp` should call `lookupSrd(values.name)`. If a match is found, set `hp_roll` AND roll — so the formula persists for future rolls.

## Open Questions

### Resolved During Planning

- **Should the backfill also fill AC/speed/CR?** No — only `hp_roll` is broken. The other fields are likely already manually set by the DM for existing NPCs. Overwriting them would be destructive.
- **Should `lookupNpcImage` get the same suffix-stripping fix?** No — it already normalizes via `toCreatureSlug()` which strips underscores. It works correctly as-is.

### Deferred to Implementation

- **Exact match behavior for multi-word creatures with suffixes**: e.g., "Fire Giant_2" — after stripping suffix becomes "fire giant" which should exact-match. Verify this works after the change.

## Implementation Units

- [ ] **Unit 1: Improve `lookupSrd` matching**

  **Goal:** Strip `_N` suffixes, prefer endsWith over startsWith, and prefer longest match among partial matches.

  **Requirements:** R2

  **Dependencies:** None

  **Files:**
  - Modify: `lib/srd-hp.ts`

  **Approach:**
  - At the start of `lookupSrd`, strip trailing `_N` suffix from the normalized key using `replace(/_\d+$/, '')`
  - Keep exact match as first priority (now works for "Ettercap_4" → "ettercap")
  - For partial matching: collect all matches (both startsWith and endsWith), then pick the longest key. If ties, prefer endsWith match. This handles "Wolf Skeleton" → "skeleton" (endsWith, 8 chars) over "wolf" (startsWith, 4 chars) correctly
  - Also handles edge cases like "Giant Spider_3" → exact match "giant spider" after suffix strip

  **Patterns to follow:**
  - `incrementedName` in `NpcPageClient.tsx` uses the same `/_\d+$/` suffix pattern
  - `lookupNpcImage` in `npc-images.ts` for the general partial-matching approach

  **Test scenarios:**
  - "Orc" → exact match → "2d8+6"
  - "Ettercap_4" → strip suffix → exact match "ettercap" → "8d8+8"
  - "Wolf Skeleton_2" → strip suffix → "wolf skeleton" → endsWith "skeleton" → "2d8+4"
  - "Goblin Archer" → no suffix → startsWith "goblin" → "2d6"
  - "Giant Spider_3" → strip suffix → exact match "giant spider" → "4d10+4"
  - "Unknown Creature" → no match → undefined
  - "Adult Red Dragon" → exact match → correct stats

  **Verification:**
  - All test cases above return expected results when run manually with `npx tsx`

- [ ] **Unit 2: Backfill `hp_roll` in schema**

  **Goal:** Populate `hp_roll` for existing NPCs that have empty values, using the improved `lookupSrd`.

  **Requirements:** R1

  **Dependencies:** Unit 1 (uses improved lookupSrd)

  **Files:**
  - Modify: `lib/schema.ts`

  **Approach:**
  - Add a backfill block after the existing `image_path` backfill (after line 238)
  - Follow the exact same pattern: SELECT npcs with empty `hp_roll`, loop, call `lookupSrd(name)`, UPDATE if match found
  - Also backfill `ac`, `speed`, and `cr` only when they are currently empty — don't overwrite DM-entered values
  - Import `lookupSrd` from `lib/srd-hp`

  **Patterns to follow:**
  - Lines 227-238 of `lib/schema.ts` (image_path backfill) — identical structure

  **Test scenarios:**
  - NPC "Orc" with empty hp_roll → backfilled to "2d8+6"
  - NPC "Ettercap_4" with empty hp_roll → backfilled to "8d8+8"
  - NPC "Custom Monster" with empty hp_roll, no SRD match → unchanged
  - NPC "Goblin" with hp_roll already set to "3d6" → not overwritten
  - Backfill is idempotent — running twice produces the same result

  **Verification:**
  - After restart, NPCs that match SRD have populated `hp_roll` fields
  - Existing manually-entered `hp_roll` values are unchanged

- [ ] **Unit 3: Dice button SRD fallback**

  **Goal:** When the dice button is clicked and `hp_roll` is empty, attempt SRD lookup before giving up.

  **Requirements:** R3

  **Dependencies:** Unit 1 (uses improved lookupSrd)

  **Files:**
  - Modify: `components/NpcPageClient.tsx`

  **Approach:**
  - In `handleRollHp`, when `formula` (hp_roll) is empty, call `lookupSrd(values.name)`
  - If SRD returns a match: set `hp_roll` to the formula (via `handleChange`), then roll and set `hp`
  - This means the first click populates both `hp_roll` and `hp`, and subsequent clicks just roll
  - If no SRD match either, remain silent (no change from current behavior)

  **Patterns to follow:**
  - `handleNameChange` in same file — same pattern of calling `lookupSrd` and patching multiple fields

  **Test scenarios:**
  - Click dice on NPC "Orc" with empty hp_roll → hp_roll set to "2d8+6", hp set to rolled value
  - Click dice on NPC with hp_roll already "3d6+2" → normal roll, hp_roll unchanged
  - Click dice on NPC "Unknown Thing" with empty hp_roll → nothing happens (no SRD match)
  - After first click populates hp_roll, second click rolls normally

  **Verification:**
  - Dice button works for all SRD-matched creatures regardless of whether hp_roll was pre-populated

## System-Wide Impact

- **Schema migration**: The backfill runs on next server start. It's idempotent and only fills empty fields — no risk to existing data.
- **`lookupSrd` callers**: Used by `handleNameChange` (NPC creation), `handleRollHp` (dice button), and now schema backfill. The suffix-stripping and match-priority changes improve all callers.
- **Initiative page**: `InitiativePageClient.tsx` calls `rollDice(n.hp_roll)` directly — if `hp_roll` is now populated via backfill, initiative HP rolling also improves.

## Risks & Dependencies

- **Match priority change could affect existing auto-fills**: If a DM creates "Wolf Archer", it currently matches "wolf". After the change, it would still match "wolf" via startsWith (no endsWith match for "wolf archer"). The change only affects cases where endsWith produces a longer match than startsWith. This is the correct behavior for D&D naming.

## Sources & References

- Related code: `lib/srd-hp.ts`, `lib/schema.ts`, `components/NpcPageClient.tsx`
- Pattern reference: `lib/npc-images.ts:lookupNpcImage` for suffix handling
