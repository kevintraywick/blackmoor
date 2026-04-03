---
title: "feat: Auto-fill weapon price from SRD lookup"
type: feat
status: active
date: 2026-04-03
---

# Auto-fill Weapon Price from SRD Lookup

## Overview

When a player types a weapon name in the Weapons pane and submits, auto-fill the price field from a static 5e SRD weapon price table. Follows the existing `lib/srd-hp.ts` pattern.

## Problem Frame

Players adding weapons must manually look up and type prices. The 5e SRD has a fixed set of ~37 weapons with known prices. Auto-filling saves time and reduces errors.

## Scope Boundaries

- Only standard SRD weapons — homebrew/custom weapons get no auto-fill (price field stays empty for manual entry)
- Auto-fill on submit only, not on every keystroke
- Does not auto-fill To Hit or Damage (those are character-dependent)

## Key Technical Decisions

- **Static lookup table over API**: Only ~37 weapons. A JS object is instant, zero-latency, no API key needed, works offline. Follows the `srd-hp.ts` pattern already in the codebase.
- **Fuzzy matching with lowercase normalize**: Match "greatsword", "Greatsword", "Great Sword" to the same entry. Simple `.toLowerCase().trim()` plus an alias map for common variants.
- **Don't overwrite manual entry**: If the player already typed a price, don't replace it.

## Implementation Units

- [ ] **Unit 1: Create `lib/srd-weapons.ts` — static weapon price table**

  **Goal:** Single source of truth for SRD 5e weapon prices.

  **Files:**
  - Create: `lib/srd-weapons.ts`

  **Approach:**
  - Export a `Record<string, string>` mapping lowercase weapon names to prices (e.g. `'greatsword': '50'`, `'quarterstaff': '2sp'`)
  - Include all ~37 SRD simple + martial weapons
  - Add common aliases/variants as additional keys (e.g. `'great sword': '50'`)
  - Export a `lookupWeaponPrice(name: string): string | null` helper that normalizes input and returns the price or null

  **Patterns to follow:**
  - `lib/srd-hp.ts` — same static-data-with-lookup pattern

  **Verification:**
  - File exports the lookup function and covers all SRD weapons

- [ ] **Unit 2: Wire auto-fill into WeaponList submit**

  **Goal:** When a weapon is added and no price was manually entered, auto-fill from the SRD table.

  **Files:**
  - Modify: `components/PlayerSheet.tsx` (WeaponList `submit` function)

  **Approach:**
  - Import `lookupWeaponPrice` from `lib/srd-weapons.ts`
  - In `submit()`, if `price` is empty, call `lookupWeaponPrice(name)` and use the result
  - If lookup returns null (custom/homebrew weapon), leave price empty
  - If user already typed a price, don't overwrite it

  **Test scenarios:**
  - "Greatsword" → auto-fills "50"
  - "great sword" → auto-fills "50" (fuzzy)
  - "Greatsword" with price already "60" → keeps "60"
  - "Moonblade" (not SRD) → price stays empty

  **Verification:**
  - Adding any SRD weapon without a manual price fills the price column automatically

## Risks & Dependencies

- None — fully client-side, no API calls, no schema changes, no DB migration.
