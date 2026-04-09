# The Raven Post — Core (v1) Design

**Date:** 2026-04-08
**Status:** Spec — ready for implementation plan
**Target:** **v1 by Sunday 2026-04-19** (extended one week to absorb the World AI scope)
**Companion specs:**
- `2026-04-08-raven-post-world-ai-design.md` (also v1 — routes through `/ce:plan`)
- `2026-04-08-raven-post-budget-tracker-design.md` (parallel v1)

## Goal

Push the campaign world into players' lives between sessions through a dedicated in-fiction news service. v1 ships the **player-facing surfaces** and the **manual DM curation flow** — the World AI engine is intentionally out of scope and lands in v2.

A v1 campaign without the World AI is still a real, working feature: the DM authors items by hand from `/dm/raven-post`, and players see them at `/raven-post`, get SMS pushes for big beats, and hear the newsie shout headlines from their character sheet.

## Non-goals (out of v1, captured for later)

- Email delivery
- Discord delivery (still v2 — dedicated `#raven-post` channel + bot push)
- Session-start "what you hear on the road" recap screen
- Sending replies (any kind)
- **Raven Radio** (continuous audio stream — v2)
- **Real-world deliveries** (physical mail to players — v2)

The World AI engine, vector DB / curated corpus, multiple SMS-trigger locations beyond the library, the bookstore directory, and the affiliate API integration are now **all in v1** per the deadline extension.

## User stories

1. **As a player** I open `/raven-post` and immediately see today's broadsheet with current weather, 4–6 headlines, the latest raven, the latest sending, classifieds, and any active omens. No intro screen.
2. **As a player** I land on my character sheet, and 10–20 seconds later a newsie audio clip plays the top headlines. The "The Raven" link in my nav burns red for 10 seconds, then fades over 30. I tap it and read.
3. **As a player** I walk past the city library (within 100 m of the Citadel Tree's coords) and an SMS arrives with an in-fiction overheard rumor — but only if I've opted in.
4. **As a player** my character sheet's banner image is overlaid with whatever the world weather is right now (rain streaks, fog, snow, storm flicker).
5. **As the DM** I open `/dm/raven-post`, type a one-line beat in the manual compose pane, click Draft, edit the AI's prose, and publish. The item is live for players within seconds.
6. **As the DM** I queue rumors into the library's Overheard FIFO. As players walk by the library, the queue pops one rumor each, no replays.

## Surfaces

### `/raven-post` — player broadsheet (read-only)

Discworld-style front page, parchment + black-letter masthead. Always available, no notification needed.

**Layout** (single page, `max-w-[860px]` mobile-first):
- **Masthead** — "The Raven Post" in UnifrakturMaguntia or similar black-letter, with date in DR (Dale Reckoning), a tagline, and a small `Volume X · Issue Y` stamp.
- **Today's Weather** — small permanent panel: current condition icon + label (Storm · 14°C · NE wind), driven by the world-weather state for the player's current world hex.
- **Headlines** — 3-column on desktop, single-column on mobile. 4–6 articles, typed-in by the DM. The first article uses a `dropcap` first-letter and is visually larger.
- **The Raven** — a sealed-letter card showing the most recent raven sent to *this* player (named, urgent). Wax seal icon.
- **The Sending** — a glowing arcane card showing the most recent sending sent to this player. Cryptic, ≤25 words. Footer reads "no sender · no reply."
- **Classifieds** — small-text classifieds: lost items, hires, ads (in-fiction wrapper for real-world ads). Clicking an ad with a real-world product reveals the product details in a modal — never on the page itself.
- **Omens** — a small italic strip: "Crows flew widdershins round the keep three mornings running."

The page is **read-only**. No interaction except: tap an ad → modal, tap a raven → expanded view, scroll.

### `/dm/raven-post` — DM curation page

Multi-pane curation surface inside the existing DM nav.

**v1 panes (top to bottom):**

1. **Manual Compose** — top pane in v1 (the World AI Suggestions pane lands here in v2).
   - Medium tabs: `📜 Broadsheet` · `🕊 Raven` · `✦ Sending` · `🍺 Overheard` · `📋 Ad`
   - Per-medium fields:
     - Broadsheet: headline, body (rich text via plain textarea is fine), tags, trust tier, optional dropcap flag
     - Raven: target player (radio button group), sender name, body (1–3 sentences)
     - Sending: target player, body (≤25 words enforced)
     - Overheard: body, trust tier (the location is fixed — library only in v1)
     - Ad: in-fiction body, optional real-world image URL, optional real-world product link, optional real-world copy (revealed on click)
   - **One-line beat → AI draft** button: DM types one line, clicks Draft, the page hits an internal API that calls Anthropic (Haiku) to expand. Same pattern as Inventory Card Builder. DM edits in place.
   - **Publish** button to commit.
2. **Library Overheard Queue** — FIFO list of pending overheards. Each row: position number, body (editable inline), delivered-to count (e.g. `0/4 sent` or `delivered to Ashton`), edit/delete actions. Drag-to-reorder.
3. **Published Items** — recently-published items grouped by medium. Each item editable until at least one player has marked it read. Items show their tag list and trust tier inline.

### Player nav — add "The Raven" link

In `app/players/[id]/page.tsx` line 60, the player nav currently reads:

```
Home | Player/Character | All Players | Marketplace | The story so far…
```

Add `The Raven` between `Marketplace` and `The story so far…`. Routes to `/raven-post`. Same color/typography as other nav links by default. **Pulses bright red** for 10 seconds, then fades over the next 30 seconds, after the newsie audio fires (see below).

### Player banner — weather overlay

`components/PlayerBanner.tsx` rotates banner images. Add an absolutely-positioned overlay child that renders the current world weather as an animated CSS layer:

- **Rain** — diagonal blue-tinted streaks, 0.6 s loop, low opacity
- **Snow** — falling white particles, 4 s loop
- **Fog** — soft white gradient drift, 8 s loop
- **Storm** — rain + occasional lightning flash (white flash 80 ms, every 6–10 s)
- **Mist / Dust / Embers** — variants of fog with hue/particle differences

Plus a small **weather pill** in the corner: `⛈ Storm · 14°C · NE wind`. The pill data and the overlay both come from the same API call.

The overlay reads `GET /api/weather/current?playerId=X` which returns the weather state for the player's current world hex. v1 does not require the world map to be implemented — return a default (`clear`) if no state exists, and let the DM set it manually from `/dm/raven-post` for testing. The map-builder world weather lands later and replaces the manual setting.

### Newsie audio + pulsing nav (`/players/[id]`)

A new client component `components/NewsieCallout.tsx`.

**Behavior:**
1. Mounts on the player sheet page.
2. Hits `GET /api/raven-post/headlines?playerId=X` to fetch the current top headlines AND a `lastReadAt` timestamp for the player.
3. **If** the player has `lastReadAt >= newest headline publish time` → no audio, no pulse, ever. Component is silent.
4. Otherwise, schedules a single playback at a random offset between **10000 ms** and **20000 ms** after mount.
5. At fire time:
   - Plays the audio file from `GET /api/raven-post/newsie?playerId=X` (a `.mp3` blob, see TTS section)
   - Dispatches a custom DOM event `raven-post:newsie-fired` so the nav can react
6. The nav listens for `raven-post:newsie-fired` and applies a CSS class `raven-link-pulse` to the Raven link. The class:
   - Is bright red (`#ff3030`) with a glow text-shadow
   - Pulses (1.4 s ease-in-out infinite) at full intensity for **10 s**
   - Then transitions opacity + color back to default over the next **30 s**
   - Class is removed after 40 s total

If the user navigates away and back to `/players/[id]`, the component re-mounts. The `lastReadAt` check guards against re-firing for content already seen.

**Audio source — ElevenLabs at publish time.** When the DM publishes a Broadsheet item, a server-side hook hits the ElevenLabs API once with a stitched script:

> "News! News! &lt;headline 1&gt;, &lt;headline 2&gt;, &lt;headline 3&gt;! News!"

The MP3 is saved to `DATA_DIR/uploads/raven-post/newsie/<issue-id>.mp3` and served via `GET /api/uploads/raven-post/newsie/[id].mp3`. The headlines API returns the URL of the most recent issue's MP3.

If ElevenLabs is unavailable or out of budget, the component **silently no-ops** (no audio, no pulse) — same pattern as `lib/email.ts`.

### Overheard SMS at the library

Reuses the AR encounter geolocation pattern from `app/ar/AREncounter.tsx`.

A new client component `components/OverheardWatcher.tsx` mounts on the player sheet page (or runs as part of a global player layout):

1. Calls `navigator.geolocation.watchPosition` if the player has opted into SMS *and* has granted location access. (Both gates required.)
2. Computes haversine distance to the library coords (`36.34289`, `−88.85022`). Radius **100 m**. (The Citadel Tree AR encounter at the same coords has been bumped to 100 m radius so the two trigger zones are identical — see `app/ar/AREncounter.tsx`.)
3. On entry to the radius, hits `POST /api/raven-post/overheard/trigger` with the player ID. Server-side:
   - Looks up the player's per-location `last_triggered_at` for "library."
   - **Cooldown:** if the player triggered an overheard from this location in the last **30 minutes**, no-op. (Prevents thrashing as GPS jitters across the radius edge.)
   - Otherwise, pops the FIFO head from the library overheard queue. If the queue is empty, no-op.
   - Inserts a row into `overheard_deliveries` so we never replay the same item to the same player.
   - Calls Twilio: `POST https://api.twilio.com/2010-04-01/Accounts/{SID}/Messages.json` with the body `Overheard at the library — "<body>"`
4. If Twilio is unavailable or the player is over the SMS daily cap, no-op silently (and log).

## Schema

All new tables. Prefix `raven_*` for clarity.

```sql
CREATE TABLE raven_items (
  id            TEXT PRIMARY KEY,                     -- ulid
  medium        TEXT NOT NULL,                        -- 'broadsheet' | 'raven' | 'sending' | 'overheard' | 'ad'
  body          TEXT NOT NULL,
  headline      TEXT,                                 -- broadsheet only
  sender        TEXT,                                 -- raven only
  target_player TEXT,                                 -- raven, sending: player id; null = all
  trust         TEXT NOT NULL DEFAULT 'official',     -- 'official' | 'whispered' | 'rumored' | 'prophesied'
  tags          TEXT[] DEFAULT '{}',                  -- entity tags for callbacks
  ad_image_url  TEXT,                                 -- ads only
  ad_real_link  TEXT,                                 -- ads only — revealed on click
  ad_real_copy  TEXT,                                 -- ads only — revealed on click
  newsie_mp3    TEXT,                                 -- broadsheet only — path to ElevenLabs render
  published_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_raven_items_medium ON raven_items(medium);
CREATE INDEX idx_raven_items_target ON raven_items(target_player) WHERE target_player IS NOT NULL;
CREATE INDEX idx_raven_items_published ON raven_items(published_at DESC);

CREATE TABLE raven_reads (
  player_id     TEXT NOT NULL,
  item_id       TEXT NOT NULL REFERENCES raven_items(id) ON DELETE CASCADE,
  read_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (player_id, item_id)
);

CREATE TABLE raven_overheard_queue (
  id            TEXT PRIMARY KEY,                     -- ulid
  location      TEXT NOT NULL,                        -- 'library' for v1
  body          TEXT NOT NULL,
  trust         TEXT NOT NULL DEFAULT 'rumored',
  position      INTEGER NOT NULL,                     -- ordering within location
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_raven_overheard_loc_pos ON raven_overheard_queue(location, position);

CREATE TABLE raven_overheard_deliveries (
  player_id     TEXT NOT NULL,
  queue_id      TEXT NOT NULL REFERENCES raven_overheard_queue(id) ON DELETE CASCADE,
  delivered_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (player_id, queue_id)
);

CREATE TABLE raven_overheard_triggers (
  player_id     TEXT NOT NULL,
  location      TEXT NOT NULL,
  last_at       TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (player_id, location)
);

-- New columns on player_sheets
ALTER TABLE player_sheets ADD COLUMN IF NOT EXISTS sms_phone TEXT;
ALTER TABLE player_sheets ADD COLUMN IF NOT EXISTS sms_optin BOOLEAN NOT NULL DEFAULT false;

-- New columns on campaign for the broadsheet's Volume / Issue counter
ALTER TABLE campaign ADD COLUMN IF NOT EXISTS raven_volume INTEGER NOT NULL DEFAULT 1;
ALTER TABLE campaign ADD COLUMN IF NOT EXISTS raven_issue INTEGER NOT NULL DEFAULT 1;
ALTER TABLE campaign ADD COLUMN IF NOT EXISTS raven_issues_per_volume INTEGER NOT NULL DEFAULT 12;

-- World weather (minimal v1 — for the banner overlay)
CREATE TABLE IF NOT EXISTS raven_weather (
  hex_id        TEXT PRIMARY KEY,                     -- world hex id, or 'default' for v1 fallback
  condition     TEXT NOT NULL DEFAULT 'clear',        -- 'clear' | 'rain' | 'snow' | 'fog' | 'storm' | 'mist' | 'dust' | 'embers'
  temp_c        INTEGER,
  wind_label    TEXT,                                 -- 'NE wind', 'calm', etc.
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Schema additions go in `lib/schema.ts` inside `ensureSchema()`. Remember the gotcha: `ensureSchema` is memoized, so the dev server must be restarted after adding DDL.

## API routes

All under `app/api/raven-post/`:

| Route | Method | Purpose |
|---|---|---|
| `/api/raven-post/items` | GET | Public — returns published items for `/raven-post`. Filters by `?playerId=X` for personal items (raven, sending). |
| `/api/raven-post/items` | POST | DM — publish a new item. On broadsheet publish, triggers ElevenLabs render of newsie audio. |
| `/api/raven-post/items/:id` | PATCH | DM — edit a published item. |
| `/api/raven-post/items/:id` | DELETE | DM — unpublish. |
| `/api/raven-post/items/:id/read` | POST | Player — mark item read. Insert into `raven_reads`. |
| `/api/raven-post/headlines` | GET | Player — current top 3 headlines + lastReadAt + newsie mp3 url. Used by NewsieCallout. |
| `/api/raven-post/newsie/:issueId` | GET | Public — serves the cached MP3 file. |
| `/api/raven-post/draft` | POST | DM — `{ medium, oneLineBeat }` → Anthropic Haiku → `{ draftBody, draftHeadline }`. |
| `/api/raven-post/overheard/queue` | GET, POST, PATCH, DELETE | DM — manage the overheard FIFO queue. |
| `/api/raven-post/overheard/trigger` | POST | Player — geolocation entry callback. Server pops queue + sends SMS. |
| `/api/weather/current` | GET | Player — weather for the player's current hex (or `default`). |
| `/api/weather` | POST | DM — set weather for a hex (manual override; world-map integration is later). |
| `/api/sms/optin` | POST | Player — set `sms_optin` and `sms_phone` on player_sheets. |

All routes that take user input validate with Zod. All external calls (ElevenLabs, Anthropic, Twilio) go through helper modules with explicit `AbortController` timeouts and silent-on-failure semantics matching `lib/email.ts`.

## Helper modules

- `lib/elevenlabs.ts` — `renderNewsie({ headlines }) → Promise<{ mp3Path: string }>`. No-ops without `ELEVENLABS_API_KEY`. Costs accumulate to budget tracker (see budget tracker spec).
- `lib/twilio.ts` — `sendSms({ to, body }) → Promise<void>`. No-ops without `TWILIO_ACCOUNT_SID`. Honors per-day cap from budget tracker.
- `lib/raven-draft.ts` — `draftBeat({ medium, oneLineBeat }) → Promise<{ headline?, body }>`. Calls Anthropic Haiku with a per-medium prompt. Same pattern as the existing inventory card auto-fill in `app/api/inventory/suggest`.
- `lib/haversine.ts` — already exists in `app/ar/AREncounter.tsx` as a local function. Hoist to `lib/geo.ts` so the new OverheardWatcher can reuse it.

## Components

- `components/RavenPostPage.tsx` — `/raven-post` server component
- `components/RavenBroadsheet.tsx` — the broadsheet visual (extracted so the DM preview can also use it)
- `components/RavenWeatherPill.tsx`
- `components/RavenAdModal.tsx` — opens on ad click, shows real-world details
- `components/NewsieCallout.tsx` — audio + nav pulse trigger
- `components/OverheardWatcher.tsx` — geolocation watch
- `components/PlayerBannerWeather.tsx` — overlay child of PlayerBanner
- `components/dm/RavenManualCompose.tsx` — DM compose pane
- `components/dm/RavenOverheardQueue.tsx` — DM queue pane
- `components/dm/RavenPublishedItems.tsx` — DM published list

## Environment variables

Add to `.env.local` and Railway:

```
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID=    # default: a period-appropriate voice
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM=            # provisioned US number
```

All four are optional — the system silently degrades feature-by-feature if any is missing. (No newsie audio without ElevenLabs. No SMS push without Twilio. Both can be added later without code changes.)

## Constraints, gotchas, and care points

- **`ensureSchema` memoization** — restart the dev server after the new DDL lands.
- **`autoFocus` and page scroll** — the manual compose textarea must NOT have `autoFocus` if it renders on page load.
- **Tailwind v4 + Safari production** — for the page-width broadsheet layout, use inline `style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr' }}` rather than Tailwind grid classes.
- **`next/image` and uploaded MP3 paths** — newsie MP3s are served via `/api/uploads/...`, audio is `<audio>` not `<Image>`, no problem. But if we add ad images served from `/api/uploads/...` they need `<img>`, not `<Image>`, because of the local-path-with-query gotcha.
- **Client components and `lib/db`** — `OverheardWatcher`, `NewsieCallout`, `RavenManualCompose`, etc., must NOT transitively import `lib/db.ts`. Pure helpers (formatters, type guards) live in their own files.
- **Player IDs are not character names.** Routes use IDs (`/players/ashton`).
- **Twilio webhook** — opt-out via `STOP` reply. Twilio handles this automatically at the carrier level for short-code or long-code US numbers; we don't need a webhook in v1, but we should respect the `Twilio-Optout` header on send responses and flip `sms_optin = false` if it appears.
- **SMS character limit** — keep overheard bodies under 320 chars (2 segments). Truncate with ellipsis if longer; warn the DM in the queue UI if a row exceeds.
- **No replays** — the `raven_overheard_deliveries` table is the source of truth. Even if the queue position changes, a delivered row never gets re-sent to the same player.
- **Geolocation cooldown** — 30 minutes per location to absorb GPS jitter.
- **Read-state for newsie** — `lastReadAt` comes from the most recent `raven_reads.read_at` for any broadsheet item. If the player has no reads, treat as forever-old.
- **`tsc --noEmit` clean before deploy.**

## Resolved decisions

These three were "open questions" in the first draft of this spec; the DM has answered them:

- **Volume X / Issue Y numbering — comes from the `campaign` table.** Add columns `raven_volume INTEGER NOT NULL DEFAULT 1` and `raven_issue INTEGER NOT NULL DEFAULT 1` to the `campaign` row. The issue counter increments each time a broadsheet item is published on a new in-fiction date; the volume rolls over according to a DM-configurable cadence (default: every 12 issues = one volume). Both fields are surfaced on `/dm/raven-post` for manual override.
- **Sendings are not in the broadsheet.** They have their own dedicated card on `/raven-post` (per the layout spec above). The broadsheet only carries headlines, classifieds, omens, and the current weather. Sendings are personal and arcane — they would dilute the public-news tone of the broadsheet.
- **Ads are just `medium = 'ad'` items.** No separate publish flow. Classifieds are tagged with `tags = ['classifieds']` for placement; banner-style ads are tagged `tags = ['banner']` or untagged for the default layout. The Ad form on `/dm/raven-post` is one of the medium tabs alongside Broadsheet/Raven/Sending/Overheard.
