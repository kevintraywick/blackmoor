---
title: "feat: Inventory card preview pane with AI-suggested stats"
type: feat
status: active
date: 2026-04-02
origin: docs/plans/2026-04-01-003-feat-inventory-form-redesign-plan.md
---

# feat: Inventory card preview pane with AI-suggested stats

## Overview

Add a card preview pane alongside the existing card builder on the inventory page. The builder (pane 1, left) is where the DM edits. The preview (pane 2, right) renders a read-only card using `spell_cards/card_bg.png` as the background, the item image from the builder, and all current field values. When the DM enters an item name and type, a Claude API endpoint auto-fills the builder with suggested 5e stats — the DM never starts from a blank canvas. A "Publish" button below the builder adds the completed card to inventory.

## Problem Frame

The DM creates items by typing stats manually, but many items are well-known D&D 5e entries (Fireball, Longsword +1, Cloak of Protection). The DM shouldn't have to recall exact stats from memory, and shouldn't face a blank canvas. As soon as the DM names an item and picks a type, AI auto-fills the builder with reasonable 5e defaults — the DM tweaks from there. The card preview gives immediate visual feedback of what the finished item card looks like. A "Publish" button below the builder commits the card to inventory.

## Requirements Trace

- R1. Side-by-side layout: card_builder (left) + card_preview (right)
- R2. Card preview is read-only — renders current builder state in real-time
- R3. Card preview uses `card_bg.png` as background with item image and stats overlaid
- R4. AI suggest endpoint: POST `/api/items/suggest` calls Claude with item name + type, returns suggested stats/description
- R5. Auto-fill: when DM enters name + type, AI auto-populates builder fields (debounced). No suggest button — never a blank canvas.
- R6. Works without API key (auto-fill skipped silently, builder starts empty as fallback)
- R7. "Publish" button below card builder adds the completed card to available inventory

## Scope Boundaries

- No changes to the item creation API or schema (uses existing columns from prior plan)
- No per-type card backgrounds (single `card_bg.png` for now)
- No editing existing items in the preview — create flow only
- Card preview is desktop only for now (stacks below on mobile)
- AI suggestion is a convenience — DM can always override every field

## Context & Research

### Relevant Code and Patterns

- `components/InventoryCreateForm.tsx` — card builder (pane 1), state lives here
- `components/InventoryPageClient.tsx` — page layout, currently stacked vertically
- `components/InventoryItemGrid.tsx` — Item interface with all type fields
- `public/images/inventory/spell_cards/card_bg.png` — ornate parchment card background (750×1050ish, portrait)
- DESIGN.md — max-w-[1000px] for DM pages, no dropdowns, no scrollable containers
- Memory: Mappy AI deferred — needs ANTHROPIC_API_KEY on Railway

### Institutional Learnings

- `ensureSchema` memoization — restart after DDL (no DDL needed here)
- Tailwind v4 arbitrary values broken — use inline styles for precise sizing
- Image uploads capped at 4MB

## Key Technical Decisions

- **Anthropic SDK:** Install `@anthropic-ai/sdk`. Use `ANTHROPIC_API_KEY` env var. Endpoint no-ops gracefully if key is missing.
- **State lifting:** Builder field state needs to be accessible to the preview. Lift state from `InventoryCreateForm` up to `InventoryPageClient`, or pass current values via a callback/ref. Lifting state is cleaner since preview needs all fields.
- **Card preview rendering:** Pure CSS/HTML overlay on the card_bg.png. Position item image, title, stats, and description as absolute-positioned elements over the background. Text should use serif font (EB Garamond) to match the parchment feel.
- **AI prompt design:** Send item name + type to Claude. Ask for a JSON response with the type-appropriate fields. Use claude-haiku-4-5-20251001 for speed and cost (this is a quick lookup, not complex reasoning).
- **Auto-fill trigger:** Debounced — fires after the DM stops typing the title (~800ms pause) AND a type is selected. No button. Avoids API spam via debounce. Skipped silently if no API key.
- **Publish button:** Replaces the current gold + circle submit button. Sits below the card builder. Calls existing POST `/api/items` to create the item.

## Open Questions

### Resolved During Planning

- **Which model for suggestions?** Haiku — fast, cheap, sufficient for D&D stat lookups.
- **When does suggest fire?** Auto-fill on debounce (~800ms after typing stops) when name + type are set. No button.
- **Different backgrounds per type?** No — single `card_bg.png` for all types. Can add type-specific backgrounds later.
- **How does the DM publish?** "Publish" button below the builder. Calls existing POST `/api/items`.

### Deferred to Implementation

- Exact positioning of text elements on the card preview (depends on card_bg.png dimensions and visual testing)
- Claude prompt wording tuning (iterate based on response quality)
- Loading indicator style during auto-fill (subtle shimmer, spinner, or text change)

## Implementation Units

- [ ] **Unit 1: Install Anthropic SDK**

  **Goal:** Add `@anthropic-ai/sdk` dependency

  **Requirements:** R4

  **Dependencies:** None

  **Files:**
  - Modify: `package.json`

  **Approach:**
  - `npm install @anthropic-ai/sdk`
  - No env var needed locally yet (endpoint will no-op without it)

  **Verification:**
  - Package appears in package.json dependencies

- [ ] **Unit 2: AI suggest API endpoint**

  **Goal:** POST `/api/items/suggest` that calls Claude and returns suggested item stats

  **Requirements:** R4, R6

  **Dependencies:** Unit 1

  **Files:**
  - Create: `app/api/items/suggest/route.ts`

  **Approach:**
  - Accept JSON body: `{ name: string, item_type: 'magic_item' | 'scroll' | 'spell' }`
  - If `ANTHROPIC_API_KEY` is not set, return 503 with `{ error: 'AI suggestions unavailable' }`
  - Call Claude Haiku with a system prompt establishing D&D 5e expertise
  - Ask for JSON output with type-appropriate fields:
    - Magic Item: `{ description, attack, damage, heal, rarity, attunement, price }`
    - Scroll: `{ description, level, school, price }`
    - Spell: `{ description, level, school, casting_time, range, components, duration, price }`
  - Parse response, return as JSON
  - Wrap in try/catch — return 500 on failure, never crash

  **Patterns to follow:**
  - `lib/email.ts` — graceful no-op pattern when env var missing
  - Existing API routes in `app/api/` for error handling style

  **Test scenarios:**
  - "Fireball" + spell → returns level 3, evocation, 120ft, etc.
  - Missing API key → 503
  - Unknown item name → still returns reasonable defaults
  - Malformed request → 400

  **Verification:**
  - curl POST returns reasonable D&D stats for known items
  - No crash when API key is missing

- [ ] **Unit 3: Lift builder state to InventoryPageClient**

  **Goal:** Make form field values accessible to both the builder and the new preview pane

  **Requirements:** R1, R2

  **Dependencies:** None

  **Files:**
  - Modify: `components/InventoryPageClient.tsx`
  - Modify: `components/InventoryCreateForm.tsx`

  **Approach:**
  - Move key state (itemType, title, description, price, attack, damage, heal, rarity, attunement, level, school, casting_time, range, components, duration, preview image URL) up to `InventoryPageClient`
  - Pass state + setters down to `InventoryCreateForm` as props
  - Builder becomes a controlled form — same behavior, state just lives one level up
  - Define a `CardFields` interface for the shared state shape

  **Patterns to follow:**
  - Existing `selectedItem` / `editItem` state lifting in `InventoryPageClient`

  **Verification:**
  - Builder form behaves identically to before (type selection, field display, submit)
  - State values are accessible from InventoryPageClient for the preview

- [ ] **Unit 4: CardPreview component**

  **Goal:** Read-only card rendering using card_bg.png with item data overlaid

  **Requirements:** R2, R3

  **Dependencies:** Unit 3

  **Files:**
  - Create: `components/CardPreview.tsx`

  **Approach:**
  - Container with `card_bg.png` as background image, sized to card proportions (roughly 2:3 portrait)
  - Item image rendered as a centered circle or rounded rectangle in the upper portion of the card
  - Title in large serif text below image
  - Type-specific stats rendered in the middle section:
    - Magic Item: rarity banner, ATK/DMG/HEAL stat blocks, attunement indicator
    - Scroll: level + school
    - Spell: level, school, casting time, range, components, duration in a structured layout
  - Description text in the lower section
  - Price with gold coin at bottom
  - All text dark (brown/black) to contrast with parchment background
  - Empty/placeholder state when no title entered yet ("Name your item...")

  **Patterns to follow:**
  - Card_bg.png visual style — ornate gold border on parchment
  - DESIGN.md serif typography (EB Garamond)
  - Physical artifact aesthetic from CLAUDE.md design context

  **Test scenarios:**
  - Empty state shows placeholder
  - Magic Item with all fields filled renders correctly
  - Scroll with level + school renders correctly
  - Spell with all 6 fields renders correctly
  - Long description doesn't overflow the card

  **Verification:**
  - Card preview updates in real-time as builder fields change
  - Looks like a physical D&D item card on parchment background

- [ ] **Unit 5: Side-by-side layout + auto-fill + publish button**

  **Goal:** Wire builder and preview side-by-side, auto-fill builder via AI on name+type entry, add Publish button

  **Requirements:** R1, R5, R6, R7

  **Dependencies:** Units 2, 3, 4

  **Files:**
  - Modify: `components/InventoryPageClient.tsx`
  - Modify: `components/InventoryCreateForm.tsx`

  **Approach:**
  - Layout: flex row on desktop (`flex flex-col sm:flex-row gap-6`), builder and preview each ~50% width
  - Builder stays maxWidth 480, preview fills remaining space up to similar width
  - On mobile, stack vertically (builder on top, preview below)
  - **Auto-fill:** useEffect with debounce (~800ms) watches title + itemType. When both are set and title length ≥ 2, call POST `/api/items/suggest`. On success, populate all builder fields with response. On 503 (no key) or error, do nothing silently. Track last-suggested name to avoid re-calling on the same input.
  - **Publish button:** Below the card builder form. Styled as a warm action button (gold bg, serif text, "Publish to Inventory"). Calls existing POST `/api/items` with all builder fields. On success, resets builder and refreshes inventory grid.
  - Remove the old gold + circle submit button from the top-right of the card form
  - Subtle loading indicator during auto-fill (e.g., pulsing border on the builder card)

  **Patterns to follow:**
  - Existing side-by-side patterns in the codebase
  - `lib/email.ts` graceful degradation pattern

  **Test scenarios:**
  - Side-by-side on desktop, stacked on mobile
  - Typing "Fireball" + spell type → builder auto-fills with 5e stats after debounce
  - No API key → builder stays empty, no error shown
  - DM can override all auto-filled values
  - Publish button creates item and resets builder
  - Publish with empty title does nothing

  **Verification:**
  - Layout is side-by-side on desktop
  - AI auto-fills builder fields → preview updates in real-time
  - Publish button adds item to inventory grid
  - Works without API key (auto-fill skipped, manual entry works, publish works)

## System-Wide Impact

- **New dependency:** `@anthropic-ai/sdk` added to package.json
- **New env var:** `ANTHROPIC_API_KEY` needed on Railway for AI suggestions (optional — feature degrades gracefully)
- **State restructure:** InventoryCreateForm becomes controlled — its state moves up to InventoryPageClient. No external API changes.
- **No schema changes** — uses existing columns from the prior plan

## Risks & Dependencies

- **ANTHROPIC_API_KEY not set on Railway:** Feature degrades to live-mirror-only. Suggest button hidden. No crash.
- **Claude response format:** Haiku may occasionally return malformed JSON. Parse defensively, fall back to empty fields on failure.
- **Card preview sizing:** The card_bg.png has ornate borders — text must be positioned within the inner frame. Will need visual iteration during implementation.
- **State lifting complexity:** InventoryCreateForm has ~15 state variables. Lifting all of them is verbose but straightforward. Consider a single `cardFields` object to reduce prop count.
