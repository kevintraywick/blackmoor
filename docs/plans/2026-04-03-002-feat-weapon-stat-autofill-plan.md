---
title: "feat: Auto-fill weapon To Hit and Damage from ability scores + SRD"
type: feat
status: active
date: 2026-04-03
---

# Auto-fill Weapon To Hit and Damage

## Overview

When a player adds a weapon, auto-fill To Hit and Damage using their ability scores, proficiency bonus, and SRD weapon data. Extends the existing `lib/srd-weapons.ts` price lookup.

## Problem Frame

Players must manually calculate To Hit (ability mod + proficiency) and Damage (die + ability mod) for every weapon. This is tedious and error-prone. The app already has ability scores and a weapon lookup table.

## Scope Boundaries

- Only auto-fills on weapon add (not retroactively for existing weapons)
- Only for SRD weapons — custom/homebrew weapons get no auto-fill
- Does not auto-fill if the player already typed a value
- Does not recalculate when ability scores change (player can manually update)

## Key Technical Decisions

- **Extend `srd-weapons.ts` with damage die and properties**: Add `damage` (e.g. "1d8") and `properties` (finesse, ranged) per weapon. Keeps everything in one lookup.
- **Ability modifier logic**: `Math.floor((score - 10) / 2)` — standard 5e formula.
- **Which ability to use**: Melee → STR mod. Ranged → DEX mod. Finesse → higher of STR/DEX. This is determined by weapon properties in the SRD data.
- **Proficiency bonus from level**: Levels 1-4: +2, 5-8: +3, 9-12: +4, 13-16: +5, 17-20: +6. Derived from the `level` field already on the sheet.
- **Calculation happens client-side**: All data (ability scores, level, weapon SRD data) is already in the component state. No API call needed.

## Implementation Units

- [ ] **Unit 1: Extend `lib/srd-weapons.ts` with damage die and weapon type**

  **Goal:** Each SRD weapon entry includes base damage and whether it's ranged/finesse.

  **Files:**
  - Modify: `lib/srd-weapons.ts`

  **Approach:**
  - Change the lookup value from a price string to an object: `{ price, damage, type }` where type is `'melee' | 'ranged' | 'finesse'`
  - Export a `lookupWeapon(name)` function returning the full object or null
  - Keep `lookupWeaponPrice` as a convenience wrapper

  **Patterns to follow:**
  - `lib/srd-hp.ts` — typed record with interface

- [ ] **Unit 2: Add helper functions for ability mod and proficiency**

  **Goal:** Pure utility functions for D&D 5e stat calculations.

  **Files:**
  - Create: `lib/dnd-calc.ts`

  **Approach:**
  - `abilityMod(score: number): number` → `Math.floor((score - 10) / 2)`
  - `proficiencyBonus(level: number): number` → standard 5e table
  - `formatMod(n: number): string` → "+2" or "-1" formatting

- [ ] **Unit 3: Wire auto-fill into WeaponList submit**

  **Goal:** On weapon add, auto-fill To Hit and Damage from ability scores + SRD data.

  **Files:**
  - Modify: `components/PlayerSheet.tsx` (WeaponList and its parent)

  **Approach:**
  - WeaponList needs access to the player's ability scores and level (pass as props)
  - In `submit()`, if To Hit is empty and weapon is in SRD:
    - Determine ability (STR/DEX/finesse → higher)
    - To Hit = ability mod + proficiency bonus, formatted as "+N"
  - If Damage is empty and weapon is in SRD:
    - Damage = SRD base die + ability mod, formatted as "1d8+2"
  - If player already typed values, don't overwrite

  **Verification:**
  - Adding "Longsword" with STR 16, Level 3 → To Hit "+5" (STR +3 + Prof +2), Damage "1d8+3"
  - Adding "Shortbow" with DEX 14 → uses DEX mod
  - Adding "Rapier" (finesse) → uses higher of STR/DEX
  - Player types custom To Hit → not overwritten
