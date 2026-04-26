---
title: Common World Cartography
status: active
date: 2026-04-24
---

# Common World Cartography

Canonical list of named places in the Common World. Shared across all campaigns that hook into the world.

Source of truth for code is `lib/cartography.ts`. This file mirrors it for human reading. Keep them in sync by hand for now; once the list grows, this will migrate to a DB table and the MD will be auto-generated.

## Fields

- **Real-world** — geographic anchor; where the location sits on Earth.
- **Lat/Lng** — canonical coordinates (used by the globe, map-builder, and anything spatial).
- **H3 cells** — res-2/4/6 cells the location falls in. Lets multiple campaigns share territory math without coordinate drift.
- **Campaigns** — which campaigns reference this place.
- **Kinds** — in-fiction nature (city, village, dungeon, mine, port, shrine, etc.).
- **Terrain** — biome/physical character (forest, coast, mountain, etc.).
- **Polity** — claiming kingdom/faction, if any.
- **Status** — `active` (party is here), `named` (referenced but unvisited), `visited` (been and gone), `past` (destroyed / off-canon).
- **Notes** — short in-fiction description.

---

## Locations

### Blaen Hafren

- **Real-world**: source of the River Severn, Plynlimon, Wales
- **Lat/Lng**: 52.4833, -3.7333
- **H3 cells**: res-6 `86195e0f7ffffff` · res-4 `84195e1ffffffff` · res-2 `82195ffffffffff`
- **Campaigns**: Shadow
- **Kinds**: dungeon, mine, wilderness
- **Terrain**: forest, cliff, mountain, river
- **Polity**: —
- **Status**: active — Shadow party is here
- **Notes**: Dungeon, forested wilderness, clifftop, pirate mine. Canonical world origin; every Common World campaign anchors to this hex.

### Machynlleth

- **Real-world**: market town in Powys, Wales — ~14 km NW of Blaen Hafren
- **Lat/Lng**: 52.5903, -3.8510
- **H3 cells**: res-6 `86195e0a7ffffff` · res-4 `84195e1ffffffff` · res-2 `82195ffffffffff`
- **Campaigns**: Shadow
- **Kinds**: village
- **Terrain**: hills, river
- **Polity**: —
- **Status**: named
- **Notes**: Nearest settlement to the Blaen Hafren dungeon. Small village in fiction. Shares Shadow's res-4 territory hex — walkable from the dungeon.

### Aberystwyth

- **Real-world**: port on the Welsh coast — ~30 km WNW of Blaen Hafren
- **Lat/Lng**: 52.4153, -4.0829
- **H3 cells**: res-6 `86195e717ffffff` · res-4 `84195e7ffffffff` · res-2 `82195ffffffffff`
- **Campaigns**: Shadow
- **Kinds**: city, port
- **Terrain**: coast, urban
- **Polity**: —
- **Status**: named
- **Notes**: Large port city. Major trade hub and sea access. Different res-4 hex from Blaen Hafren; shares the res-2 cell.
