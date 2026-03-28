---
title: "feat: NPC HP damage tracking with Long Rest reset"
type: feat
status: completed
date: 2026-03-27
---

# feat: NPC HP damage tracking with Long Rest reset

## Overview

Add persistent NPC HP tracking across combat encounters within a session, and a "Long Rest" button on the sessions page that resets all session NPCs to their originally rolled HP.

## Problem Frame

Currently, every time combat starts on the initiative page, each NPC gets a fresh HP roll. There is no way to carry damage across multiple encounters within a session. The DM wants NPCs to accumulate damage until they explicitly grant a long rest — matching how D&D actually works.

## Requirements Trace

- R1. Each NPC instance in a session has persistent HP that carries across combats
- R2. When combat starts, NPC HP comes from the menagerie (persisted state), not a fresh roll
- R3. The first time an NPC enters combat in a session, its HP is rolled fresh from `hp_roll` — that rolled value becomes its `maxHp`
- R4. HP changes during combat are written back to the session's menagerie
- R5. A green "Long Rest" button on the sessions page resets all session NPC HP to their `maxHp`, with confirmation
- R6. HP can only be reduced on the combat/initiative page

## Scope Boundaries

- NOT changing how NPCs are assigned to sessions (npc_ids remains the source of truth for which NPCs are in a session)
- NOT adding healing mechanics or spell-based HP restoration
- NOT persisting player HP (only NPCs)
- NOT changing the NPC page HP field (it remains the catalog value)

## Context & Research

### Relevant Code and Patterns

- `lib/types.ts:MenagerieEntry` — existing type `{ npc_id: string; hp: number }`. Needs `maxHp` and `label` fields added.
- `lib/types.ts:Session` — has `menagerie: MenagerieEntry[]` field, already typed and stored as JSONB.
- `lib/schema.ts` lines 162-166 — menagerie column already exists in the sessions table.
- `app/api/sessions/[id]/route.ts` — PATCH already supports `menagerie` as a JSONB column (line 12).
- `components/InitiativePageClient.tsx:handleGo` (lines 130-187) — builds combatants, currently rolls fresh HP per instance. This is where menagerie should be read/populated.
- `components/InitiativePageClient.tsx:updateCombatantHp` (lines 199-207) — modifies HP and calls `persistCombat` (localStorage). This is where menagerie writeback should happen.
- `components/DmSessionsClient.tsx` — sessions page with NpcCastingBoard. Long Rest button goes here.
- `app/dm/initiative/page.tsx` line 16 — session query only selects `id, number, title, npc_ids`. Needs `menagerie` added.
- `lib/useAutosave.ts` — debounced save hook, used by sessions page. Can be used for menagerie updates.

### Key Data Flow

```
Current:  NPC Page → roll hp → npcs.hp (catalog)
          Initiative → fresh roll each combat → localStorage only → lost on reset

Proposed: NPC Page → roll hp → npcs.hp (catalog, unchanged)
          Initiative (first combat) → fresh roll → menagerie[].hp + maxHp → DB
          Initiative (subsequent) → read menagerie[].hp → combat → write back to menagerie
          Sessions Page → Long Rest → menagerie[].hp = menagerie[].maxHp
```

## Key Technical Decisions

- **Menagerie as HP state layer**: `npc_ids` remains the source of truth for which NPCs are in a session. Menagerie stores per-instance combat state (current HP, max HP, display label). These are synced when combat starts.
- **Menagerie populated on first combat start, not on NPC assignment**: This keeps the NPC assignment flow simple (just toggle IDs) and avoids creating menagerie entries for NPCs that never see combat.
- **Positional matching for duplicates**: `menagerie[i]` corresponds to `npc_ids[i]`. When npc_ids changes between combats, the initiative page syncs menagerie — preserving existing entries and rolling fresh HP for new ones.
- **Write back HP on every change**: Rather than only syncing on combat end, write menagerie to the DB every time HP changes (via the session PATCH API). This prevents data loss if the browser crashes mid-combat.
- **MenagerieEntry gets `maxHp` and `label`**: `maxHp` is the initially rolled value (reset target for long rest). `label` stores the display name like "Goblin 2" for sessions-page readability.
- **Long Rest is per-session**: The button resets menagerie for the currently selected session only.

## Open Questions

### Resolved During Planning

- **Should HP be re-rolled each combat or persist?** Persist — user confirmed. First combat rolls fresh, subsequent combats use persisted HP.
- **What is the "original HP" for long rest?** The HP rolled the first time the NPC instance enters combat in that session, NOT the catalog HP from the NPC page.
- **Where should menagerie be populated?** On combat start (handleGo), not on NPC assignment. This keeps the sessions page simple.

### Deferred to Implementation

- **How to handle menagerie sync when npc_ids changes between combats**: The sync logic in handleGo needs to match existing menagerie entries to the current npc_ids. For duplicates of the same NPC, match in order. New NPCs get fresh rolls, removed NPCs are pruned. Exact matching logic deferred.
- **Should the Long Rest button be disabled when menagerie is empty?** Likely yes, but the exact UX detail is deferred.

## Implementation Units

- [x] **Unit 1: Extend MenagerieEntry type**

  **Goal:** Add `maxHp` and `label` fields to `MenagerieEntry` so menagerie can store the long-rest reset target and display-friendly names.

  **Requirements:** R1, R3

  **Dependencies:** None

  **Files:**
  - Modify: `lib/types.ts`

  **Approach:**
  - Add `maxHp: number` and `label: string` to the `MenagerieEntry` interface
  - Both fields are required — they're always set when menagerie entries are created
  - Existing empty menagerie arrays in the DB won't break (they have no entries to parse)

  **Patterns to follow:**
  - Existing `MenagerieEntry` interface structure

  **Test scenarios:**
  - Type compiles with new fields
  - Existing code that reads menagerie (currently minimal) doesn't break

  **Verification:**
  - `npx next build` succeeds

- [x] **Unit 2: Initiative page reads and populates menagerie**

  **Goal:** When combat starts, sync menagerie with npc_ids. Use existing menagerie HP for returning combatants; roll fresh HP for new entries. Save the populated menagerie back to the session.

  **Requirements:** R1, R2, R3

  **Dependencies:** Unit 1

  **Files:**
  - Modify: `app/dm/initiative/page.tsx` (add `menagerie` to session query and SessionMeta)
  - Modify: `components/InitiativePageClient.tsx` (handleGo logic, SessionMeta interface, props)

  **Approach:**
  - In `page.tsx`: add `menagerie` to the SQL SELECT and to `SessionMeta` type
  - In `InitiativePageClient.tsx`: update `SessionMeta` interface to include `menagerie: MenagerieEntry[]`
  - In `handleGo`: before building combatants, sync menagerie with npc_ids:
    - Build a new menagerie array matching the current npc_ids
    - For each npc_id at position i: if an existing menagerie entry matches (same npc_id, in order), reuse its hp/maxHp/label
    - For new entries: roll HP from `hp_roll` (or parse `npc.hp`), set both `hp` and `maxHp` to the rolled value, generate label (e.g., "Goblin 2")
    - Use the synced menagerie to set combatant `hp` and `maxHp` (instead of rolling fresh)
  - After building combatants, PATCH the session's menagerie to the DB via `fetch('/api/sessions/{id}', { method: 'PATCH', body: { menagerie } })`
  - Store the session ID in component state so HP writeback (Unit 3) knows which session to update

  **Patterns to follow:**
  - Existing `handleGo` NPC instance counting and naming logic (lines 146-171)
  - Session PATCH API pattern used by `DmSessionsClient`

  **Test scenarios:**
  - First combat: all NPC instances get fresh HP rolls, menagerie is saved to DB
  - Second combat (same session): NPC HP comes from menagerie, not re-rolled
  - New NPC added between combats: gets fresh HP, existing NPCs keep damaged HP
  - NPC removed between combats: its menagerie entry is pruned
  - Duplicate NPCs (3 goblins): each gets own menagerie entry with own HP

  **Verification:**
  - Start combat → check DB menagerie has entries with hp, maxHp, label
  - Reset combat → start again → HP values match menagerie (not re-rolled)

- [x] **Unit 3: Initiative page writes back HP changes to menagerie**

  **Goal:** When NPC HP changes during combat, update the session's menagerie in the database so damage persists.

  **Requirements:** R4, R6

  **Dependencies:** Unit 2

  **Files:**
  - Modify: `components/InitiativePageClient.tsx`

  **Approach:**
  - In `updateCombatantHp`: after updating local state and localStorage, also update the menagerie
  - Maintain a `menagerieRef` (useRef) that tracks the current menagerie state — updated whenever HP changes
  - On HP change: find the corresponding menagerie entry (match by combatant ID pattern `npcId-instanceNum`), update its `hp`, then PATCH the session with the new menagerie
  - Debounce the PATCH to avoid excessive API calls (500ms debounce, or batch with existing `persistCombat`)
  - Only write back NPC combatants, not players

  **Patterns to follow:**
  - `persistCombat` for localStorage persistence pattern
  - `useAutosave` debouncing pattern (though simpler here — just a timeout)

  **Test scenarios:**
  - Reduce NPC HP by 3 → menagerie entry hp updated in DB
  - Multiple rapid HP changes → debounced to single API call
  - Player HP changes → no menagerie update (players aren't in menagerie)
  - Browser crash after HP change → menagerie in DB reflects last saved state

  **Verification:**
  - Damage an NPC → check DB menagerie → hp reflects damage
  - Reload page → start new combat → NPC starts at damaged HP

- [x] **Unit 4: Long Rest button on sessions page**

  **Goal:** Add a green "Long Rest" button to the sessions page that resets all session NPC HP to their maxHp with confirmation.

  **Requirements:** R5

  **Dependencies:** Unit 1 (uses extended MenagerieEntry)

  **Files:**
  - Modify: `components/DmSessionsClient.tsx`

  **Approach:**
  - Add a "Long Rest" button near the NPC Casting Board section (after the assigned NPCs display)
  - Style: green background/border matching the design system's warm palette (e.g., `bg-[#2d4a2d]` border `border-[#4a7a4a]`), font-serif, uppercase tracking
  - On click: show a confirmation dialog (browser `confirm()` or a styled modal matching the aesthetic — start with `confirm()` for simplicity)
  - On confirm: map over the session's menagerie, setting each entry's `hp = maxHp`
  - Save via `autosave({ menagerie: updatedMenagerie })`
  - Update local session state so the UI reflects the reset
  - Track menagerie in component state (add `useState<MenagerieEntry[]>` alongside `npcIds`)
  - Load menagerie from session on select (in `handleSelect`)
  - Button should be disabled/hidden when menagerie is empty (no combat has happened yet)
  - Optionally show a brief HP summary near assigned NPCs so the DM can see current damage state

  **Patterns to follow:**
  - `handleNpcToggle` for autosave + session state update pattern
  - `handleSelect` for loading session data into local state
  - NpcCastingBoard styling for consistent UI

  **Test scenarios:**
  - Click Long Rest → confirm → all NPC HP reset to maxHp in DB
  - Click Long Rest → cancel → no changes
  - Long Rest when menagerie is empty → button disabled/hidden
  - After Long Rest → start combat → NPCs have full HP
  - Long Rest only affects the selected session, not others

  **Verification:**
  - Damage NPCs in combat → go to sessions page → click Long Rest → confirm
  - Start new combat → all NPCs at full HP
  - Check DB → menagerie hp values match maxHp for all entries

## System-Wide Impact

- **Initiative page data loading**: The session query gains a `menagerie` column — small SQL change, no performance concern.
- **Session PATCH API**: Already supports menagerie as JSONB. No API changes needed.
- **Combat localStorage**: Still used for turn order, round tracking, and within-combat state. Menagerie is the cross-combat persistence layer.
- **SessionForm.tsx**: Currently uses menagerie for its own purposes. Need to verify it doesn't conflict — the menagerie entries it creates may lack maxHp/label. Should be fine since SessionForm is a separate component with its own session management.

## Risks & Dependencies

- **hp_roll backfill dependency**: NPCs created before the SRD auto-fill feature may have empty `hp_roll`. The recently implemented backfill (plan 002) addresses this. If an NPC has neither `hp_roll` nor `hp`, the menagerie entry falls back to `hp: 0` — the DM would need to set HP manually on the NPC page first.
- **Menagerie positional sync with duplicates**: If the DM rearranges npc_ids order (unlikely with current UI), menagerie entries could get mismatched. The positional approach is simple but not bulletproof. Acceptable for current usage patterns.
- **Concurrent sessions**: If the DM has the sessions page and initiative page open simultaneously, menagerie updates from the initiative page won't be reflected on the sessions page in real-time. Acceptable for single-DM usage — a page refresh will show current state.

## Sources & References

- Related code: `lib/types.ts`, `components/InitiativePageClient.tsx`, `components/DmSessionsClient.tsx`, `app/dm/initiative/page.tsx`
- Related plan: `docs/plans/2026-03-27-002-fix-npc-hp-dice-roll-plan.md` (hp_roll backfill dependency)
