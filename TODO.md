# Realm Walker — Project Roadmap

> A location-based D&D companion that extends the game into the real world.
> Three pillars: **Sessions** (at the table), **Online** (the app), **Exploring** (the physical world).

---

## ✅ Built and Working

- [x] QR → personalized character page system (class-specific narratives per scan)
- [x] DM admin panel (create codes, add class-specific messages, generate printable QRs)
- [x] Player registration, token auth, inventory, scan history
- [x] Cooldown and scarcity mechanics (per-player, per-code)
- [x] Letter system schema (encoded cross-player puzzles)
- [x] Map prototype (Martin location nodes, foraging, d20 rolls, Leaflet)
- [x] Card catalog designed (70 cards across 8 types, Midjourney prompts, risk/loss system)
- [x] Three-pillar design framework defined

---

## 🏰 Pillar 1: Sessions (At the Table)

### Card Play System
- [ ] Hand limit mechanic (5-7 cards selected before session from full collection)
- [ ] Risk roll system (d20 at or below risk number = card lost)
- [ ] Charge drain on successful plays (25-50% per use even when kept)
- [ ] Consumed vs rechargeable card distinction
  - Consumed: healing spells, potions, poisons, scrolls, one-shot trophies
  - Rechargeable: weapon enchantments, blessings, combat techniques, influence, defense
- [ ] Card loss routing (rechargeable → marketplace at 0% charge, consumed → destroyed)
- [ ] Physical card templates for printing (card art + stats + flavor text on card stock)

### DM's Hand (Enemy Cards)
- [ ] DM card pool — accumulate cards from player losses
- [ ] Enemy deck builder — assign cards to boss encounters
- [ ] "Reveal" moment mechanic — dramatically show the party their own lost cards being used against them
- [ ] NPC card drops — defeating an enemy who played a card can yield that card as loot

### Session Bridge Mechanics
- [ ] Trophy card redemption — bring physical card, get in-game bonus
- [ ] Letter delivery payoffs — sealed letters decoded at the table
- [ ] Lore fragment assembly — party combines fragments found individually
- [ ] Intel briefing system — "What did you learn this week?" with tiered party bonuses
  - Tier 1: Party can't be surprised in first encounter
  - Tier 2: One free knowledge check auto-succeeds
  - Tier 3: Narrative advantage (NPC ally, unlocked door, disarmed trap)
- [ ] Mid-session card trading between players
- [ ] Physical card sacrifice for powerful crafting effects

---

## 💻 Pillar 2: Online (The App)

### Marketplace
- [ ] Browse/filter cards by type, rarity, charge level, price
- [ ] Real-time recharge system
  - Common: 24 hours to full charge
  - Uncommon: 48-72 hours
  - Rare: 1 week
  - Legendary: destroyed (no return to market)
- [ ] Partial charge usability — reduced effect at lower charge, discounted price
- [ ] Charge visualization — progress bar / glow border showing charge state
- [ ] Dynamic pricing based on supply (many copies = cheaper)
- [ ] "Freshly Lost" section after game night
- [ ] Magic point fast-recharge for casters
- [ ] Gold/downtime fast-recharge for martial classes
- [ ] Buy, sell, list cards and materials
- [ ] Price history graphs per card

### Player-to-Player Trading
- [ ] Trade offers — propose swaps of cards, materials, gold
- [ ] Counter-offers and negotiation
- [ ] Trade history log (visible to DM)
- [ ] Trade cards — class-gated items that are only useful to other classes, encouraging swaps

### Workshops (Online Crafting Facilities)

#### Spell Workshop
- [ ] Develop new spells using arcane materials gathered from sessions and exploring
- [ ] Combine spell dust, echo crystals, cipher pages, etc. into spell cards
- [ ] Recipe discovery — find recipes through lore fragments, QR codes, or experimentation
- [ ] Experimental crafting — combine without a recipe, risk producing something cursed or brilliant
- [ ] Spell research timers (real-time, hours/days based on spell level)
- [ ] Class-gated: only casters can use, specific schools of magic unlock specific recipes

#### Potions Workshop
- [ ] Brew potions from organic and elemental materials
- [ ] Recipes: known formulas (safe, predictable) and experimental brews (risky, surprising)
- [ ] Potion quality determined by a crafting check (proficiency in Herbalism Kit = bonus)
- [ ] Brewing time (real-time): simple potions = hours, complex = days
- [ ] Failure states that are fun — botched potions are unstable but usable with side effects
- [ ] Potions are consumed on use (destroyed, not rechargeable)

#### Magic Item Workshop
- [ ] Enchant weapons, armor, and gear using arcane + mineral materials
- [ ] Socket system — add elemental gems/crystals to existing gear for bonus properties
- [ ] Upgrade paths — branching trees so two players with the same base item end up different
- [ ] Enchantment duration — some permanent, some temporary (X sessions)
- [ ] Requires proficiency in Arcana or appropriate tool kit
- [ ] Collaboration crafting — one player contributes materials, another has the proficiency

#### Forging Workshop
- [ ] Forge weapons and armor from mineral materials (raw iron, dragonglass, twilight quartz)
- [ ] Weapon quality tiers: standard → masterwork → legendary
- [ ] Forging check (d20 + proficiency with Smith's Tools)
  - High roll: bonus property or improved quality
  - Low roll: flawed but usable
  - Nat 1: broken or cursed
  - Nat 20: masterwork with unique trait
- [ ] Repair damaged items
- [ ] Reforge broken items (with the right Trophy card, eg The Ironmonger's Favor)
- [ ] Real-time forging timers (simple weapon = hours, legendary = spans multiple sessions)

#### Training Grounds
- [ ] Improve proficiency with specific weapon types
- [ ] Training sessions cost gold and real-time (daily training over a week)
- [ ] Milestone bonuses: after X training sessions, gain a small permanent buff (+1 to hit with trained weapon type for one session, etc.)
- [ ] Sparring challenges — PvE combat mini-games that test skill and reward XP/materials
- [ ] Mentor NPCs — the DM can place trainer NPCs who offer class-specific advancement
- [ ] Arena / sparring pit — asynchronous PvE combat encounters with leaderboards

### Gambling Hall
- [ ] Spend in-game gold on games of chance
- [ ] Dice games (Liar's Dice, Ship Captain Crew, etc.) — against the house or other players
- [ ] Card games — use a mini deck (separate from the main card system) for poker-style games
- [ ] Betting on outcomes — "I bet 20gp that the next QR code I scan drops a rare"
- [ ] Tournament events — DM-run gambling nights with prize pools
- [ ] House edge keeps gold flowing out (prevents inflation)
- [ ] Lucky streaks and losing streaks create stories ("I lost 200gp at the Gambling Hall last week")
- [ ] Risk/reward: high-stakes tables unlock at higher gold thresholds

### The Bar (Tavern / Social Hub)
- [ ] In-character chat space — players talk as their characters
- [ ] NPC patrons placed by the DM with lore, rumors, and quest hooks
- [ ] "Overhear a conversation" — DM seeds ambient NPC dialogue that drops hints about the next session
- [ ] Patron relationships — befriend NPCs over multiple visits for escalating rewards
- [ ] Buy rounds for NPCs (spend gold) to unlock deeper lore tiers
- [ ] Rumor board — anonymous tips, bounties, and job postings from the DM
- [ ] Bard performances — bard players can "perform" (trigger a mini-game) for gold tips and reputation
- [ ] Warlock patron contact point — the bar's back room is where patron messages arrive
- [ ] Faction representatives — NPCs aligned with campaign factions offer quests and reputation shifts

### Player Profile & Collection
- [ ] Full card collection view with charge status and usage history
- [ ] Hand selection screen — pick your session hand from your collection
- [ ] Material inventory organized by category (organic, mineral, arcane, elemental)
- [ ] Lore journal — collected fragments, decoded letters, discovered recipes
- [ ] Achievement / milestone tracking
- [ ] Faction reputation display

### DM Admin Tools
- [ ] Seed QR codes and sealed encounters between sessions
- [ ] Adjust drop tables based on campaign needs
- [ ] Push story events that affect the marketplace and map
- [ ] View all player inventories, scan logs, trade history
- [ ] Manage enemy card hand for next session
- [ ] NPC management — create and place NPCs in the bar, assign lore and dialogue
- [ ] Economy dashboard — gold circulation, card supply, market health
- [ ] Session prep checklist — what to seed, what to hide, what to foreshadow

### DM Library (Platform Feature)
- [ ] Publish cards from your campaign to a shared library
- [ ] Browse, filter, and import cards created by other DMs
- [ ] Card metadata: type, rarity, risk, class affinity, level range, campaign theme tags
- [ ] Rating system — DMs rate imported cards after playtesting
- [ ] "Most Popular," "Highest Rated," "New This Week" discovery feeds
- [ ] Versioning and forking — modify an imported card, credit the original creator
- [ ] Campaign Packs — curated bundles of 20-30+ cards with a theme and narrative arc
- [ ] Community curation — best cards float to the top over time

---

## 🗺️ Pillar 3: Exploring (The Physical World)

### Map & Location System
- [ ] Tighter Lindell Street map — 3 blocks in each direction from Martin Public Library
- [ ] Real Martin locations themed as fantasy nodes
  - The Scriptorium (Library) — Arcane hub with class-specific rooms
  - The Ember Forge (Blake's) — Elemental/Mineral
  - The Alchemist's Brew (Martin Coffeehouse) — Arcane/Potions
  - The Tidepool (Blue Oak) — Elemental
  - The Grinding Stone (The Grind) — Mineral processing node
  - The Wanderer's Rest (La Cabana) — Organic/Rumor node
  - The Watchtower (Vantage Coffee) — Arcane/Scrying node
  - The Vault (Regions Bank) — Gold and marketplace token drops
- [ ] GPS-based proximity detection — nodes reveal when players are within range
- [ ] Node refresh timers (daily for common, weekly for rare, event-based for special)

### Library Class Rooms (The Scriptorium)
- [ ] Bard → Recording Studio ("Hall of Echoes") — rhythm/music mini-game, Song Fragment collectibles
- [ ] Druid → Forest-themed Children's Library ("The Living Grove") — nature ID puzzles, fey materials
- [ ] Wizard → Genealogy Room ("Archive of Names") — decryption puzzles, cipher pages, true name fragments
- [ ] Rogue → Makerspace ("Tinkerer's Bench") — lock-pick timing game, gadget crafting
- [ ] Cleric/Paladin → Reading Room ("The Sanctum") — meditation focus game, blessed materials
- [ ] Fighter/Barbarian → Event Space/Stage ("Proving Ground") — reaction-time combat challenges
- [ ] Warlock/Sorcerer → Demo Kitchen ("The Crucible") — potion brewing with risk mechanic
- [ ] Ranger → Building Exterior ("The Perimeter") — GPS patrol route, scouting missions

### QR Code System
- [ ] Material caches — crafting ingredients with class-specific flavor
- [ ] Card drops — full-charge cards, first-come-first-served for rares
- [ ] Lore fragments — collect the set to unlock recipes, secrets, session hooks
- [ ] Sealed letters — encoded cross-player puzzles, courier missions
- [ ] Sealed encounters — combat/choice scenarios that foreshadow sessions
- [ ] Trophy cards — prestige items, bring physical card to session for bonus
- [ ] Faction tokens — shift reputation with campaign factions
- [ ] QR codes inside books (clue is the call number) — library-specific hunts
- [ ] Weekly code rotation — DM hides fresh codes each week

### Riddle Chains
- [ ] Multi-step QR scavenger hunts — solve riddle, find next code, escalating rewards
- [ ] Martial class chains — physical, observational, skill-based (tracking, scouting, reaction tests)
- [ ] Magic class chains — knowledge-based, ritualistic (casters use "spells" in the app for guidance)
  - Detect Magic: reveals what's hidden at a node before foraging
  - Augury: hints about sealed encounter danger level
  - Speak with Nature: bonus drops at organic nodes
  - Legend Lore: decode lore fragments faster
  - Comprehend Languages: decode sealed letters
- [ ] Spell slot limits — 2-3 per day, casters choose when to use them
- [ ] Compass Trail challenges — app gives bearing and distance, player follows with phone

### Challenge Mini-Games
- [ ] Riddle Gate (Arcane nodes) — answer a lore riddle to forage, wrong answer = reduced drop
- [ ] Lock Pick (Mineral nodes / caches) — timing game, tap when indicator hits sweet spot
- [ ] Potion Brew (Alchemist's Brew) — memory/sequence game with rune symbols
- [ ] Steady Hand (Stealth nodes) — phone accelerometer, hold perfectly still for 5 seconds
- [ ] Quick Draw (Combat encounters) — reaction time tap game, speed = attack roll
- [ ] Haggle (The Vault / marketplace nodes) — NPC negotiation mini-game
- [ ] Meditation (Cleric nodes) — match rhythm of a pulsing light for 30 seconds

### Sealed Encounters as Session Foreshadowing
- [ ] Tier 1 (common nodes): Atmospheric hints — "The air near the Grove feels wrong"
- [ ] Tier 2 (uncommon nodes): Tactical intel — fight a weaker version of the boss, learn vulnerabilities
- [ ] Tier 3 (rare / QR-only): Narrative intel — letters, visions, patron whispers, moral choices
- [ ] Environmental foreshadowing — node descriptions change to hint at upcoming threats
- [ ] Warlock patron messages — personal quest hooks between sessions

### Social & Competitive
- [ ] Node depletion visibility — "This area has been picked clean, refreshes in 12 hours"
- [ ] Co-op nodes — require two players at the same location simultaneously
- [ ] Friendly competition for rare spawns
- [ ] Ranger patrol leaderboard — fastest patrol times
- [ ] Weekly scavenger hunt events tied to campaign arc

---

## 🔮 Big Vision / Future

- [ ] Push notifications when new codes are seeded or cards finish recharging
- [ ] Physical/digital card hybrid — printable card templates with QR-verified authenticity
- [ ] Card corruption system — cards lost multiple times gain mutations (visual and mechanical changes)
- [ ] Seasonal/story events that transform the map (undead at cemetery before necromancer arc, frost essence in winter)
- [ ] Party base building / guild hall (online) — invest in upgrades, unlock new workshop tiers
- [ ] Cross-campaign card economy — cards from one DM's table can appear in another's marketplace via the DM Library
- [ ] Spectator mode — friends/family can follow the campaign's progress through a public story feed
- [ ] NPC relationship trees — visual map of faction connections and NPC allegiances
- [ ] Weather integration — real Martin weather affects in-game drops (rain = water elemental materials, cold = frost essence)
- [ ] AR layer — phone camera shows fantasy overlay on real locations (long-term stretch goal)

---

## 📋 Tech Stack

- **Backend:** Node.js / Express / SQLite (consistent with Move Along stack)
- **Frontend:** Server-rendered HTML with mobile-first design (no framework dependency for player pages)
- **Map:** Leaflet.js with CartoDB dark tiles
- **QR Generation:** `qrcode` npm package, gold-on-dark themed
- **Deployment:** Railway with persistent volume for SQLite
- **Card Art:** Midjourney v6, dark fantasy tarot style, --ar 2:3
- **Physical Cards:** Printable templates (PDF or HTML) for card stock printing

---

## 🎯 Build Priority (Suggested Order)

1. **Card system in backend** — schema, charge/recharge, consumed vs rechargeable
2. **Marketplace** — buy/sell/trade with charge state and dynamic pricing
3. **Tight Lindell Street map** — real locations, library class rooms, GPS proximity
4. **Challenge mini-games** — one per node type (riddle gate, lock-pick, quick draw)
5. **Sealed encounters** — foreshadowing system tied to DM session prep
6. **Workshops** — spell, potions, forging, magic items, training grounds
7. **Gambling Hall** — dice games, card games, tournaments
8. **The Bar** — NPC patrons, lore, rumors, social hub
9. **Riddle Chains** — multi-step scavenger hunts
10. **DM Library** — publish, browse, import, rate cards across campaigns

---

*Last updated: March 21, 2026*
*Project started: Brainstorm session, Realm Walker v0.1*
