---
title: "feat: Redesign inventory Create Item as type-specific item cards"
type: feat
status: active
date: 2026-04-01
---

# feat: Redesign inventory Create Item as type-specific item cards

## Overview

Replace the generic Create Item form with type-specific item cards that match 5e D&D conventions. The DM selects an item type (Magic Item, Scroll, or Spell) and the card shows fields appropriate to that type. Layout is vertical like a trading card: image at top, title, type-specific fields, description, then stat/price row at bottom. Direct input fields, not +/- steppers.

## Problem Frame

The current form is a generic blob — one stat type, one stat value, no structure. D&D items have distinct categories with different properties. A magic weapon needs attack/damage bonuses and rarity. A scroll needs a spell level. A spell needs level, school, range, components. The form should reflect what the DM is actually creating.

The critique identified that +/- steppers are wrong for initial data entry (the DM types "4", not taps + four times), and that borrowing two different PlayerSheet patterns created visual incoherence. The item card metaphor — a vertical card you'd find in a DM's binder — is a better fit.

## Requirements Trace

- R1. Three item types: Magic Item, Scroll, Spell — each with type-appropriate 5e fields
- R2. Items support independent attack, damage, and heal integer values (Magic Items only)
- R3. Vertical card layout: image → title → type fields → description → stat/price bottom row
- R4. Direct input fields (type a number), not +/- steppers for initial entry
- R5. Drop image circle preserved, centered at card top
- R6. Grid display adapts to show relevant badges per item type
- R7. Backward-compatible with existing items (old stat_type/stat_value columns preserved)
- R8. Test with magic dagger: image magic_dagger.png, Magic Item type, +4 ATK, +3 DMG, rarity Uncommon, description "A short dagger with attack bonuses and damage to undead"

## Scope Boundaries

- No marketplace page changes
- No player-facing item display changes
- No item editing — create only (edit form can adopt the same card in a later pass)
- Mundane items (no type) out of scope for now — all items are one of the three types

## Key Technical Decisions

- **Item type column:** Add `item_type TEXT CHECK (item_type IN ('magic_item', 'scroll', 'spell'))` to items table. Required field on the form.
- **Separate stat columns:** Replace single `stat_type`/`stat_value` with `attack INTEGER DEFAULT 0`, `damage INTEGER DEFAULT 0`, `heal INTEGER DEFAULT 0`. Only shown for Magic Items.
- **Type-specific columns:** Add `rarity TEXT`, `attunement BOOLEAN DEFAULT false` (Magic Items), `level INTEGER` (Scrolls + Spells), `school TEXT` (Spells), `casting_time TEXT`, `range TEXT`, `components TEXT`, `duration TEXT` (Spells).
- **Direct input:** All numeric fields are plain text inputs the DM types into. No +/- buttons on the creation form. The grid/display can use +/- for live adjustments later if needed.
- **Card as physical object:** Styled with a subtle border, warm background, and vertical flow — like a card from a DM's binder, not a SaaS form.

## Type-Specific Card Fields

### Magic Item
```
[  Drop Image  ]
     Title
 Rarity: [Uncommon ▾]  Attunement: [✓]
 Description: [.........................]
 ATK [4]   DMG [3]   HEAL [0]   Price [25g]
```
- **Rarity**: Common, Uncommon, Rare, Very Rare, Legendary (radio buttons or visible selector — no dropdown per DESIGN.md)
- **Attunement**: Toggle (yes/no)
- **ATK / DMG / HEAL**: Direct integer inputs, 0 = not applicable
- **Price**: Integer with gold coin icon

### Scroll
```
[  Drop Image  ]
     Title
 Spell Level: [3]   School: [Evocation]
 Description: [.........................]
 Price [150g]
```
- **Spell Level**: 0-9 integer input (0 = cantrip)
- **School**: Abjuration, Conjuration, Divination, Enchantment, Evocation, Illusion, Necromancy, Transmutation (visible selector)
- **Price**: Integer with gold coin icon
- No ATK/DMG/HEAL (scrolls cast a spell, they don't grant stat bonuses)

### Spell
```
[  Drop Image  ]
     Title
 Level: [2]   School: [Evocation]
 Casting Time: [1 action]   Range: [120 ft]
 Components: [V, S, M]   Duration: [Instantaneous]
 Description: [.........................]
 Price [0g]
```
- **Level**: 0-9 (0 = cantrip)
- **School**: Same 8 options as Scroll
- **Casting Time, Range, Components, Duration**: Free text inputs (5e has too many variations to enumerate)
- **Price**: Usually 0 for known spells, but could be a purchase price at a shop

## Context & Research

### Relevant Code and Patterns

- `components/PlayerSheet.tsx` — `fi` class for transparent-bg field styling
- `components/PlayerSheet.tsx` — `Stat` component for label + value pattern (reference only — not using +/- on create form)
- `components/InventoryCreateForm.tsx` — Current form (full rewrite)
- `components/InventoryItemGrid.tsx` — Grid display (needs type-aware badges)
- `app/api/items/route.ts` — POST handler (needs new columns)
- `lib/schema.ts` — DDL (needs ALTER TABLE)
- DESIGN.md — No dropdowns, no hidden controls, radio-style selectors
- DESIGN.md — Color: gold (spell), brown (scroll), purple (magic item) — existing magic category colors

## Implementation Units

- [ ] **Unit 1: Schema — add item_type and type-specific columns**

  **Goal:** Add all new columns to the items table

  **Requirements:** R1, R2, R7

  **Dependencies:** None

  **Files:**
  - Modify: `lib/schema.ts`

  **Approach:**
  - Add `item_type TEXT` (no CHECK constraint in ALTER — add via app validation)
  - Add `attack INTEGER DEFAULT 0`, `damage INTEGER DEFAULT 0`, `heal INTEGER DEFAULT 0`
  - Add `rarity TEXT`, `attunement BOOLEAN DEFAULT false`
  - Add `level INTEGER`, `school TEXT`
  - Add `casting_time TEXT`, `range TEXT`, `components TEXT`, `duration TEXT`
  - Keep old `stat_type`/`stat_value` columns
  - All via `ADD COLUMN IF NOT EXISTS` with `.catch(() => {})`

  **Patterns to follow:**
  - Existing ALTER TABLE pattern in schema.ts

  **Verification:**
  - All new columns present after dev server restart

- [ ] **Unit 2: API — accept type-specific fields**

  **Goal:** Update POST /api/items to handle all new fields by item_type

  **Requirements:** R1, R2

  **Dependencies:** Unit 1

  **Files:**
  - Modify: `app/api/items/route.ts`
  - Modify: `components/InventoryItemGrid.tsx` (Item interface)

  **Approach:**
  - Parse `item_type` from formData, validate against allowed types
  - Parse type-specific fields: attack/damage/heal/rarity/attunement for magic_item, level/school for scroll, level/school/casting_time/range/components/duration for spell
  - Add all to INSERT (null for fields not relevant to the type)
  - Update Item interface to include all new fields

  **Verification:**
  - POST with item_type=magic_item and attack=4 stores correctly
  - POST with item_type=scroll and level=3 stores correctly

- [ ] **Unit 3: Item card form — type selector + type-specific cards**

  **Goal:** Rewrite InventoryCreateForm as a vertical item card with type selection

  **Requirements:** R1, R3, R4, R5

  **Dependencies:** Unit 2

  **Files:**
  - Modify: `components/InventoryCreateForm.tsx`

  **Approach:**
  - **Type selector at top:** Three visible buttons (Magic Item / Scroll / Spell) using existing magic category colors — purple for magic item, brown for scroll, gold for spell. Radio-style per DESIGN.md.
  - **Card body:** Vertical flow with subtle border and warm bg. Image circle centered at top, title below as serif inline field, then type-specific fields, description textarea, stat/price row at bottom.
  - **All inputs are direct:** DM types values, no +/- steppers. Small labeled fields matching the `fi` pattern.
  - **Rarity selector:** Visible radio buttons (5 options in a row). Not a dropdown.
  - **School selector:** 8 visible buttons in a row or 2×4 grid. Not a dropdown.
  - **Attunement:** Toggle circle (green fill when active, per DESIGN.md radio-style).
  - **Submit:** Gold + circle, top-right of card.

  **Patterns to follow:**
  - PlayerSheet `fi` class for field styling
  - DESIGN.md radio-style selectors for rarity/school/type
  - DESIGN.md magic category colors for type badges

  **Verification:**
  - Selecting Magic Item shows ATK/DMG/HEAL + Rarity + Attunement fields
  - Selecting Scroll shows Level + School fields
  - Selecting Spell shows Level + School + Casting Time + Range + Components + Duration
  - Form submits all values correctly per type

- [ ] **Unit 4: Grid — type-aware badges and stat display**

  **Goal:** Update grid circles to show type badge + relevant stat badges

  **Requirements:** R6, R7

  **Dependencies:** Unit 2

  **Files:**
  - Modify: `components/InventoryItemGrid.tsx`

  **Approach:**
  - Show item type as a small colored badge (using magic category colors from DESIGN.md)
  - For magic items with multiple non-zero stats, show a compact stat line under the item name instead of trying to fit multiple badges on the circle
  - Fall back to old stat_type/stat_value when item_type is null (backward compat)

  **Patterns to follow:**
  - Existing badge positioning in InventoryItemGrid.tsx
  - DESIGN.md magic category colors

  **Verification:**
  - Magic dagger shows purple "magic item" badge + stat line "ATK +4 · DMG +3"
  - Old items without item_type still display correctly
  - Scrolls show brown badge + level
  - Spells show gold badge + level

- [ ] **Unit 5: Test with magic dagger example**

  **Goal:** Create test item and verify full flow

  **Requirements:** R8

  **Dependencies:** Units 1-4

  **Files:**
  - Uses: `public/images/marketplace/magic_dagger.png`

  **Approach:**
  - Select Magic Item type
  - Upload magic_dagger.png image
  - Title: "Magic Dagger", Rarity: Uncommon, Attunement: No
  - ATK: 4, DMG: 3, HEAL: 0, Price: 25
  - Description: "A short dagger with attack bonuses and damage to undead"
  - Submit and verify grid display

  **Verification:**
  - Card form works end-to-end
  - Grid shows item with correct badges and stat line
  - Hover shows description

## System-Wide Impact

- **Schema:** 11 new columns with defaults — non-breaking. Old columns preserved.
- **API:** POST /api/items accepts new fields. GET returns all columns.
- **Marketplace:** Uses InventoryItemGrid — will show new badges automatically.
- **Player display:** Not affected.
- **Magic category colors** already defined in DESIGN.md — reuse them for type badges.

## Risks & Dependencies

- **ensureSchema memoization:** Dev server restart required after schema change.
- **Column count:** Items table grows significantly. All new columns are nullable/defaulted so no impact on existing data.
- **School selector with 8 options:** May need 2×4 grid on mobile. Test on narrow viewports.
- **Rarity selector with 5 options:** Single row works on desktop, may need to wrap on mobile.
