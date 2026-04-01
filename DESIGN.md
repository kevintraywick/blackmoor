# Design Notes

Living document for UI/UX decisions and constraints. Review before making visual changes.

## Core Principle

**Immediate understanding.** Every page should be understood at a glance. No learning curve, no hidden state, no progressive disclosure. If a user lands on a page, they should know what it is, what it shows, and what they can do — instantly.

## Layout

- **Player sheets**: `max-w-[860px]` — this is the design minimum for content pages.
- **All other pages** (DM pages, catalogs, forms): `max-w-[1000px]` — the default desktop content width.
- All page containers use `mx-auto` centering.

## Controls

- **No dropdowns, collapsing sections, pull-downs, accordions, or hidden menus.** All options and content must be visible on the page at all times. Use radio buttons, button groups, segmented controls, or inline lists instead.
- **No scrollable sub-containers.** The page itself scrolls; interior elements do not get `overflow-y-auto` or `max-h-*` unless explicitly approved.
- **No visible scrollbars.** Scrollbars are hidden globally via CSS (`scrollbar-width: none`). Users navigate by scroll wheel, trackpad, or finger. Do not re-enable scrollbars without explicit approval.
- **+/− buttons for numeric adjustments.** Use the small `w-[22px] h-5` bordered buttons from `PlayerSheet` Stat component for any numeric stepper (HP, gold, timers, etc.). Style: `bg-[var(--color-surface-raised)] border border-[var(--color-border)] text-[var(--color-text-muted)] rounded-sm` with gold hover. Value displayed between the buttons.
- **Radio-style selectors** use unfilled circles (`border: 2px solid #5a4f46`) that fill green (`#4a7a5a` with ✓) when selected.

## Responsive / Mobile

- **Mobile-first with Tailwind breakpoints.** Default styles target mobile; `sm:` (640px+) targets desktop. One component, not separate pages.
- **Touch targets**: Minimum `py-3` padding on tappable rows, portraits at `w-10 h-10`, checkmarks at `w-5 h-5` on mobile. +/- buttons expand to `w-8 h-8` on mobile (32px touch targets).
- **Stacking**: Multi-column grids collapse to single column on mobile (`grid-cols-1 sm:grid-cols-3`).
- **Player selector circles**: `w-14 h-14` on mobile, `w-20 h-20` on desktop.
- **Stats row**: Two rows on mobile (HP/AC/Level/Gold + XP/Speed/Size), single row on desktop.
- **Header**: Stacked on mobile (name row + fields row, Discord hidden), single inline row on desktop.

## Color

- **App palette**: Warm browns (`#1a1614` base) with gold accent (`#c9a84c`).
- **DM context**: Forest green (`#4a7a5a` bg, white text) for the DM nav bar and DM-only UI surfaces.
- **Magic categories**: Gold (spell), brown (scroll), purple (magic item), green (other).
- **Poison context**: Green (`#4a7a5a` for active indicators, `#7ac28a` for text). Nav tab pulses green when active.
- **DM message dot**: Bright red `#dc2626` dot, no label.
- **Boon dot**: White `#ffffff` with subtle glow (`boxShadow: 0 0 6px rgba(255,255,255,0.5)`). Pulses until player opens it, then stays solid until expired/cancelled.
- **Indicator layout**: All three indicators (boon, poison, DM) in a flex container at `right: 16` in the header. Order left-to-right: boon (white) | poison (🤢) | DM (red). Dots only, no text labels.
- **Combat panes** (Weapons, Cantrips/Spells): Warmer background `#282220` to visually elevate above other panes.
- **Journey Map**: Exception — cheerful saturated soft blues, white circles (`rgba(255,255,255,0.9)`), light path.

## Typography

- **Serif** (EB Garamond): Body text, titles, form inputs, nav links.
- **Sans** (Geist): Section labels, small-caps headers, UI chrome.
- **Section headers**: `text-[0.7rem] uppercase tracking-[0.15em]` in gold. Combat pane headers slightly larger (`0.78rem`).
- **Pane body text**: `text-[1.05rem]` — unified across all player sheet panes.
- **Stat values**: `text-[1.1rem]` in the stats row.

## Inline Add Pattern

All list panes (Weapons, Gear, Cantrips, Magic Items) use an inline `[+] Add item...` row:
- Sits at the bottom of the list within the same grid/layout
- `+` in a bordered box (`border border-[#3d3530] rounded w-5 h-5`), gold on hover
- Italic placeholder text in `text-[var(--color-text-dim)]`
- Click opens an inline input; Enter confirms, Escape cancels
- No separate "Add" button or section divider
