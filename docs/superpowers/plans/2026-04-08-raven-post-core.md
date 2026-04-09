# The Raven Post — Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Raven Post player-facing surfaces (`/raven-post` broadsheet, weather banner overlay on `/players/[id]`, newsie audio + pulsing nav, Overheard SMS at the library) and the DM curation page (`/dm/raven-post`) with manual compose, library queue, and published items list. The World AI engine is a separate spec — this plan stops at "DM authors items by hand."

**Architecture:** New `raven_*` tables in `lib/schema.ts`. A set of helper modules (`lib/elevenlabs.ts`, `lib/twilio.ts`, `lib/raven-draft.ts`, `lib/geo.ts`) wrap external services with silent-on-failure semantics matching `lib/email.ts`. The `lib/spend.ts` helper from the budget tracker plan gates every external call. Server components for the read-only player page, client components for the DM compose form and the player-side audio/geo watchers.

**Tech Stack:** Next.js 16 App Router, Postgres via `pg.Pool`, Tailwind v4 with inline `style` for layout-critical surfaces, ElevenLabs HTTP API, Twilio Messaging API, Anthropic Haiku for AI drafts.

**Ship target:** Sunday 2026-04-19.

**Prerequisite:** The Budget Tracker plan (`2026-04-08-raven-post-budget-tracker.md`) lands first. Specifically `lib/spend.ts` must exist with `assertCanSpend()`, `record()`, and `BudgetExceededError`.

**Build / verify commands:**
- Type check: `npx tsc --noEmit 2>&1 | grep -v ".next/types"`
- Production build: `npm run build`
- Lint: `npm run lint`
- Dev server: `npx next dev -p 3000` (must restart after any DDL change)

---

## File structure

**Helper modules (lib/):**
- Create: `lib/geo.ts` — haversine + bearing helpers (hoisted from `app/ar/AREncounter.tsx`)
- Create: `lib/elevenlabs.ts` — TTS render with budget gate
- Create: `lib/twilio.ts` — SMS send with budget gate
- Create: `lib/raven-draft.ts` — Anthropic Haiku one-line-beat → draft
- Create: `lib/raven-post.ts` — high-level Raven Post operations (publishItem, popOverheard, etc.) used by routes

**Schema + types:**
- Modify: `lib/schema.ts` — add the raven_* tables and column ALTERs
- Modify: `lib/types.ts` — add Raven Post types

**API routes (app/api/):**
- Create: `app/api/raven-post/items/route.ts` — GET (player), POST (DM publish)
- Create: `app/api/raven-post/items/[id]/route.ts` — PATCH, DELETE
- Create: `app/api/raven-post/items/[id]/read/route.ts` — POST (player marks read)
- Create: `app/api/raven-post/headlines/route.ts` — GET (player; for NewsieCallout)
- Create: `app/api/raven-post/draft/route.ts` — POST (DM; one-line beat → AI prose)
- Create: `app/api/raven-post/overheard/queue/route.ts` — GET, POST, PATCH, DELETE
- Create: `app/api/raven-post/overheard/queue/[id]/route.ts` — PATCH, DELETE single row
- Create: `app/api/raven-post/overheard/trigger/route.ts` — POST (player geo entry)
- Create: `app/api/uploads/raven-post/newsie/[filename]/route.ts` — serve cached MP3s
- Create: `app/api/weather/current/route.ts` — GET
- Create: `app/api/weather/route.ts` — POST (DM override)
- Create: `app/api/sms/optin/route.ts` — POST

**Pages:**
- Create: `app/raven-post/page.tsx` — player broadsheet (server component)
- Create: `app/dm/raven-post/page.tsx` — DM curation (server component shell)

**Components:**
- Create: `components/RavenBroadsheet.tsx` — broadsheet visual (used by player page + DM preview later)
- Create: `components/RavenWeatherPill.tsx` — corner weather pill
- Create: `components/RavenAdModal.tsx` — clickable ad → real-world details modal
- Create: `components/NewsieCallout.tsx` — audio + nav-pulse trigger (client)
- Create: `components/OverheardWatcher.tsx` — geolocation watcher (client)
- Create: `components/PlayerBannerWeather.tsx` — animated weather overlay
- Create: `components/dm/RavenManualCompose.tsx` — DM compose pane (client)
- Create: `components/dm/RavenOverheardQueue.tsx` — DM queue pane (client)
- Create: `components/dm/RavenPublishedItems.tsx` — DM published list (client)

**Player sheet integration:**
- Modify: `app/players/[id]/page.tsx` — add "The Raven" nav link, mount `<NewsieCallout>` and `<OverheardWatcher>`
- Modify: `components/PlayerBanner.tsx` — render `<PlayerBannerWeather>` overlay
- Modify: `components/DmNav.tsx` — add 'raven-post' to NavSection + LINKS
- Modify: `app/ar/AREncounter.tsx` — DELETE the local `haversine`/`bearingDeg` functions and import from `lib/geo.ts` (the radius bump to 100m is already on disk)

---

## Task 1: Schema additions and types

**Files:**
- Modify: `lib/schema.ts`
- Modify: `lib/types.ts`

- [ ] **Step 1: Add the new tables and column ALTERs to `lib/schema.ts`**

In `_initSchema()`, find a clean insertion point (after the budget tracker block from the parallel plan, or after the world map block if that landed first). Append:

```ts
  // ── Raven Post: items, reads, overheard queue, weather, opt-in ─────────────
  // The whole feature lives behind the raven_* prefix. Items are unified
  // across mediums via a `medium` discriminator.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS raven_items (
      id            TEXT PRIMARY KEY,
      medium        TEXT NOT NULL,
      body          TEXT NOT NULL,
      headline      TEXT,
      sender        TEXT,
      target_player TEXT,
      trust         TEXT NOT NULL DEFAULT 'official',
      tags          TEXT[] DEFAULT '{}',
      ad_image_url  TEXT,
      ad_real_link  TEXT,
      ad_real_copy  TEXT,
      newsie_mp3    TEXT,
      published_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `).catch(() => {});

  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_raven_items_medium ON raven_items(medium)`
  ).catch(() => {});
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_raven_items_target ON raven_items(target_player) WHERE target_player IS NOT NULL`
  ).catch(() => {});
  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_raven_items_published ON raven_items(published_at DESC)`
  ).catch(() => {});

  await pool.query(`
    CREATE TABLE IF NOT EXISTS raven_reads (
      player_id     TEXT NOT NULL,
      item_id       TEXT NOT NULL REFERENCES raven_items(id) ON DELETE CASCADE,
      read_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (player_id, item_id)
    )
  `).catch(() => {});

  await pool.query(`
    CREATE TABLE IF NOT EXISTS raven_overheard_queue (
      id            TEXT PRIMARY KEY,
      location      TEXT NOT NULL,
      body          TEXT NOT NULL,
      trust         TEXT NOT NULL DEFAULT 'rumored',
      position      INTEGER NOT NULL,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `).catch(() => {});

  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_raven_overheard_loc_pos ON raven_overheard_queue(location, position)`
  ).catch(() => {});

  await pool.query(`
    CREATE TABLE IF NOT EXISTS raven_overheard_deliveries (
      player_id     TEXT NOT NULL,
      queue_id      TEXT NOT NULL REFERENCES raven_overheard_queue(id) ON DELETE CASCADE,
      delivered_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (player_id, queue_id)
    )
  `).catch(() => {});

  await pool.query(`
    CREATE TABLE IF NOT EXISTS raven_overheard_triggers (
      player_id     TEXT NOT NULL,
      location      TEXT NOT NULL,
      last_at       TIMESTAMPTZ NOT NULL,
      PRIMARY KEY (player_id, location)
    )
  `).catch(() => {});

  await pool.query(`
    CREATE TABLE IF NOT EXISTS raven_weather (
      hex_id        TEXT PRIMARY KEY,
      condition     TEXT NOT NULL DEFAULT 'clear',
      temp_c        INTEGER,
      wind_label    TEXT,
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `).catch(() => {});

  // Seed the 'default' weather row so /api/weather/current always has something
  await pool.query(`
    INSERT INTO raven_weather (hex_id, condition, temp_c, wind_label)
    VALUES ('default', 'clear', 16, 'calm')
    ON CONFLICT (hex_id) DO NOTHING
  `).catch(() => {});

  // Player sheets gain SMS opt-in fields
  await pool.query(
    `ALTER TABLE player_sheets ADD COLUMN IF NOT EXISTS sms_phone TEXT`
  ).catch(() => {});
  await pool.query(
    `ALTER TABLE player_sheets ADD COLUMN IF NOT EXISTS sms_optin BOOLEAN NOT NULL DEFAULT false`
  ).catch(() => {});

  // Campaign gains the broadsheet's Volume / Issue counter
  await pool.query(
    `ALTER TABLE campaign ADD COLUMN IF NOT EXISTS raven_volume INTEGER NOT NULL DEFAULT 1`
  ).catch(() => {});
  await pool.query(
    `ALTER TABLE campaign ADD COLUMN IF NOT EXISTS raven_issue INTEGER NOT NULL DEFAULT 1`
  ).catch(() => {});
  await pool.query(
    `ALTER TABLE campaign ADD COLUMN IF NOT EXISTS raven_issues_per_volume INTEGER NOT NULL DEFAULT 12`
  ).catch(() => {});
```

- [ ] **Step 2: Add types to `lib/types.ts`**

Append:

```ts
// ── Raven Post ─────────────────────────────────────────────────────────────

export type RavenMedium = 'broadsheet' | 'raven' | 'sending' | 'overheard' | 'ad';
export type RavenTrust = 'official' | 'whispered' | 'rumored' | 'prophesied';
export type WeatherCondition = 'clear' | 'rain' | 'snow' | 'fog' | 'storm' | 'mist' | 'dust' | 'embers';

export interface RavenItem {
  id: string;
  medium: RavenMedium;
  body: string;
  headline: string | null;
  sender: string | null;
  target_player: string | null;
  trust: RavenTrust;
  tags: string[];
  ad_image_url: string | null;
  ad_real_link: string | null;
  ad_real_copy: string | null;
  newsie_mp3: string | null;
  published_at: string;
  created_at: string;
}

export interface RavenOverheardQueueRow {
  id: string;
  location: string;
  body: string;
  trust: RavenTrust;
  position: number;
  created_at: string;
  delivered_to: string[]; // joined on read for convenience
}

export interface RavenWeatherRow {
  hex_id: string;
  condition: WeatherCondition;
  temp_c: number | null;
  wind_label: string | null;
  updated_at: string;
}

export interface RavenHeadlinesPayload {
  headlines: { id: string; headline: string; published_at: string }[];
  newsie_mp3_url: string | null;
  last_read_at: string | null;
  newest_published_at: string | null;
}
```

- [ ] **Step 3: Restart the dev server**

```bash
lsof -i :3000 -t | xargs kill 2>/dev/null
npx next dev -p 3000 &
sleep 3
curl -s http://localhost:3000/api/health > /dev/null  # any route triggers ensureSchema()
```

- [ ] **Step 4: Verify all tables exist**

```bash
psql "$DATABASE_URL" -c "\dt raven_*"
psql "$DATABASE_URL" -c "\d raven_items"
psql "$DATABASE_URL" -c "SELECT * FROM raven_weather"
# Expected: shows 6 raven_* tables, raven_items columns, the seeded 'default' weather row
```

Type-check:
```bash
npx tsc --noEmit 2>&1 | grep -v ".next/types"
# Expected: clean
```

- [ ] **Step 5: Commit**

```bash
git add lib/schema.ts lib/types.ts
git commit -m "feat(raven-post): schema for items, queue, weather, sms opt-in"
```

---

## Task 2: `lib/geo.ts` — hoist haversine + bearing from AR

**Files:**
- Create: `lib/geo.ts`
- Modify: `app/ar/AREncounter.tsx`

The AR encounter has local `haversine` and `bearingDeg` functions. The OverheardWatcher needs the same math, so hoist it.

- [ ] **Step 1: Create `lib/geo.ts`**

```ts
// Pure geography helpers — hoisted from app/ar/AREncounter.tsx so the
// Raven Post Overheard watcher and the AR encounter share one source.

/** Distance in meters between two lat/lng pairs (haversine). */
export function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Forward bearing in degrees (0 = N, 90 = E) from (lat1,lng1) toward (lat2,lng2). */
export function bearingDeg(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

const COMPASS_POINTS = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'] as const;

export function compassWord(deg: number): string {
  const idx = Math.round(deg / 45) % 8;
  return COMPASS_POINTS[idx];
}
```

- [ ] **Step 2: Update `app/ar/AREncounter.tsx` to import from `lib/geo.ts`**

Find the local `haversine`, `bearingDeg`, and `compassWord` functions (currently around lines 75–102) and **delete them**. At the top of the file, after the existing imports, add:

```tsx
import { haversine, bearingDeg, compassWord } from '@/lib/geo';
```

- [ ] **Step 3: Type-check + build**

```bash
npx tsc --noEmit 2>&1 | grep -v ".next/types"
npm run build
```

Both must succeed. The AR encounter still works because it imports the same functions.

- [ ] **Step 4: Eyeball the AR page**

Open `http://localhost:3000/ar` and verify it loads (you don't need GPS access for the page to render — the geolocation gate handles that internally). No console errors related to `haversine` or `bearingDeg`.

- [ ] **Step 5: Commit**

```bash
git add lib/geo.ts app/ar/AREncounter.tsx
git commit -m "refactor(geo): hoist haversine + bearing helpers to lib/geo.ts"
```

---

## Task 3: `lib/elevenlabs.ts` — TTS render helper

**Files:**
- Create: `lib/elevenlabs.ts`

- [ ] **Step 1: Create the helper**

```ts
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { assertCanSpend, record, BudgetExceededError } from './spend';

const UPLOAD_DIR = `${process.env.DATA_DIR ?? '/data'}/uploads/raven-post/newsie`;
const PUBLIC_PREFIX = '/api/uploads/raven-post/newsie';

// ElevenLabs charges per character of input text. As of 2026-04 the
// Starter plan is $5 / 30k chars = ~$0.000167/char.
const ELEVENLABS_USD_PER_CHAR = 0.000167;

interface RenderArgs {
  /** A list of headline strings; the helper stitches them into a single newsie shout. */
  headlines: string[];
}

interface RenderResult {
  mp3PublicUrl: string;
  filename: string;
}

/**
 * Render a newsie audio clip with ElevenLabs and cache it on disk.
 *
 * Silently no-ops (returns null) if:
 *  - ELEVENLABS_API_KEY is not set
 *  - the budget is paused or exhausted
 *  - the API call fails for any reason
 *
 * On success returns the public URL the player can hit.
 */
export async function renderNewsie({ headlines }: RenderArgs): Promise<RenderResult | null> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey || headlines.length === 0) return null;

  try {
    await assertCanSpend('elevenlabs');
  } catch (err) {
    if (err instanceof BudgetExceededError) {
      console.log('renderNewsie: skipped — budget paused');
      return null;
    }
    throw err;
  }

  // Build the script. Period-flavored barker patter.
  const script = `News! News! ${headlines.join('. ')}. News!`;
  const charCount = script.length;

  const voiceId = process.env.ELEVENLABS_VOICE_ID ?? 'EXAVITQu4vr4xnSDxMaL'; // Bella default

  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'content-type': 'application/json',
          accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text: script,
          model_id: 'eleven_multilingual_v2',
          voice_settings: { stability: 0.55, similarity_boost: 0.75 },
        }),
        signal: AbortSignal.timeout(20_000),
      },
    );

    if (!res.ok) {
      console.error('renderNewsie failed:', res.status, await res.text().catch(() => ''));
      return null;
    }

    const mp3 = Buffer.from(await res.arrayBuffer());
    await mkdir(UPLOAD_DIR, { recursive: true });
    const filename = `${randomUUID()}.mp3`;
    await writeFile(join(UPLOAD_DIR, filename), mp3);

    const cost = charCount * ELEVENLABS_USD_PER_CHAR;
    await record({
      service: 'elevenlabs',
      amount_usd: cost,
      units: charCount,
      unit_kind: 'chars',
      details: { filename, voiceId, model: 'eleven_multilingual_v2' },
      ref: { table: 'raven_items', id: filename },
    });

    return {
      mp3PublicUrl: `${PUBLIC_PREFIX}/${filename}`,
      filename,
    };
  } catch (err) {
    console.error('renderNewsie error:', err);
    return null;
  }
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep -v ".next/types"
```

- [ ] **Step 3: Commit**

```bash
git add lib/elevenlabs.ts
git commit -m "feat(raven-post): lib/elevenlabs.ts — newsie TTS with budget gate"
```

---

## Task 4: `lib/twilio.ts` — SMS send helper

**Files:**
- Create: `lib/twilio.ts`

- [ ] **Step 1: Create the helper**

```ts
import { assertCanSpend, record, BudgetExceededError } from './spend';

interface SendArgs {
  to: string;     // E.164 format: +15551234567
  body: string;   // already truncated to 320 chars by the caller
}

interface TwilioResponse {
  sid: string;
  price?: string | null;        // negative number as string, e.g. "-0.0079"
  price_unit?: string | null;   // "USD"
  status: string;
}

/**
 * Send an SMS via Twilio. Silently no-ops if any required env var is missing,
 * if the budget is paused, or if the API call fails.
 *
 * Cost recording: Twilio returns the per-message price in the response. We
 * record the absolute value so the ledger amounts are positive.
 */
export async function sendSms({ to, body }: SendArgs): Promise<boolean> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM;

  if (!sid || !token || !from || !to) return false;

  try {
    await assertCanSpend('twilio');
  } catch (err) {
    if (err instanceof BudgetExceededError) {
      console.log('sendSms: skipped — budget paused');
      return false;
    }
    throw err;
  }

  // Twilio Messaging API uses Basic auth with account SID + auth token.
  const auth = Buffer.from(`${sid}:${token}`).toString('base64');

  const params = new URLSearchParams();
  params.set('To', to);
  params.set('From', from);
  params.set('Body', body.slice(0, 320));

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          authorization: `Basic ${auth}`,
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: params,
        signal: AbortSignal.timeout(15_000),
      },
    );

    if (!res.ok) {
      console.error('sendSms failed:', res.status, await res.text().catch(() => ''));
      return false;
    }

    const tw: TwilioResponse = await res.json();
    const priceUsd = tw.price ? Math.abs(parseFloat(tw.price)) : 0.008;

    await record({
      service: 'twilio',
      amount_usd: priceUsd,
      units: 1,
      unit_kind: 'sms',
      details: { sid: tw.sid, status: tw.status, to_masked: to.slice(0, 5) + '****' },
    });

    return true;
  } catch (err) {
    console.error('sendSms error:', err);
    return false;
  }
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep -v ".next/types"
```

- [ ] **Step 3: Commit**

```bash
git add lib/twilio.ts
git commit -m "feat(raven-post): lib/twilio.ts — SMS helper with budget gate"
```

---

## Task 5: `lib/raven-draft.ts` — Anthropic Haiku one-line beat → prose

**Files:**
- Create: `lib/raven-draft.ts`

- [ ] **Step 1: Create the helper**

```ts
import Anthropic from '@anthropic-ai/sdk';
import { assertCanSpend, record, BudgetExceededError } from './spend';
import { anthropicCost } from './anthropic-pricing';
import type { RavenMedium } from './types';

interface DraftArgs {
  medium: RavenMedium;
  oneLineBeat: string;
}

interface DraftResult {
  headline: string | null;
  body: string;
}

const SYSTEM_PROMPTS: Record<RavenMedium, string> = {
  broadsheet: `You are the in-fiction editor of "The Raven Post," a fortnightly broadsheet in a fantasy D&D 5e setting. The DM gives you a one-line beat. Return JSON: { "headline": "...", "body": "..." }. Rules: headline ≤ 60 chars; body 2-4 sentences, 50-90 words; period-appropriate prose; never break the fiction; no modern idioms; never use em-dashes.`,
  raven: `You are an in-fiction NPC writing a sealed letter to a player character. The DM gives you a one-line beat. Return JSON: { "headline": null, "body": "..." }. Rules: body 1-3 sentences; intimate, urgent voice; period-appropriate; no modern idioms; never use em-dashes.`,
  sending: `You are the cryptic arcane voice of a magical Sending. The DM gives you a one-line beat. Return JSON: { "headline": null, "body": "..." }. Rules: body MUST be ≤25 words exactly; cryptic, fragmentary, prophetic; no greeting, no signature; never break the fiction; never use em-dashes.`,
  overheard: `You are an in-fiction tavern gossip. The DM gives you a one-line beat. Return JSON: { "headline": null, "body": "..." }. Rules: body 1-3 sentences in quotes; an unreliable witness voice; period-appropriate; no modern idioms; never use em-dashes.`,
  ad: `You are the in-fiction copywriter for a Raven Post classified ad. The DM gives you a one-line beat. Return JSON: { "headline": null, "body": "..." }. Rules: body 2-3 sentences; period-appropriate; no real-world prices, links, or vendor names; never use em-dashes.`,
};

export async function draftBeat({ medium, oneLineBeat }: DraftArgs): Promise<DraftResult | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || !oneLineBeat.trim()) return null;

  try {
    await assertCanSpend('anthropic');
  } catch (err) {
    if (err instanceof BudgetExceededError) return null;
    throw err;
  }

  const client = new Anthropic({ apiKey });
  const model = 'claude-haiku-4-5-20251001';

  try {
    const message = await client.messages.create({
      model,
      max_tokens: 400,
      system: SYSTEM_PROMPTS[medium],
      messages: [{ role: 'user', content: `Beat: ${oneLineBeat.trim()}` }],
    });

    // Record the cost
    const usage = message.usage;
    if (usage) {
      const cost = anthropicCost(model, usage.input_tokens, usage.output_tokens);
      await record({
        service: 'anthropic',
        amount_usd: cost,
        units: usage.input_tokens + usage.output_tokens,
        unit_kind: 'tok_total',
        details: { model, medium, input_tokens: usage.input_tokens, output_tokens: usage.output_tokens },
      });
    }

    const text = message.content[0]?.type === 'text' ? message.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]) as { headline?: string | null; body?: string };
    if (!parsed.body) return null;

    let body = parsed.body.trim();
    // Sending hard cap at 25 words
    if (medium === 'sending') {
      const words = body.split(/\s+/);
      if (words.length > 25) body = words.slice(0, 25).join(' ');
    }

    return {
      headline: parsed.headline?.trim() || null,
      body,
    };
  } catch (err) {
    console.error('draftBeat error:', err);
    return null;
  }
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep -v ".next/types"
```

- [ ] **Step 3: Commit**

```bash
git add lib/raven-draft.ts
git commit -m "feat(raven-post): lib/raven-draft.ts — Haiku one-line-beat draft helper"
```

---

## Task 6: `lib/raven-post.ts` — high-level operations

**Files:**
- Create: `lib/raven-post.ts`

This is the orchestration layer used by API routes. It encapsulates:
- Publishing an item (and triggering the newsie render for broadsheet items)
- Popping the overheard FIFO + sending the SMS + recording the delivery
- Volume / Issue counter updates

- [ ] **Step 1: Create the file**

```ts
import { randomUUID } from 'crypto';
import { query, withTransaction } from './db';
import { ensureSchema } from './schema';
import { renderNewsie } from './elevenlabs';
import { sendSms } from './twilio';
import type { RavenItem, RavenMedium, RavenTrust } from './types';

// Library coords (Citadel Tree). v1 hardcoded; future versions support
// multiple registered locations.
export const LIBRARY_COORDS = { lat: 36.34289, lng: -88.85022, radius_m: 100 };
export const LIBRARY_LOCATION = 'library';

// 30-minute cooldown to absorb GPS jitter
const TRIGGER_COOLDOWN_MS = 30 * 60 * 1000;

// SMS body cap — 320 chars = 2 SMS segments
const SMS_BODY_MAX = 320;

interface PublishArgs {
  medium: RavenMedium;
  body: string;
  headline?: string | null;
  sender?: string | null;
  target_player?: string | null;
  trust?: RavenTrust;
  tags?: string[];
  ad_image_url?: string | null;
  ad_real_link?: string | null;
  ad_real_copy?: string | null;
}

/**
 * Insert a new raven_items row, then for broadsheets render the newsie audio
 * for the latest 3 headlines and update the row with the mp3 path.
 *
 * Returns the published row (with newsie_mp3 populated if successfully rendered).
 */
export async function publishItem(args: PublishArgs): Promise<RavenItem> {
  await ensureSchema();
  const id = randomUUID();

  const rows = await query<RavenItem>(
    `INSERT INTO raven_items
       (id, medium, body, headline, sender, target_player, trust, tags,
        ad_image_url, ad_real_link, ad_real_copy)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [
      id,
      args.medium,
      args.body,
      args.headline ?? null,
      args.sender ?? null,
      args.target_player ?? null,
      args.trust ?? 'official',
      args.tags ?? [],
      args.ad_image_url ?? null,
      args.ad_real_link ?? null,
      args.ad_real_copy ?? null,
    ],
  );

  const item = rows[0];

  // For broadsheet items, advance the issue counter and render the newsie.
  if (args.medium === 'broadsheet') {
    await advanceIssueCounter();
    await renderNewsieForLatest(item.id);
  }

  return item;
}

async function advanceIssueCounter(): Promise<void> {
  await query(
    `UPDATE campaign
     SET raven_issue = CASE
       WHEN raven_issue + 1 > raven_issues_per_volume THEN 1
       ELSE raven_issue + 1
     END,
     raven_volume = CASE
       WHEN raven_issue + 1 > raven_issues_per_volume THEN raven_volume + 1
       ELSE raven_volume
     END
     WHERE id = 'default'`,
  );
}

/**
 * Render newsie audio for the most recent 3 broadsheet headlines and store
 * the public mp3 URL on the just-published item. Silent no-op on failure.
 */
async function renderNewsieForLatest(itemId: string): Promise<void> {
  const headlines = await query<{ headline: string }>(
    `SELECT headline FROM raven_items
     WHERE medium = 'broadsheet' AND headline IS NOT NULL
     ORDER BY published_at DESC
     LIMIT 3`,
  );

  if (headlines.length === 0) return;
  const result = await renderNewsie({ headlines: headlines.map(h => h.headline) });
  if (!result) return;

  await query(
    `UPDATE raven_items SET newsie_mp3 = $1 WHERE id = $2`,
    [result.mp3PublicUrl, itemId],
  );
}

/**
 * Geolocation entry callback. Pops the FIFO head of the library overheard
 * queue (if any), records delivery, sends SMS to the player, returns whether
 * anything was actually sent.
 *
 * Returns:
 *   - 'sent'      — popped a row and SMS was attempted
 *   - 'cooldown'  — player triggered too recently, no-op
 *   - 'empty'     — queue is empty
 *   - 'no-optin'  — player has not opted into SMS or has no phone
 *   - 'no-twilio' — Twilio is not configured (silent degrade)
 */
export async function triggerOverheard(playerId: string): Promise<
  'sent' | 'cooldown' | 'empty' | 'no-optin' | 'no-twilio'
> {
  await ensureSchema();

  // Cooldown check
  const triggers = await query<{ last_at: string }>(
    `SELECT last_at FROM raven_overheard_triggers
     WHERE player_id = $1 AND location = $2`,
    [playerId, LIBRARY_LOCATION],
  );
  if (triggers.length > 0) {
    const last = new Date(triggers[0].last_at).getTime();
    if (Date.now() - last < TRIGGER_COOLDOWN_MS) return 'cooldown';
  }

  // Player opt-in + phone check
  const players = await query<{ sms_phone: string | null; sms_optin: boolean }>(
    `SELECT sms_phone, sms_optin FROM player_sheets WHERE id = $1`,
    [playerId],
  );
  if (players.length === 0 || !players[0].sms_optin || !players[0].sms_phone) {
    // Still update the trigger so we don't spam ourselves checking
    await upsertTrigger(playerId);
    return 'no-optin';
  }
  const phone = players[0].sms_phone;

  // Pop the next undelivered queue row inside a transaction to avoid races
  const popped = await withTransaction(async (client) => {
    const result = await client.query<{ id: string; body: string }>(
      `SELECT q.id, q.body
       FROM raven_overheard_queue q
       WHERE q.location = $1
         AND NOT EXISTS (
           SELECT 1 FROM raven_overheard_deliveries d
           WHERE d.player_id = $2 AND d.queue_id = q.id
         )
       ORDER BY q.position ASC, q.created_at ASC
       LIMIT 1
       FOR UPDATE SKIP LOCKED`,
      [LIBRARY_LOCATION, playerId],
    );
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    await client.query(
      `INSERT INTO raven_overheard_deliveries (player_id, queue_id) VALUES ($1, $2)`,
      [playerId, row.id],
    );
    return row;
  });

  if (!popped) {
    await upsertTrigger(playerId);
    return 'empty';
  }

  // Always update the trigger so cooldown applies even on send failure
  await upsertTrigger(playerId);

  const smsBody = `Overheard at the library — "${popped.body}"`.slice(0, SMS_BODY_MAX);
  const sent = await sendSms({ to: phone, body: smsBody });
  return sent ? 'sent' : 'no-twilio';
}

async function upsertTrigger(playerId: string): Promise<void> {
  await query(
    `INSERT INTO raven_overheard_triggers (player_id, location, last_at)
     VALUES ($1, $2, now())
     ON CONFLICT (player_id, location)
     DO UPDATE SET last_at = now()`,
    [playerId, LIBRARY_LOCATION],
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep -v ".next/types"
```

- [ ] **Step 3: Commit**

```bash
git add lib/raven-post.ts
git commit -m "feat(raven-post): lib/raven-post.ts — publish + overheard orchestration"
```

---

## Task 7: API — `/api/raven-post/items` (GET + POST) and `/items/[id]` (PATCH, DELETE)

**Files:**
- Create: `app/api/raven-post/items/route.ts`
- Create: `app/api/raven-post/items/[id]/route.ts`
- Create: `app/api/raven-post/items/[id]/read/route.ts`

- [ ] **Step 1: Create `app/api/raven-post/items/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import { publishItem } from '@/lib/raven-post';
import type { RavenItem, RavenMedium, RavenTrust } from '@/lib/types';

const VALID_MEDIA: RavenMedium[] = ['broadsheet', 'raven', 'sending', 'overheard', 'ad'];
const VALID_TRUST: RavenTrust[] = ['official', 'whispered', 'rumored', 'prophesied'];

// GET /api/raven-post/items?playerId=X
// Returns published items. Personal items (raven, sending) filter to the
// requested player; broadsheet/ad/omen items are universal.
export async function GET(req: Request) {
  try {
    await ensureSchema();
    const url = new URL(req.url);
    const playerId = url.searchParams.get('playerId');

    let rows: RavenItem[];
    if (playerId) {
      rows = await query<RavenItem>(
        `SELECT * FROM raven_items
         WHERE medium IN ('broadsheet', 'ad', 'overheard')
            OR (medium IN ('raven', 'sending') AND target_player = $1)
         ORDER BY published_at DESC
         LIMIT 200`,
        [playerId],
      );
    } else {
      rows = await query<RavenItem>(
        `SELECT * FROM raven_items
         WHERE medium IN ('broadsheet', 'ad', 'overheard')
         ORDER BY published_at DESC
         LIMIT 200`,
      );
    }
    return NextResponse.json(rows);
  } catch (err) {
    console.error('GET /api/raven-post/items', err);
    return NextResponse.json({ error: 'fetch failed' }, { status: 500 });
  }
}

// POST /api/raven-post/items — publish a new item (DM)
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { medium, body: text, headline, sender, target_player, trust, tags,
            ad_image_url, ad_real_link, ad_real_copy } = body as Record<string, unknown>;

    if (typeof medium !== 'string' || !VALID_MEDIA.includes(medium as RavenMedium)) {
      return NextResponse.json({ error: 'medium must be: ' + VALID_MEDIA.join(', ') }, { status: 400 });
    }
    if (typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json({ error: 'body is required' }, { status: 400 });
    }
    if (text.length > 2000) {
      return NextResponse.json({ error: 'body must be under 2000 chars' }, { status: 400 });
    }
    if (medium === 'sending') {
      const words = text.trim().split(/\s+/);
      if (words.length > 25) {
        return NextResponse.json({ error: 'sendings must be 25 words or fewer' }, { status: 400 });
      }
    }
    if (medium === 'broadsheet' && (!headline || typeof headline !== 'string')) {
      return NextResponse.json({ error: 'broadsheet items require a headline' }, { status: 400 });
    }
    if ((medium === 'raven' || medium === 'sending') && (!target_player || typeof target_player !== 'string')) {
      return NextResponse.json({ error: 'raven and sending require target_player' }, { status: 400 });
    }
    if (trust !== undefined && !VALID_TRUST.includes(trust as RavenTrust)) {
      return NextResponse.json({ error: 'invalid trust tier' }, { status: 400 });
    }

    const tagsArray: string[] = Array.isArray(tags)
      ? tags.filter((t): t is string => typeof t === 'string').slice(0, 30)
      : [];

    const item = await publishItem({
      medium: medium as RavenMedium,
      body: text.trim(),
      headline: typeof headline === 'string' ? headline.trim() : null,
      sender: typeof sender === 'string' ? sender.trim() : null,
      target_player: typeof target_player === 'string' ? target_player : null,
      trust: (trust as RavenTrust) ?? 'official',
      tags: tagsArray,
      ad_image_url: typeof ad_image_url === 'string' ? ad_image_url : null,
      ad_real_link: typeof ad_real_link === 'string' ? ad_real_link : null,
      ad_real_copy: typeof ad_real_copy === 'string' ? ad_real_copy : null,
    });

    return NextResponse.json(item, { status: 201 });
  } catch (err) {
    console.error('POST /api/raven-post/items', err);
    return NextResponse.json({ error: 'publish failed' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create `app/api/raven-post/items/[id]/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import type { RavenItem } from '@/lib/types';

interface Props {
  params: Promise<{ id: string }>;
}

// PATCH /api/raven-post/items/:id — edit an existing item (DM)
export async function PATCH(req: Request, { params }: Props) {
  try {
    await ensureSchema();
    const { id } = await params;
    const body = await req.json();

    const sets: string[] = [];
    const vals: unknown[] = [];

    if (typeof body.body === 'string') {
      sets.push(`body = $${vals.length + 1}`);
      vals.push(body.body.trim().slice(0, 2000));
    }
    if (typeof body.headline === 'string') {
      sets.push(`headline = $${vals.length + 1}`);
      vals.push(body.headline.trim().slice(0, 200));
    }
    if (typeof body.sender === 'string') {
      sets.push(`sender = $${vals.length + 1}`);
      vals.push(body.sender.trim().slice(0, 200));
    }
    if (Array.isArray(body.tags)) {
      sets.push(`tags = $${vals.length + 1}`);
      vals.push(body.tags.filter((t: unknown): t is string => typeof t === 'string').slice(0, 30));
    }
    if (typeof body.trust === 'string') {
      sets.push(`trust = $${vals.length + 1}`);
      vals.push(body.trust);
    }

    if (sets.length === 0) {
      return NextResponse.json({ error: 'no fields to update' }, { status: 400 });
    }

    vals.push(id);
    const rows = await query<RavenItem>(
      `UPDATE raven_items SET ${sets.join(', ')} WHERE id = $${vals.length} RETURNING *`,
      vals,
    );
    if (rows.length === 0) {
      return NextResponse.json({ error: 'not found' }, { status: 404 });
    }
    return NextResponse.json(rows[0]);
  } catch (err) {
    console.error('PATCH /api/raven-post/items/[id]', err);
    return NextResponse.json({ error: 'update failed' }, { status: 500 });
  }
}

// DELETE /api/raven-post/items/:id — unpublish (DM)
export async function DELETE(_req: Request, { params }: Props) {
  try {
    await ensureSchema();
    const { id } = await params;
    await query(`DELETE FROM raven_items WHERE id = $1`, [id]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/raven-post/items/[id]', err);
    return NextResponse.json({ error: 'delete failed' }, { status: 500 });
  }
}
```

- [ ] **Step 3: Create `app/api/raven-post/items/[id]/read/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';

interface Props {
  params: Promise<{ id: string }>;
}

// POST /api/raven-post/items/:id/read — player marks an item as read
// Body: { playerId: string }
export async function POST(req: Request, { params }: Props) {
  try {
    await ensureSchema();
    const { id } = await params;
    const body = await req.json();
    const playerId = typeof body.playerId === 'string' ? body.playerId : null;
    if (!playerId) {
      return NextResponse.json({ error: 'playerId required' }, { status: 400 });
    }
    await query(
      `INSERT INTO raven_reads (player_id, item_id) VALUES ($1, $2)
       ON CONFLICT (player_id, item_id) DO UPDATE SET read_at = now()`,
      [playerId, id],
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('POST /api/raven-post/items/[id]/read', err);
    return NextResponse.json({ error: 'mark read failed' }, { status: 500 });
  }
}
```

- [ ] **Step 4: Smoke test**

Restart dev server. Then:

```bash
# Publish a broadsheet item
curl -s -X POST -H "content-type: application/json" \
  -d '{"medium":"broadsheet","headline":"Test headline","body":"Test body of the broadsheet."}' \
  http://localhost:3000/api/raven-post/items
# Expected: 201 + JSON of the new row

# Fetch it
curl -s http://localhost:3000/api/raven-post/items
# Expected: array containing the row above
```

- [ ] **Step 5: Commit**

```bash
git add app/api/raven-post/items
git commit -m "feat(raven-post): items GET/POST/PATCH/DELETE/read"
```

---

## Task 8: API — `/api/raven-post/draft`, `/headlines`, newsie MP3 server

**Files:**
- Create: `app/api/raven-post/draft/route.ts`
- Create: `app/api/raven-post/headlines/route.ts`
- Create: `app/api/uploads/raven-post/newsie/[filename]/route.ts`

- [ ] **Step 1: Create `app/api/raven-post/draft/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { draftBeat } from '@/lib/raven-draft';
import type { RavenMedium } from '@/lib/types';

const VALID_MEDIA: RavenMedium[] = ['broadsheet', 'raven', 'sending', 'overheard', 'ad'];

// POST /api/raven-post/draft
// Body: { medium: RavenMedium, oneLineBeat: string }
// Returns: { headline: string | null, body: string }
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { medium, oneLineBeat } = body as { medium?: string; oneLineBeat?: string };

    if (!medium || !VALID_MEDIA.includes(medium as RavenMedium)) {
      return NextResponse.json({ error: 'invalid medium' }, { status: 400 });
    }
    if (!oneLineBeat || typeof oneLineBeat !== 'string' || oneLineBeat.trim().length < 3) {
      return NextResponse.json({ error: 'oneLineBeat required (min 3 chars)' }, { status: 400 });
    }

    const result = await draftBeat({ medium: medium as RavenMedium, oneLineBeat });
    if (!result) {
      return NextResponse.json({ error: 'AI draft unavailable' }, { status: 503 });
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error('POST /api/raven-post/draft', err);
    return NextResponse.json({ error: 'draft failed' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create `app/api/raven-post/headlines/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import type { RavenHeadlinesPayload } from '@/lib/types';

// GET /api/raven-post/headlines?playerId=X
// Returns the top 3 broadsheet headlines + the player's last_read_at
// + the newsie mp3 url. Used by NewsieCallout to decide whether to play.
export async function GET(req: Request) {
  try {
    await ensureSchema();
    const url = new URL(req.url);
    const playerId = url.searchParams.get('playerId');
    if (!playerId) {
      return NextResponse.json({ error: 'playerId required' }, { status: 400 });
    }

    const headlines = await query<{
      id: string;
      headline: string;
      published_at: string;
      newsie_mp3: string | null;
    }>(
      `SELECT id, headline, published_at, newsie_mp3
       FROM raven_items
       WHERE medium = 'broadsheet' AND headline IS NOT NULL
       ORDER BY published_at DESC
       LIMIT 3`,
    );

    const lastRead = await query<{ read_at: string }>(
      `SELECT MAX(r.read_at)::text AS read_at
       FROM raven_reads r
       JOIN raven_items i ON i.id = r.item_id
       WHERE r.player_id = $1 AND i.medium = 'broadsheet'`,
      [playerId],
    );

    const payload: RavenHeadlinesPayload = {
      headlines: headlines.map(h => ({
        id: h.id,
        headline: h.headline,
        published_at: h.published_at,
      })),
      newsie_mp3_url: headlines[0]?.newsie_mp3 ?? null,
      last_read_at: lastRead[0]?.read_at ?? null,
      newest_published_at: headlines[0]?.published_at ?? null,
    };

    return NextResponse.json(payload);
  } catch (err) {
    console.error('GET /api/raven-post/headlines', err);
    return NextResponse.json({ error: 'headlines query failed' }, { status: 500 });
  }
}
```

- [ ] **Step 3: Create `app/api/uploads/raven-post/newsie/[filename]/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';

const UPLOAD_DIR = `${process.env.DATA_DIR ?? '/data'}/uploads/raven-post/newsie`;

interface Props {
  params: Promise<{ filename: string }>;
}

// GET /api/uploads/raven-post/newsie/:filename — serve cached MP3
export async function GET(_req: Request, { params }: Props) {
  const { filename } = await params;

  // Path traversal guard
  if (filename.includes('/') || filename.includes('..') || !filename.endsWith('.mp3')) {
    return new NextResponse('Not found', { status: 404 });
  }

  try {
    const buffer = await readFile(join(UPLOAD_DIR, filename));
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'content-type': 'audio/mpeg',
        'cache-control': 'public, max-age=86400',
      },
    });
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }
}
```

- [ ] **Step 4: Smoke test the draft endpoint**

```bash
curl -s -X POST -H "content-type: application/json" \
  -d '{"medium":"broadsheet","oneLineBeat":"Stonecutters guild walks out"}' \
  http://localhost:3000/api/raven-post/draft
# Expected (with ANTHROPIC_API_KEY set): { "headline": "...", "body": "..." }
# Expected (without): { "error": "AI draft unavailable" }
```

Smoke test the headlines endpoint:

```bash
curl -s "http://localhost:3000/api/raven-post/headlines?playerId=ashton"
# Expected: { "headlines": [...], "newsie_mp3_url": null|"...", "last_read_at": null, "newest_published_at": "..." }
```

- [ ] **Step 5: Commit**

```bash
git add app/api/raven-post/draft app/api/raven-post/headlines app/api/uploads/raven-post
git commit -m "feat(raven-post): draft + headlines + newsie mp3 server routes"
```

---

## Task 9: API — overheard queue + trigger + weather + sms opt-in

**Files:**
- Create: `app/api/raven-post/overheard/queue/route.ts`
- Create: `app/api/raven-post/overheard/queue/[id]/route.ts`
- Create: `app/api/raven-post/overheard/trigger/route.ts`
- Create: `app/api/weather/current/route.ts`
- Create: `app/api/weather/route.ts`
- Create: `app/api/sms/optin/route.ts`

- [ ] **Step 1: Create `app/api/raven-post/overheard/queue/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import { LIBRARY_LOCATION } from '@/lib/raven-post';
import type { RavenOverheardQueueRow, RavenTrust } from '@/lib/types';

const VALID_TRUST: RavenTrust[] = ['official', 'whispered', 'rumored', 'prophesied'];

// GET /api/raven-post/overheard/queue
// Returns the FIFO queue + each row's delivery list
export async function GET() {
  try {
    await ensureSchema();
    const rows = await query<{
      id: string;
      location: string;
      body: string;
      trust: RavenTrust;
      position: number;
      created_at: string;
      delivered_to: string[] | null;
    }>(
      `SELECT q.id, q.location, q.body, q.trust, q.position, q.created_at,
              COALESCE(array_agg(d.player_id) FILTER (WHERE d.player_id IS NOT NULL), '{}') AS delivered_to
       FROM raven_overheard_queue q
       LEFT JOIN raven_overheard_deliveries d ON d.queue_id = q.id
       WHERE q.location = $1
       GROUP BY q.id
       ORDER BY q.position ASC, q.created_at ASC`,
      [LIBRARY_LOCATION],
    );

    const result: RavenOverheardQueueRow[] = rows.map(r => ({
      id: r.id,
      location: r.location,
      body: r.body,
      trust: r.trust,
      position: r.position,
      created_at: r.created_at,
      delivered_to: r.delivered_to ?? [],
    }));
    return NextResponse.json(result);
  } catch (err) {
    console.error('GET overheard queue', err);
    return NextResponse.json({ error: 'queue query failed' }, { status: 500 });
  }
}

// POST /api/raven-post/overheard/queue
// Body: { body: string, trust?: RavenTrust }
// Appends to the end of the library queue.
export async function POST(req: Request) {
  try {
    await ensureSchema();
    const body = await req.json();
    const { body: text, trust } = body as { body?: string; trust?: string };
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json({ error: 'body is required' }, { status: 400 });
    }
    if (text.length > 280) {
      return NextResponse.json({ error: 'body must be under 280 chars (SMS-safe)' }, { status: 400 });
    }
    if (trust !== undefined && !VALID_TRUST.includes(trust as RavenTrust)) {
      return NextResponse.json({ error: 'invalid trust' }, { status: 400 });
    }

    const maxPos = await query<{ max: number | null }>(
      `SELECT MAX(position) AS max FROM raven_overheard_queue WHERE location = $1`,
      [LIBRARY_LOCATION],
    );
    const nextPos = (maxPos[0]?.max ?? 0) + 1;

    const rows = await query(
      `INSERT INTO raven_overheard_queue (id, location, body, trust, position)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [randomUUID(), LIBRARY_LOCATION, text.trim(), trust ?? 'rumored', nextPos],
    );
    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) {
    console.error('POST overheard queue', err);
    return NextResponse.json({ error: 'queue insert failed' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create `app/api/raven-post/overheard/queue/[id]/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';

interface Props {
  params: Promise<{ id: string }>;
}

// PATCH /api/raven-post/overheard/queue/:id
// Body: { body?: string, position?: number, trust?: string }
export async function PATCH(req: Request, { params }: Props) {
  try {
    await ensureSchema();
    const { id } = await params;
    const body = await req.json();
    const sets: string[] = [];
    const vals: unknown[] = [];

    if (typeof body.body === 'string') {
      sets.push(`body = $${vals.length + 1}`);
      vals.push(body.body.trim().slice(0, 280));
    }
    if (typeof body.position === 'number') {
      sets.push(`position = $${vals.length + 1}`);
      vals.push(Math.max(0, Math.floor(body.position)));
    }
    if (typeof body.trust === 'string') {
      sets.push(`trust = $${vals.length + 1}`);
      vals.push(body.trust);
    }
    if (sets.length === 0) return NextResponse.json({ error: 'nothing to update' }, { status: 400 });

    vals.push(id);
    const rows = await query(
      `UPDATE raven_overheard_queue SET ${sets.join(', ')} WHERE id = $${vals.length} RETURNING *`,
      vals,
    );
    if (rows.length === 0) return NextResponse.json({ error: 'not found' }, { status: 404 });
    return NextResponse.json(rows[0]);
  } catch (err) {
    console.error('PATCH overheard queue', err);
    return NextResponse.json({ error: 'update failed' }, { status: 500 });
  }
}

// DELETE /api/raven-post/overheard/queue/:id
export async function DELETE(_req: Request, { params }: Props) {
  try {
    await ensureSchema();
    const { id } = await params;
    await query(`DELETE FROM raven_overheard_queue WHERE id = $1`, [id]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE overheard queue', err);
    return NextResponse.json({ error: 'delete failed' }, { status: 500 });
  }
}
```

- [ ] **Step 3: Create `app/api/raven-post/overheard/trigger/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { triggerOverheard } from '@/lib/raven-post';

// POST /api/raven-post/overheard/trigger
// Body: { playerId: string }
// Returns: { result: 'sent'|'cooldown'|'empty'|'no-optin'|'no-twilio' }
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const playerId = typeof body.playerId === 'string' ? body.playerId : null;
    if (!playerId) {
      return NextResponse.json({ error: 'playerId required' }, { status: 400 });
    }
    const result = await triggerOverheard(playerId);
    return NextResponse.json({ result });
  } catch (err) {
    console.error('POST overheard trigger', err);
    return NextResponse.json({ error: 'trigger failed' }, { status: 500 });
  }
}
```

- [ ] **Step 4: Create `app/api/weather/current/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import type { RavenWeatherRow } from '@/lib/types';

// GET /api/weather/current?playerId=X
// v1: returns the 'default' hex weather. Future versions resolve playerId
// to a current world hex and look up the per-hex row.
export async function GET(_req: Request) {
  try {
    await ensureSchema();
    const rows = await query<RavenWeatherRow>(
      `SELECT * FROM raven_weather WHERE hex_id = 'default'`,
    );
    if (rows.length === 0) {
      return NextResponse.json({
        hex_id: 'default',
        condition: 'clear',
        temp_c: null,
        wind_label: null,
        updated_at: new Date().toISOString(),
      } as RavenWeatherRow);
    }
    return NextResponse.json(rows[0]);
  } catch (err) {
    console.error('GET /api/weather/current', err);
    return NextResponse.json({ error: 'weather query failed' }, { status: 500 });
  }
}
```

- [ ] **Step 5: Create `app/api/weather/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import type { WeatherCondition } from '@/lib/types';

const VALID_CONDITIONS: WeatherCondition[] =
  ['clear', 'rain', 'snow', 'fog', 'storm', 'mist', 'dust', 'embers'];

// POST /api/weather — DM override (sets the 'default' row in v1)
// Body: { condition: WeatherCondition, temp_c?: number, wind_label?: string, hex_id?: string }
export async function POST(req: Request) {
  try {
    await ensureSchema();
    const body = await req.json();
    const { condition, temp_c, wind_label, hex_id } = body as Record<string, unknown>;

    if (typeof condition !== 'string' || !VALID_CONDITIONS.includes(condition as WeatherCondition)) {
      return NextResponse.json({ error: 'invalid condition' }, { status: 400 });
    }
    const id = typeof hex_id === 'string' && hex_id.length > 0 ? hex_id : 'default';
    const temp = typeof temp_c === 'number' ? Math.round(temp_c) : null;
    const wind = typeof wind_label === 'string' ? wind_label.slice(0, 40) : null;

    await query(
      `INSERT INTO raven_weather (hex_id, condition, temp_c, wind_label)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (hex_id) DO UPDATE SET
         condition = EXCLUDED.condition,
         temp_c = EXCLUDED.temp_c,
         wind_label = EXCLUDED.wind_label,
         updated_at = now()`,
      [id, condition, temp, wind],
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('POST /api/weather', err);
    return NextResponse.json({ error: 'weather update failed' }, { status: 500 });
  }
}
```

- [ ] **Step 6: Create `app/api/sms/optin/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';

// POST /api/sms/optin
// Body: { playerId: string, phone?: string, optin: boolean }
export async function POST(req: Request) {
  try {
    await ensureSchema();
    const body = await req.json();
    const { playerId, phone, optin } = body as { playerId?: string; phone?: string; optin?: boolean };

    if (!playerId || typeof playerId !== 'string') {
      return NextResponse.json({ error: 'playerId required' }, { status: 400 });
    }
    if (typeof optin !== 'boolean') {
      return NextResponse.json({ error: 'optin must be a boolean' }, { status: 400 });
    }
    if (phone !== undefined && typeof phone !== 'string') {
      return NextResponse.json({ error: 'phone must be a string' }, { status: 400 });
    }
    if (phone && !/^\+\d{8,15}$/.test(phone)) {
      return NextResponse.json({ error: 'phone must be E.164 format (+15551234567)' }, { status: 400 });
    }

    if (phone !== undefined) {
      await query(
        `UPDATE player_sheets SET sms_phone = $1, sms_optin = $2 WHERE id = $3`,
        [phone || null, optin, playerId],
      );
    } else {
      await query(
        `UPDATE player_sheets SET sms_optin = $1 WHERE id = $2`,
        [optin, playerId],
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('POST /api/sms/optin', err);
    return NextResponse.json({ error: 'optin failed' }, { status: 500 });
  }
}
```

- [ ] **Step 7: Smoke test the queue + weather endpoints**

```bash
# Add an overheard
curl -s -X POST -H "content-type: application/json" \
  -d '{"body":"The mill grinds at night. Something below."}' \
  http://localhost:3000/api/raven-post/overheard/queue

# List the queue
curl -s http://localhost:3000/api/raven-post/overheard/queue

# Set weather to storm
curl -s -X POST -H "content-type: application/json" \
  -d '{"condition":"storm","temp_c":12,"wind_label":"NE wind"}' \
  http://localhost:3000/api/weather

# Read it back
curl -s http://localhost:3000/api/weather/current
# Expected: { "hex_id": "default", "condition": "storm", "temp_c": 12, ... }
```

- [ ] **Step 8: Commit**

```bash
git add app/api/raven-post/overheard app/api/weather app/api/sms
git commit -m "feat(raven-post): overheard queue/trigger + weather + sms opt-in routes"
```

---

## Task 10: `RavenBroadsheet` component (visual)

**Files:**
- Create: `components/RavenBroadsheet.tsx`
- Create: `components/RavenWeatherPill.tsx`
- Create: `components/RavenAdModal.tsx`

These are presentational. The page passes them already-fetched data; they don't fetch anything themselves.

- [ ] **Step 1: Create `components/RavenWeatherPill.tsx`**

```tsx
import type { WeatherCondition } from '@/lib/types';

const ICONS: Record<WeatherCondition, string> = {
  clear:  '☀',
  rain:   '🌧',
  snow:   '❄',
  fog:    '🌫',
  storm:  '⛈',
  mist:   '🌁',
  dust:   '🟫',
  embers: '🔥',
};

const LABELS: Record<WeatherCondition, string> = {
  clear:  'Clear',
  rain:   'Rain',
  snow:   'Snow',
  fog:    'Fog',
  storm:  'Storm',
  mist:   'Mist',
  dust:   'Dust',
  embers: 'Embers',
};

interface Props {
  condition: WeatherCondition;
  temp_c: number | null;
  wind_label: string | null;
}

export default function RavenWeatherPill({ condition, temp_c, wind_label }: Props) {
  const parts: string[] = [`${ICONS[condition]} ${LABELS[condition]}`];
  if (temp_c !== null) parts.push(`${temp_c}°C`);
  if (wind_label) parts.push(wind_label);
  return (
    <span
      style={{
        display: 'inline-block',
        background: 'rgba(20,30,50,0.85)',
        border: '1px solid rgba(160,200,255,0.4)',
        color: '#cce0ff',
        fontSize: '0.7rem',
        padding: '5px 10px',
        textTransform: 'uppercase',
        letterSpacing: '0.15em',
      }}
    >
      {parts.join(' · ')}
    </span>
  );
}
```

- [ ] **Step 2: Create `components/RavenAdModal.tsx`**

```tsx
'use client';

import type { RavenItem } from '@/lib/types';

interface Props {
  item: RavenItem;
  onClose: () => void;
}

// Modal that reveals the real-world details of an in-fiction ad on click.
// The ad's printed body stays in-fiction; only here do real-world price /
// link / vendor info show.
export default function RavenAdModal({ item, onClose }: Props) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="bg-[var(--color-surface)] border border-[var(--color-border)] p-6 max-w-[420px] w-full"
        style={{ borderRadius: 0 }}
      >
        <div className="flex justify-between items-start mb-3">
          <h3 className="font-serif text-[var(--color-gold)] text-base">In the workshop</h3>
          <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-gold)] text-xl leading-none">×</button>
        </div>
        {item.ad_image_url && (
          // Use plain <img> not next/image — uploaded paths can carry query strings
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.ad_image_url}
            alt=""
            style={{ width: '100%', height: 'auto', marginBottom: 12 }}
          />
        )}
        {item.ad_real_copy && (
          <p className="font-serif text-[var(--color-text)] text-sm mb-3">{item.ad_real_copy}</p>
        )}
        {item.ad_real_link && (
          <a
            href={item.ad_real_link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-4 py-2 border border-[var(--color-gold)] text-[var(--color-gold)] hover:bg-[rgba(201,168,76,0.1)] font-serif text-sm uppercase tracking-widest"
          >
            View →
          </a>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create `components/RavenBroadsheet.tsx`**

```tsx
'use client';

import { useState } from 'react';
import type { RavenItem, RavenWeatherRow } from '@/lib/types';
import RavenWeatherPill from './RavenWeatherPill';
import RavenAdModal from './RavenAdModal';

interface Props {
  items: RavenItem[];
  weather: RavenWeatherRow;
  volume: number;
  issue: number;
  inFictionDate: string; // e.g. "14th of Mirtul, 1496 DR"
}

export default function RavenBroadsheet({ items, weather, volume, issue, inFictionDate }: Props) {
  const [adModal, setAdModal] = useState<RavenItem | null>(null);

  const broadsheetItems = items.filter(i => i.medium === 'broadsheet');
  const ravens = items.filter(i => i.medium === 'raven');
  const sendings = items.filter(i => i.medium === 'sending');
  const ads = items.filter(i => i.medium === 'ad');

  return (
    <div
      className="font-serif"
      style={{
        background: '#efe3c4',
        backgroundImage:
          'radial-gradient(circle at 20% 10%, rgba(139,90,30,0.08), transparent 50%),' +
          'radial-gradient(circle at 80% 90%, rgba(139,90,30,0.10), transparent 55%)',
        border: '1px solid #d9c89a',
        padding: '28px 30px',
        color: '#2b1f14',
        boxShadow: '0 8px 24px rgba(43,31,20,0.35), inset 0 0 80px rgba(139,90,30,0.08)',
        position: 'relative',
      }}
    >
      {/* Volume / Issue stamp */}
      <div
        style={{
          position: 'absolute',
          top: 40,
          right: 30,
          fontSize: '0.58rem',
          textTransform: 'uppercase',
          letterSpacing: '0.2em',
          color: '#7b1a1a',
          border: '1.5px solid #7b1a1a',
          padding: '4px 8px',
          transform: 'rotate(-6deg)',
          fontWeight: 700,
          opacity: 0.75,
        }}
      >
        Volume {volume}<br />Issue {issue}
      </div>

      {/* Masthead */}
      <div style={{ textAlign: 'center', borderBottom: '2px double #2b1f14', paddingBottom: 10, marginBottom: 14 }}>
        <h1 style={{
          fontFamily: 'UnifrakturMaguntia, "EB Garamond", serif',
          fontSize: '2.4rem',
          letterSpacing: '0.04em',
          margin: 0,
        }}>
          The Raven Post
        </h1>
        <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.3em', color: '#4a3723', marginTop: 2 }}>
          Published fortnightly at the sign of the black feather
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontStyle: 'italic', marginTop: 6, color: '#4a3723' }}>
          <span>{inFictionDate}</span>
          <RavenWeatherPill condition={weather.condition} temp_c={weather.temp_c} wind_label={weather.wind_label} />
          <span>One copper · three if bloodied</span>
        </div>
      </div>

      {/* Broadsheet headlines — 3 columns desktop, 1 column mobile */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '18px',
        }}
      >
        {broadsheetItems.length === 0 && (
          <p style={{ fontStyle: 'italic', color: '#4a3723' }}>
            The press is silent today. The Editor is doubtless drinking.
          </p>
        )}
        {broadsheetItems.slice(0, 6).map((item, idx) => (
          <article key={item.id}>
            <h3
              style={{
                fontFamily: 'EB Garamond, serif',
                fontWeight: 700,
                fontSize: idx === 0 ? '1.6rem' : '1.15rem',
                lineHeight: 1.15,
                margin: '0 0 4px',
                borderBottom: '1px solid #2b1f14',
                paddingBottom: 3,
              }}
            >
              {item.headline}
            </h3>
            <p style={{
              fontSize: '0.85rem',
              lineHeight: 1.4,
              margin: '0 0 8px',
              textAlign: 'justify',
            }}>
              {item.body}
            </p>
          </article>
        ))}
      </div>

      {/* Ravens — sealed letter cards */}
      {ravens.length > 0 && (
        <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid #2b1f14' }}>
          {ravens.slice(0, 3).map(r => (
            <div key={r.id} style={{
              background: '#1a1210',
              border: '1px solid #3d2a1a',
              padding: '20px 22px',
              color: '#e8dbc0',
              marginBottom: 12,
              position: 'relative',
            }}>
              <div style={{
                position: 'absolute', top: -14, right: 22, width: 38, height: 38,
                borderRadius: '50%',
                background: 'radial-gradient(circle at 35% 30%, #b02020, #5a0a0a 70%, #2a0404)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1rem', color: '#1a0404', fontWeight: 900,
              }}>♛</div>
              <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.18em', color: '#c9a84c', marginBottom: 8 }}>
                — A raven arrives —
              </div>
              {r.sender && (
                <div style={{ fontSize: '0.8rem', fontStyle: 'italic', color: '#8b7a5a', marginBottom: 10 }}>
                  From: {r.sender}
                </div>
              )}
              <div style={{ fontSize: '1rem', lineHeight: 1.5, fontStyle: 'italic' }}>{r.body}</div>
            </div>
          ))}
        </div>
      )}

      {/* Sendings — own card */}
      {sendings.length > 0 && (
        <div style={{ marginTop: 16 }}>
          {sendings.slice(0, 1).map(s => (
            <div key={s.id} style={{
              background: 'radial-gradient(ellipse at center, #1a2a3a 0%, #0a1420 70%)',
              border: '1px solid #2a4a6a',
              padding: 24,
              color: '#a8c8e8',
              textAlign: 'center',
              boxShadow: '0 0 30px rgba(80,140,220,0.15) inset',
            }}>
              <div style={{ fontSize: '1.8rem', filter: 'drop-shadow(0 0 6px #6ab0ff)' }}>✦</div>
              <div style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.25em', color: '#6ab0ff', margin: '8px 0' }}>
                — A sending reaches you —
              </div>
              <div style={{
                fontFamily: 'Cinzel, serif',
                fontSize: '1rem',
                lineHeight: 1.45,
                color: '#d8e8ff',
                textShadow: '0 0 8px rgba(106,176,255,0.4)',
                padding: '8px 4px',
              }}>
                {s.body}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#6a8aaa', marginTop: 10, fontStyle: 'italic' }}>
                no sender · no reply
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Classifieds + ads */}
      {ads.length > 0 && (
        <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #2b1f14', fontSize: '0.72rem', color: '#4a3723' }}>
          <span style={{ textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 700, color: '#2b1f14', display: 'block', marginBottom: 6 }}>
            Classifieds
          </span>
          {ads.map(ad => (
            <div
              key={ad.id}
              onClick={() => (ad.ad_real_link || ad.ad_real_copy) && setAdModal(ad)}
              style={{
                marginBottom: 6,
                cursor: (ad.ad_real_link || ad.ad_real_copy) ? 'pointer' : 'default',
                fontSize: '0.78rem',
              }}
            >
              {ad.body}
            </div>
          ))}
        </div>
      )}

      {adModal && <RavenAdModal item={adModal} onClose={() => setAdModal(null)} />}
    </div>
  );
}
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep -v ".next/types"
```

- [ ] **Step 5: Commit**

```bash
git add components/RavenBroadsheet.tsx components/RavenWeatherPill.tsx components/RavenAdModal.tsx
git commit -m "feat(raven-post): RavenBroadsheet visual + WeatherPill + AdModal"
```

---

## Task 11: `/raven-post` page

**Files:**
- Create: `app/raven-post/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
export const dynamic = 'force-dynamic';

import Link from 'next/link';
import Image from 'next/image';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import RavenBroadsheet from '@/components/RavenBroadsheet';
import type { RavenItem, RavenWeatherRow, Campaign } from '@/lib/types';

interface SearchParams {
  searchParams: Promise<{ playerId?: string }>;
}

export default async function RavenPostPage({ searchParams }: SearchParams) {
  await ensureSchema();
  const { playerId } = await searchParams;

  const [items, weatherRows, campaignRows] = await Promise.all([
    playerId
      ? query<RavenItem>(
          `SELECT * FROM raven_items
           WHERE medium IN ('broadsheet', 'ad', 'overheard')
              OR (medium IN ('raven', 'sending') AND target_player = $1)
           ORDER BY published_at DESC
           LIMIT 200`,
          [playerId],
        )
      : query<RavenItem>(
          `SELECT * FROM raven_items
           WHERE medium IN ('broadsheet', 'ad', 'overheard')
           ORDER BY published_at DESC
           LIMIT 200`,
        ),
    query<RavenWeatherRow>(`SELECT * FROM raven_weather WHERE hex_id = 'default'`),
    query<Campaign & { raven_volume: number; raven_issue: number }>(
      `SELECT * FROM campaign WHERE id = 'default'`,
    ),
  ]);

  const weather: RavenWeatherRow = weatherRows[0] ?? {
    hex_id: 'default',
    condition: 'clear',
    temp_c: null,
    wind_label: null,
    updated_at: new Date().toISOString(),
  };

  const volume = campaignRows[0]?.raven_volume ?? 1;
  const issue = campaignRows[0]?.raven_issue ?? 1;

  // v1 placeholder for an in-fiction date — eventually this comes from the
  // game-clock formatter once that's wired in.
  const inFictionDate = '14th of Mirtul, 1496 DR';

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)] font-serif">
      {/* Slim nav bar matching other player surfaces */}
      <div
        className="sticky top-0 bg-[var(--color-surface)] border-b border-[var(--color-border)] px-8 py-3 flex items-center gap-3 z-10 text-sm"
      >
        <Link href="/" title="Shadow of the Wolf" className="flex-shrink-0">
          <div className="relative rounded-full overflow-hidden" style={{ width: 30, height: 30 }}>
            <Image src="/images/invite/dice_home.png" alt="Home" fill className="object-cover" />
          </div>
        </Link>
        <span className="text-[var(--color-border)]">|</span>
        <span className="text-[var(--color-gold)]">The Raven Post</span>
      </div>

      <div className="max-w-[860px] mx-auto px-4 py-8">
        <RavenBroadsheet
          items={items}
          weather={weather}
          volume={volume}
          issue={issue}
          inFictionDate={inFictionDate}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Eyeball verify**

Open `http://localhost:3000/raven-post` — should see the broadsheet styled with the parchment background, masthead, weather pill, and any items you published in earlier tasks.

If empty: publish a few via curl from Task 7 and refresh.

- [ ] **Step 3: Type-check + build**

```bash
npx tsc --noEmit 2>&1 | grep -v ".next/types"
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add app/raven-post
git commit -m "feat(raven-post): /raven-post player page"
```

---

## Task 12: `PlayerBannerWeather` overlay + integrate into `PlayerBanner`

**Files:**
- Create: `components/PlayerBannerWeather.tsx`
- Modify: `components/PlayerBanner.tsx`

- [ ] **Step 1: Create `components/PlayerBannerWeather.tsx`**

```tsx
'use client';

import { useState, useEffect } from 'react';
import type { RavenWeatherRow, WeatherCondition } from '@/lib/types';
import RavenWeatherPill from './RavenWeatherPill';

// CSS-only animated weather overlays. The keyframes live inline so this
// component is self-contained.

const RAIN_KEYFRAMES = `
@keyframes raven-rain {
  0%   { transform: translateY(-80px); }
  100% { transform: translateY(220px); }
}
@keyframes raven-snow {
  0%   { transform: translateY(-50px) translateX(0); }
  100% { transform: translateY(220px) translateX(20px); }
}
@keyframes raven-flicker {
  0%, 95%, 100% { opacity: 0; }
  96%, 98% { opacity: 0.6; }
}`;

interface Props {
  playerId: string;
}

export default function PlayerBannerWeather({ playerId }: Props) {
  const [weather, setWeather] = useState<RavenWeatherRow | null>(null);

  useEffect(() => {
    fetch(`/api/weather/current?playerId=${encodeURIComponent(playerId)}`)
      .then(r => r.ok ? r.json() : null)
      .then(setWeather)
      .catch(() => {});
  }, [playerId]);

  if (!weather || weather.condition === 'clear') return null;

  return (
    <>
      <style>{RAIN_KEYFRAMES}</style>
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          ...weatherLayerStyle(weather.condition),
        }}
      />
      {weather.condition === 'storm' && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            background: '#fff',
            pointerEvents: 'none',
            animation: 'raven-flicker 7s linear infinite',
            mixBlendMode: 'overlay',
          }}
        />
      )}
      <div style={{ position: 'absolute', top: 14, right: 16 }}>
        <RavenWeatherPill condition={weather.condition} temp_c={weather.temp_c} wind_label={weather.wind_label} />
      </div>
    </>
  );
}

function weatherLayerStyle(condition: WeatherCondition): React.CSSProperties {
  switch (condition) {
    case 'rain':
    case 'storm':
      return {
        backgroundImage:
          'radial-gradient(2px 16px at 10% -10%, rgba(160,200,255,0.4), transparent),' +
          'radial-gradient(2px 14px at 25% -10%, rgba(160,200,255,0.5), transparent),' +
          'radial-gradient(2px 16px at 45% -10%, rgba(160,200,255,0.4), transparent),' +
          'radial-gradient(2px 12px at 60% -10%, rgba(160,200,255,0.5), transparent),' +
          'radial-gradient(2px 16px at 78% -10%, rgba(160,200,255,0.4), transparent),' +
          'radial-gradient(2px 14px at 92% -10%, rgba(160,200,255,0.5), transparent)',
        backgroundSize: '100% 80px',
        animation: 'raven-rain 0.6s linear infinite',
      };
    case 'snow':
      return {
        backgroundImage:
          'radial-gradient(3px 3px at 12% 10%, rgba(255,255,255,0.85), transparent),' +
          'radial-gradient(2px 2px at 28% 30%, rgba(255,255,255,0.85), transparent),' +
          'radial-gradient(3px 3px at 50% 50%, rgba(255,255,255,0.85), transparent),' +
          'radial-gradient(2px 2px at 70% 20%, rgba(255,255,255,0.85), transparent),' +
          'radial-gradient(3px 3px at 88% 70%, rgba(255,255,255,0.85), transparent)',
        backgroundSize: '100% 100%',
        animation: 'raven-snow 4s linear infinite',
      };
    case 'fog':
    case 'mist':
      return {
        background: 'linear-gradient(180deg, rgba(255,255,255,0.25), rgba(255,255,255,0.05) 70%)',
      };
    case 'dust':
      return {
        background: 'linear-gradient(180deg, rgba(180,140,80,0.25), rgba(180,140,80,0.05) 70%)',
      };
    case 'embers':
      return {
        background: 'linear-gradient(180deg, rgba(220,80,30,0.18), rgba(220,80,30,0.02) 70%)',
      };
    default:
      return {};
  }
}
```

- [ ] **Step 2: Modify `components/PlayerBanner.tsx` to render the overlay**

In the existing `PlayerBanner` component, find the JSX return that renders the `<Image>` (currently around lines 56–66). Add `<PlayerBannerWeather>` as a sibling absolutely positioned over the image. Update the imports and the empty-state to also include the weather overlay so weather still shows even if no banner image loads.

Add the import at the top:

```tsx
import PlayerBannerWeather from './PlayerBannerWeather';
```

Replace the existing return block with:

```tsx
  if (banners.length === 0) {
    return (
      <div className="relative w-full h-48 sm:h-72 overflow-hidden flex-shrink-0">
        <PlayerBannerWeather playerId={playerId} />
      </div>
    );
  }

  return (
    <div className="relative w-full h-48 sm:h-72 overflow-hidden flex-shrink-0">
      <Image
        src={banners[index]}
        alt=""
        fill
        className={`object-cover object-center transition-opacity duration-500 ${visible ? 'opacity-100' : 'opacity-0'}`}
        priority
      />
      <PlayerBannerWeather playerId={playerId} />
    </div>
  );
```

- [ ] **Step 3: Set the weather to something visible and verify**

```bash
curl -s -X POST -H "content-type: application/json" \
  -d '{"condition":"rain","temp_c":12,"wind_label":"NE wind"}' \
  http://localhost:3000/api/weather
```

Open `http://localhost:3000/players/ashton` (or any valid player). Verify:
- Animated rain streaks visible across the banner
- The weather pill in the top-right corner shows "🌧 Rain · 12°C · NE wind"
- Setting condition back to `clear` makes both disappear

- [ ] **Step 4: Commit**

```bash
git add components/PlayerBannerWeather.tsx components/PlayerBanner.tsx
git commit -m "feat(raven-post): PlayerBanner weather overlay"
```

---

## Task 13: `NewsieCallout` component

**Files:**
- Create: `components/NewsieCallout.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client';

import { useEffect, useRef } from 'react';
import type { RavenHeadlinesPayload } from '@/lib/types';

interface Props {
  playerId: string;
}

// Newsie callout: 10–20s after mount, plays an ElevenLabs-rendered audio clip
// of a barker shouting the top 3 headlines, then dispatches a custom event
// the nav listens for to start its red-pulse animation.
//
// Silent if:
//   - the player has already read the newest headline (lastReadAt >= newest)
//   - no headlines exist
//   - no MP3 has been rendered for the latest issue
//   - the audio fails to play (autoplay restrictions)
export default function NewsieCallout({ playerId }: Props) {
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    (async () => {
      try {
        const res = await fetch(`/api/raven-post/headlines?playerId=${encodeURIComponent(playerId)}`);
        if (!res.ok) return;
        const data: RavenHeadlinesPayload = await res.json();

        // Silence if there's nothing new or no audio available
        if (!data.newsie_mp3_url || !data.newest_published_at) return;
        if (data.last_read_at && data.last_read_at >= data.newest_published_at) return;

        // Schedule playback at a random offset 10–20s
        const delay = 10_000 + Math.floor(Math.random() * 10_000);
        timer = setTimeout(() => {
          if (cancelled) return;
          const audio = new Audio(data.newsie_mp3_url ?? undefined);
          audio.volume = 0.7;
          audio.play().catch(() => {
            // Autoplay blocked — silently no-op
          });
          // Dispatch the event regardless so the nav still pulses even if
          // the browser blocked the actual audio
          window.dispatchEvent(new CustomEvent('raven-post:newsie-fired'));
          firedRef.current = true;
        }, delay);
      } catch (err) {
        console.error('NewsieCallout fetch error:', err);
      }
    })();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [playerId]);

  return null;
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep -v ".next/types"
```

- [ ] **Step 3: Commit**

```bash
git add components/NewsieCallout.tsx
git commit -m "feat(raven-post): NewsieCallout — audio + nav-pulse trigger"
```

---

## Task 14: `OverheardWatcher` component

**Files:**
- Create: `components/OverheardWatcher.tsx`

- [ ] **Step 1: Create the component**

```tsx
'use client';

import { useEffect, useRef } from 'react';
import { haversine } from '@/lib/geo';

interface Props {
  playerId: string;
  smsOptin: boolean;
}

const LIBRARY = { lat: 36.34289, lng: -88.85022, radius_m: 100 };

// Geolocation watch: when the player enters the library radius, fire the
// /api/raven-post/overheard/trigger endpoint. Server handles cooldown,
// queue popping, delivery recording, and SMS dispatch.
//
// Gates: only mounts a watch if smsOptin is true. Otherwise renders nothing
// (and consumes no battery).
export default function OverheardWatcher({ playerId, smsOptin }: Props) {
  const insideRef = useRef(false);
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!smsOptin) return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;

    watchIdRef.current = navigator.geolocation.watchPosition(
      ({ coords }) => {
        const dist = haversine(coords.latitude, coords.longitude, LIBRARY.lat, LIBRARY.lng);
        const inside = dist <= LIBRARY.radius_m;

        // Edge-trigger on entry. The 30-min cooldown lives server-side.
        if (inside && !insideRef.current) {
          insideRef.current = true;
          fetch('/api/raven-post/overheard/trigger', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ playerId }),
          }).catch(err => console.error('overheard trigger:', err));
        } else if (!inside && insideRef.current) {
          insideRef.current = false;
        }
      },
      err => {
        console.error('OverheardWatcher geolocation error:', err);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );

    return () => {
      if (watchIdRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [playerId, smsOptin]);

  return null;
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep -v ".next/types"
```

- [ ] **Step 3: Commit**

```bash
git add components/OverheardWatcher.tsx
git commit -m "feat(raven-post): OverheardWatcher — geolocation watch"
```

---

## Task 15: Wire `/players/[id]` — nav link, NewsieCallout, OverheardWatcher

**Files:**
- Modify: `app/players/[id]/page.tsx`
- Modify: `app/globals.css` (add the `.raven-link-pulse` keyframes)

The player sheet page is the integration point for all the player-side pieces.

- [ ] **Step 1: Add the pulse keyframes to `app/globals.css`**

Find a sensible place at the end of the file and append:

```css
/* ── Raven Post: nav link pulse triggered by NewsieCallout ─────────── */
@keyframes raven-link-pulse {
  0%, 100% {
    opacity: 1;
    text-shadow: 0 0 10px rgba(255,48,48,0.8), 0 0 20px rgba(255,48,48,0.5);
  }
  50% {
    opacity: 0.6;
    text-shadow: 0 0 14px rgba(255,48,48,1), 0 0 28px rgba(255,48,48,0.7);
  }
}

.raven-link-pulse {
  color: #ff3030 !important;
  font-weight: 700;
  animation: raven-link-pulse 1.4s ease-in-out infinite;
}

.raven-link-pulse-fade {
  transition: color 30s ease, text-shadow 30s ease, opacity 30s ease;
  color: var(--color-text);
  text-shadow: none;
  opacity: 1;
  animation: none;
}
```

- [ ] **Step 2: Modify `app/players/[id]/page.tsx`**

Read the current file (lines 1–85). Three changes:

**(a) Update the data fetch to include `sms_optin`** — find the existing player_sheets query (around line 28) and ensure the row spreads include `sms_optin`. The `Sheet`/`PlayerSheet` types already get `sms_phone` and `sms_optin` from Task 1's `ALTER TABLE`. We just need them in the page.

**(b) Add the "The Raven" link to the nav.** Find the existing nav block (lines 51–63). Insert between the Marketplace link and the "The story so far…" link:

```tsx
<span className="text-[var(--color-border)]">|</span>
<Link
  href={`/raven-post?playerId=${player.id}`}
  id="raven-post-nav-link"
  className="text-[var(--color-text)] hover:text-[var(--color-gold)] no-underline"
>
  The Raven
</Link>
```

**(c) Mount `<NewsieCallout>` and `<OverheardWatcher>`.** After `<PlayerBanner>` (around line 66), add:

```tsx
<NewsieCallout playerId={player.id} />
<OverheardWatcher playerId={player.id} smsOptin={data.sms_optin === true} />
```

Add the imports at the top of the file:

```tsx
import NewsieCallout from '@/components/NewsieCallout';
import OverheardWatcher from '@/components/OverheardWatcher';
```

Make sure the `data` object passed includes `sms_optin` — the `empty` fallback already at line 38 needs `sms_optin: false, sms_phone: ''` added to match the new `PlayerSheet` shape. Update `lib/types.ts` `PlayerSheet` interface to include the new fields:

```ts
sms_phone: string;
sms_optin: boolean;
```

And update the `empty` object in `app/players/[id]/page.tsx` similarly.

- [ ] **Step 3: Add the nav-pulse listener (one-shot script in the page)**

After the JSX nav block, add a small inline `<script>` that listens for the `raven-post:newsie-fired` event and toggles classes on the link. The simplest place is to add a tiny client component just for this:

Actually, do this cleanly. Create a thin `'use client'` helper component:

Create `components/RavenNavPulse.tsx`:

```tsx
'use client';

import { useEffect } from 'react';

// Listens for the 'raven-post:newsie-fired' event dispatched by NewsieCallout
// and runs the pulse animation on the #raven-post-nav-link element.
export default function RavenNavPulse() {
  useEffect(() => {
    function onFire() {
      const link = document.getElementById('raven-post-nav-link');
      if (!link) return;
      // Apply pulse class for 10s
      link.classList.add('raven-link-pulse');
      const offTimer = setTimeout(() => {
        link.classList.remove('raven-link-pulse');
        link.classList.add('raven-link-pulse-fade');
        // Remove the fade class after the 30s transition
        const cleanupTimer = setTimeout(() => {
          link.classList.remove('raven-link-pulse-fade');
        }, 30_000);
        // Save cleanup so unmount can clear it (best-effort)
        (link as HTMLElement & { _ravenCleanup?: number }).
          _ravenCleanup = cleanupTimer as unknown as number;
      }, 10_000);
      (link as HTMLElement & { _ravenOffTimer?: number }).
        _ravenOffTimer = offTimer as unknown as number;
    }
    window.addEventListener('raven-post:newsie-fired', onFire);
    return () => window.removeEventListener('raven-post:newsie-fired', onFire);
  }, []);

  return null;
}
```

Then in `app/players/[id]/page.tsx`, also import and mount it:

```tsx
import RavenNavPulse from '@/components/RavenNavPulse';
// ...
<RavenNavPulse />
<NewsieCallout playerId={player.id} />
```

- [ ] **Step 4: Type-check + build**

```bash
npx tsc --noEmit 2>&1 | grep -v ".next/types"
npm run build
```

- [ ] **Step 5: Manual eyeball verification**

1. Open `http://localhost:3000/players/ashton`.
2. **Verify:** "The Raven" link appears between Marketplace and "The story so far…" in the nav bar.
3. Wait 10–20 seconds. **If** there's a published broadsheet item with a rendered newsie MP3 AND you haven't read it yet:
   - You should hear the audio (or see "autoplay blocked" in the console).
   - The nav link should turn bright red and pulse for 10s, then fade over the next 30s back to normal.
4. **Test the silence path:** mark the headline as read via curl and refresh — no audio, no pulse should fire on subsequent visits:
   ```bash
   curl -s -X POST -H "content-type: application/json" \
     -d '{"playerId":"ashton"}' \
     http://localhost:3000/api/raven-post/items/<ITEM_ID>/read
   ```

- [ ] **Step 6: Commit**

```bash
git add app/players/[id]/page.tsx app/globals.css components/RavenNavPulse.tsx lib/types.ts
git commit -m "feat(raven-post): wire NewsieCallout + OverheardWatcher + Raven nav link into /players/[id]"
```

---

## Task 16: DM curation page — `/dm/raven-post` (page + DmNav entry + RavenManualCompose)

**Files:**
- Create: `app/dm/raven-post/page.tsx`
- Create: `components/dm/RavenManualCompose.tsx`
- Modify: `components/DmNav.tsx`

- [ ] **Step 1: Add the nav entry to `DmNav.tsx`**

In `components/DmNav.tsx`, find the `NavSection` type (around line 7) and add `'raven-post'`:

```tsx
export type NavSection =
  | 'campaign' | 'sessions' | 'players' | 'npcs' | 'initiative'
  | 'world' | 'maps' | 'map-builder'
  | 'magic' | 'marketplace' | 'poisons' | 'inventory'
  | 'boons' | 'journey' | 'journal' | 'ar' | 'raven-post';
```

Then in the `LINKS` array, add a new entry next to the other content links (a sensible place is between 'journal' and 'sessions'):

```tsx
{ key: 'raven-post', label: 'Raven Post',     href: '/dm/raven-post' },
```

- [ ] **Step 2: Create `components/dm/RavenManualCompose.tsx`**

```tsx
'use client';

import { useState } from 'react';
import type { RavenMedium, RavenTrust, Player } from '@/lib/types';

const MEDIA: { value: RavenMedium; label: string }[] = [
  { value: 'broadsheet', label: '📜 Broadsheet' },
  { value: 'raven',      label: '🕊 Raven' },
  { value: 'sending',    label: '✦ Sending' },
  { value: 'overheard',  label: '🍺 Overheard' },
  { value: 'ad',         label: '📋 Ad' },
];

interface Props {
  players: Player[];
  onPublished?: () => void;
}

export default function RavenManualCompose({ players, onPublished }: Props) {
  const [medium, setMedium] = useState<RavenMedium>('broadsheet');
  const [oneLineBeat, setOneLineBeat] = useState('');
  const [headline, setHeadline] = useState('');
  const [body, setBody] = useState('');
  const [sender, setSender] = useState('');
  const [targetPlayer, setTargetPlayer] = useState<string>('');
  const [trust, setTrust] = useState<RavenTrust>('official');
  const [adImage, setAdImage] = useState('');
  const [adRealLink, setAdRealLink] = useState('');
  const [adRealCopy, setAdRealCopy] = useState('');
  const [drafting, setDrafting] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function draftWithAI() {
    if (!oneLineBeat.trim()) return;
    setDrafting(true);
    setError(null);
    try {
      const res = await fetch('/api/raven-post/draft', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ medium, oneLineBeat }),
      });
      if (!res.ok) {
        setError(res.status === 503 ? 'AI unavailable (no API key or budget paused)' : 'draft failed');
        return;
      }
      const data: { headline: string | null; body: string } = await res.json();
      if (data.headline) setHeadline(data.headline);
      setBody(data.body);
    } catch (err) {
      console.error(err);
      setError('draft failed');
    } finally {
      setDrafting(false);
    }
  }

  async function publish() {
    setError(null);
    if (!body.trim()) {
      setError('body is required');
      return;
    }
    if (medium === 'broadsheet' && !headline.trim()) {
      setError('broadsheet items need a headline');
      return;
    }
    if ((medium === 'raven' || medium === 'sending') && !targetPlayer) {
      setError('select a target player for ravens and sendings');
      return;
    }

    setPublishing(true);
    try {
      const payload: Record<string, unknown> = {
        medium,
        body: body.trim(),
        trust,
      };
      if (medium === 'broadsheet') payload.headline = headline.trim();
      if (medium === 'raven') {
        payload.sender = sender.trim();
        payload.target_player = targetPlayer;
      }
      if (medium === 'sending') payload.target_player = targetPlayer;
      if (medium === 'ad') {
        if (adImage.trim()) payload.ad_image_url = adImage.trim();
        if (adRealLink.trim()) payload.ad_real_link = adRealLink.trim();
        if (adRealCopy.trim()) payload.ad_real_copy = adRealCopy.trim();
      }

      const res = await fetch('/api/raven-post/items', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.error ?? 'publish failed');
        return;
      }
      // Clear the form
      setOneLineBeat('');
      setHeadline('');
      setBody('');
      setSender('');
      setTargetPlayer('');
      setAdImage('');
      setAdRealLink('');
      setAdRealCopy('');
      onPublished?.();
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div
      className="border border-[var(--color-border)] bg-[var(--color-surface)] p-6"
      style={{ borderRadius: 0 }}
    >
      <h3 className="font-serif text-[var(--color-gold)] text-lg mb-4">Compose a beat by hand</h3>

      {/* Medium tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {MEDIA.map(m => (
          <button
            key={m.value}
            onClick={() => setMedium(m.value)}
            className="text-xs px-3 py-1.5 border font-serif uppercase tracking-widest"
            style={{
              borderColor: medium === m.value ? 'var(--color-gold)' : 'var(--color-border)',
              color: medium === m.value ? 'var(--color-gold)' : 'var(--color-text-muted)',
              background: medium === m.value ? 'rgba(201,168,76,0.08)' : 'transparent',
            }}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* One-line beat + AI draft */}
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={oneLineBeat}
          onChange={e => setOneLineBeat(e.target.value)}
          placeholder="One-line beat — e.g. 'Stonecutters guild walks out over the new tax'"
          className="flex-1 bg-[var(--color-bg-card)] border border-[var(--color-border)] px-3 py-2 text-[var(--color-text)] font-serif text-sm"
        />
        <button
          onClick={draftWithAI}
          disabled={drafting || !oneLineBeat.trim()}
          className="px-4 py-2 bg-[var(--color-gold)] text-[#1a1410] font-serif text-sm uppercase tracking-widest disabled:opacity-40"
        >
          {drafting ? 'Drafting…' : 'Draft with AI'}
        </button>
      </div>

      {/* Per-medium fields */}
      {medium === 'broadsheet' && (
        <input
          type="text"
          value={headline}
          onChange={e => setHeadline(e.target.value)}
          placeholder="Headline"
          className="w-full mb-3 bg-[var(--color-bg-card)] border border-[var(--color-border)] px-3 py-2 text-[var(--color-text)] font-serif"
        />
      )}

      {(medium === 'raven' || medium === 'sending') && (
        <div className="mb-3">
          <label className="block text-xs text-[var(--color-text-muted)] uppercase tracking-widest mb-2">Target player</label>
          <div className="flex gap-2 flex-wrap">
            {players.map(p => (
              <button
                key={p.id}
                onClick={() => setTargetPlayer(p.id)}
                className="px-3 py-1.5 border text-xs font-serif"
                style={{
                  borderColor: targetPlayer === p.id ? 'var(--color-gold)' : 'var(--color-border)',
                  color: targetPlayer === p.id ? 'var(--color-gold)' : 'var(--color-text-muted)',
                  background: targetPlayer === p.id ? 'rgba(201,168,76,0.08)' : 'transparent',
                }}
              >
                {p.playerName}
              </button>
            ))}
          </div>
        </div>
      )}

      {medium === 'raven' && (
        <input
          type="text"
          value={sender}
          onChange={e => setSender(e.target.value)}
          placeholder="Sender (e.g. 'Warden Cedric of the Hollow Oak')"
          className="w-full mb-3 bg-[var(--color-bg-card)] border border-[var(--color-border)] px-3 py-2 text-[var(--color-text)] font-serif text-sm"
        />
      )}

      <textarea
        rows={5}
        value={body}
        onChange={e => setBody(e.target.value)}
        placeholder={
          medium === 'sending'
            ? 'Sending body — exactly 25 words or fewer, cryptic'
            : 'Body — the in-fiction prose'
        }
        className="w-full bg-[var(--color-bg-card)] border border-[var(--color-border)] px-3 py-2 text-[var(--color-text)] font-serif text-sm leading-relaxed mb-3"
      />

      {medium === 'ad' && (
        <div className="space-y-2 mb-3">
          <input
            type="text"
            value={adImage}
            onChange={e => setAdImage(e.target.value)}
            placeholder="Real-world image URL (optional)"
            className="w-full bg-[var(--color-bg-card)] border border-[var(--color-border)] px-3 py-2 text-[var(--color-text)] font-serif text-xs"
          />
          <input
            type="text"
            value={adRealLink}
            onChange={e => setAdRealLink(e.target.value)}
            placeholder="Real-world product link (revealed on click)"
            className="w-full bg-[var(--color-bg-card)] border border-[var(--color-border)] px-3 py-2 text-[var(--color-text)] font-serif text-xs"
          />
          <input
            type="text"
            value={adRealCopy}
            onChange={e => setAdRealCopy(e.target.value)}
            placeholder="Real-world copy (revealed on click)"
            className="w-full bg-[var(--color-bg-card)] border border-[var(--color-border)] px-3 py-2 text-[var(--color-text)] font-serif text-xs"
          />
        </div>
      )}

      {/* Trust tier */}
      <div className="flex gap-2 mb-4">
        {(['official', 'whispered', 'rumored', 'prophesied'] as RavenTrust[]).map(t => (
          <button
            key={t}
            onClick={() => setTrust(t)}
            className="px-3 py-1 text-xs font-serif uppercase tracking-widest border"
            style={{
              borderColor: trust === t ? 'var(--color-gold)' : 'var(--color-border)',
              color: trust === t ? 'var(--color-gold)' : 'var(--color-text-muted)',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {error && <p className="text-sm mb-3" style={{ color: '#c07a8a' }}>{error}</p>}

      <button
        onClick={publish}
        disabled={publishing}
        className="px-6 py-2 bg-[var(--color-gold)] text-[#1a1410] font-serif uppercase tracking-widest disabled:opacity-40"
      >
        {publishing ? 'Publishing…' : 'Publish'}
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Create `app/dm/raven-post/page.tsx` (initial shell, just the manual compose pane)**

```tsx
export const dynamic = 'force-dynamic';

import DmNav from '@/components/DmNav';
import RavenManualCompose from '@/components/dm/RavenManualCompose';
import { getPlayers } from '@/lib/getPlayers';

export default async function DmRavenPostPage() {
  const players = await getPlayers();

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
      <DmNav current="raven-post" />

      <div className="max-w-[1000px] mx-auto px-8 py-10 space-y-8">
        <header>
          <h1 className="font-serif text-2xl text-[var(--color-gold)]">The Raven Post</h1>
          <p className="text-sm text-[var(--color-text-muted)] italic mt-1">
            Compose a beat. Queue an overheard. Edit a published item.
          </p>
        </header>

        <RavenManualCompose players={players.filter(p => p.id !== 'dm')} />

        {/* Library Overheard Queue and Published Items panes get appended in
            Tasks 17 and 18. */}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Build + verify**

```bash
npm run build
```

Open `http://localhost:3000/dm/raven-post`. Verify:
- DmNav shows the new "Raven Post" entry highlighted
- The Manual Compose pane renders with all 5 medium tabs
- Tabbing through Broadsheet/Raven/Sending/Overheard/Ad reveals the right per-medium fields
- "Draft with AI" button is greyed out until you type a beat
- "Publish" button is functional

Try publishing:
1. Tab to Broadsheet, type a beat ("Stonecutters walk out"), click "Draft with AI" — body and headline should fill in (if Anthropic API key is set)
2. Click Publish — form should clear; row should appear at `/raven-post`

- [ ] **Step 5: Commit**

```bash
git add app/dm/raven-post components/dm/RavenManualCompose.tsx components/DmNav.tsx
git commit -m "feat(raven-post): /dm/raven-post page + manual compose pane"
```

---

## Task 17: DM Library Overheard Queue pane

**Files:**
- Create: `components/dm/RavenOverheardQueue.tsx`
- Modify: `app/dm/raven-post/page.tsx`

- [ ] **Step 1: Create `components/dm/RavenOverheardQueue.tsx`**

```tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import type { RavenOverheardQueueRow } from '@/lib/types';

export default function RavenOverheardQueue() {
  const [rows, setRows] = useState<RavenOverheardQueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [newBody, setNewBody] = useState('');
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const fetchQueue = useCallback(async () => {
    try {
      const res = await fetch('/api/raven-post/overheard/queue');
      if (!res.ok) return;
      const data: RavenOverheardQueueRow[] = await res.json();
      setRows(data);
      const d: Record<string, string> = {};
      data.forEach(r => { d[r.id] = r.body; });
      setDrafts(d);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchQueue(); }, [fetchQueue]);

  async function addRow() {
    if (!newBody.trim()) return;
    const res = await fetch('/api/raven-post/overheard/queue', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ body: newBody.trim() }),
    });
    if (res.ok) {
      setNewBody('');
      fetchQueue();
    }
  }

  async function saveRow(id: string) {
    const draft = drafts[id];
    if (draft === undefined) return;
    await fetch(`/api/raven-post/overheard/queue/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ body: draft }),
    });
    fetchQueue();
  }

  async function deleteRow(id: string) {
    if (!confirm('Delete this overheard?')) return;
    await fetch(`/api/raven-post/overheard/queue/${id}`, { method: 'DELETE' });
    fetchQueue();
  }

  return (
    <div className="border border-[var(--color-border)] bg-[var(--color-surface)] p-6" style={{ borderRadius: 0 }}>
      <h3 className="font-serif text-[var(--color-gold)] text-lg mb-1">Library Overheard Queue</h3>
      <p className="text-xs text-[var(--color-text-muted)] italic mb-4">
        FIFO · no replays · 100m radius @ Citadel Tree
      </p>

      {loading && <p className="text-sm text-[var(--color-text-muted)]">loading…</p>}

      <div className="space-y-2 mb-4">
        {rows.map((r, idx) => (
          <div
            key={r.id}
            className="border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3"
            style={{ display: 'grid', gridTemplateColumns: '32px 1fr 100px 60px', gap: 12, alignItems: 'center' }}
          >
            <div
              className="rounded-full flex items-center justify-center text-xs font-bold"
              style={{ width: 24, height: 24, background: 'var(--color-gold)', color: '#1a1410' }}
            >
              {idx + 1}
            </div>
            <textarea
              rows={2}
              value={drafts[r.id] ?? r.body}
              onChange={e => setDrafts(prev => ({ ...prev, [r.id]: e.target.value }))}
              onBlur={() => saveRow(r.id)}
              className="bg-transparent border border-[var(--color-border)] px-2 py-1 text-[var(--color-text)] font-serif italic text-sm"
            />
            <span className="text-xs text-[var(--color-text-muted)] text-right">
              {r.delivered_to.length === 0 ? 'queued' : `delivered to ${r.delivered_to.length}`}
            </span>
            <button
              onClick={() => deleteRow(r.id)}
              className="text-[var(--color-text-muted)] hover:text-[#c07a8a] text-xs"
            >
              ×
            </button>
          </div>
        ))}
        {rows.length === 0 && !loading && (
          <p className="text-sm text-[var(--color-text-muted)] italic">queue is empty</p>
        )}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={newBody}
          onChange={e => setNewBody(e.target.value)}
          placeholder="Add a new overheard rumor (≤280 chars)"
          maxLength={280}
          className="flex-1 bg-[var(--color-bg-card)] border border-[var(--color-border)] px-3 py-2 text-[var(--color-text)] font-serif text-sm"
        />
        <button
          onClick={addRow}
          disabled={!newBody.trim()}
          className="px-4 py-2 border border-[var(--color-gold)] text-[var(--color-gold)] font-serif uppercase tracking-widest text-xs disabled:opacity-40"
        >
          Add
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire into `app/dm/raven-post/page.tsx`**

Add the import:

```tsx
import RavenOverheardQueue from '@/components/dm/RavenOverheardQueue';
```

Add the component below the manual compose pane:

```tsx
<RavenManualCompose players={players.filter(p => p.id !== 'dm')} />
<RavenOverheardQueue />
```

- [ ] **Step 3: Build + verify**

```bash
npm run build
```

Open `/dm/raven-post`. Add a couple of overheards via the new pane. Verify they appear in order. Edit one inline — should save on blur. Delete one — should disappear.

- [ ] **Step 4: Commit**

```bash
git add components/dm/RavenOverheardQueue.tsx app/dm/raven-post/page.tsx
git commit -m "feat(raven-post): DM Library Overheard Queue pane"
```

---

## Task 18: DM Published Items pane

**Files:**
- Create: `components/dm/RavenPublishedItems.tsx`
- Modify: `app/dm/raven-post/page.tsx`

- [ ] **Step 1: Create `components/dm/RavenPublishedItems.tsx`**

```tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import type { RavenItem } from '@/lib/types';

const MEDIUM_LABELS: Record<string, string> = {
  broadsheet: '📜 Broadsheet',
  raven:      '🕊 Raven',
  sending:    '✦ Sending',
  overheard:  '🍺 Overheard',
  ad:         '📋 Ad',
};

export default function RavenPublishedItems() {
  const [items, setItems] = useState<RavenItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch('/api/raven-post/items');
      if (!res.ok) return;
      const data: RavenItem[] = await res.json();
      setItems(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  async function deleteItem(id: string) {
    if (!confirm('Unpublish this item?')) return;
    await fetch(`/api/raven-post/items/${id}`, { method: 'DELETE' });
    fetchItems();
  }

  // Group by medium
  const grouped: Record<string, RavenItem[]> = {};
  for (const i of items) {
    (grouped[i.medium] ??= []).push(i);
  }

  return (
    <div className="border border-[var(--color-border)] bg-[var(--color-surface)] p-6" style={{ borderRadius: 0 }}>
      <h3 className="font-serif text-[var(--color-gold)] text-lg mb-4">Published Items</h3>

      {loading && <p className="text-sm text-[var(--color-text-muted)]">loading…</p>}
      {!loading && items.length === 0 && (
        <p className="text-sm text-[var(--color-text-muted)] italic">nothing published yet</p>
      )}

      {Object.entries(grouped).map(([medium, list]) => (
        <div key={medium} className="mb-6">
          <h4 className="text-xs uppercase tracking-widest text-[var(--color-gold)] mb-2">
            {MEDIUM_LABELS[medium] ?? medium}
          </h4>
          <div className="space-y-2">
            {list.map(item => (
              <div key={item.id} className="border border-[var(--color-border)] p-3 bg-[var(--color-bg-card)]">
                {item.headline && <div className="font-serif text-[var(--color-gold)] text-sm">{item.headline}</div>}
                {item.sender && <div className="text-xs italic text-[var(--color-text-muted)]">From: {item.sender}</div>}
                <p className="font-serif text-[var(--color-text)] text-sm mt-1">{item.body}</p>
                <div className="flex justify-between items-center mt-2 text-xs text-[var(--color-text-muted)]">
                  <span>
                    {item.tags.length > 0 && <span>tags: {item.tags.join(', ')} · </span>}
                    trust: {item.trust} · {new Date(item.published_at).toLocaleDateString()}
                  </span>
                  <button
                    onClick={() => deleteItem(item.id)}
                    className="hover:text-[#c07a8a]"
                  >
                    unpublish
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Wire into `app/dm/raven-post/page.tsx`**

Add the import:

```tsx
import RavenPublishedItems from '@/components/dm/RavenPublishedItems';
```

Add the component at the bottom:

```tsx
<RavenManualCompose players={players.filter(p => p.id !== 'dm')} />
<RavenOverheardQueue />
<RavenPublishedItems />
```

- [ ] **Step 3: Build + eyeball**

```bash
npm run build
```

Open `/dm/raven-post`. Verify the published items pane shows everything from Task 7's smoke test, grouped by medium. Try unpublishing one — it disappears.

- [ ] **Step 4: Commit**

```bash
git add components/dm/RavenPublishedItems.tsx app/dm/raven-post/page.tsx
git commit -m "feat(raven-post): DM Published Items pane"
```

---

## Task 19: SMS opt-in UI on the player sheet

**Files:**
- Modify: `components/PlayerSheet.tsx` (somewhere appropriate near the top of the sheet, or add a settings collapsible)

Players need a way to opt into SMS pushes. This is the simplest possible UI: a toggle + phone field tucked into the existing PlayerSheet. The location is up to the engineer's read of the file — pick a spot near the top under the header that doesn't disrupt the existing layout.

- [ ] **Step 1: Read `components/PlayerSheet.tsx` to find a good place**

```bash
wc -l components/PlayerSheet.tsx
grep -n "Discord\|sms\|optin" components/PlayerSheet.tsx | head
```

PlayerSheet is large. The Discord field is probably the closest existing analog — find where that lives and add the SMS opt-in nearby.

- [ ] **Step 2: Add the opt-in UI**

In the appropriate place inside the existing `Sheet` component, add (with minor inline styling matching nearby controls):

```tsx
<div className="flex items-center gap-3 mb-2">
  <label className="text-xs text-[var(--color-text-muted)] uppercase tracking-widest">SMS push</label>
  <input
    type="checkbox"
    checked={data.sms_optin === true}
    onChange={async e => {
      await fetch('/api/sms/optin', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ playerId, optin: e.target.checked }),
      });
      // Optimistic — page reload picks up the change
    }}
  />
  <input
    type="tel"
    placeholder="+15551234567"
    defaultValue={data.sms_phone ?? ''}
    onBlur={async e => {
      const phone = e.target.value.trim();
      if (!phone || /^\+\d{8,15}$/.test(phone)) {
        await fetch('/api/sms/optin', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ playerId, optin: data.sms_optin === true, phone }),
        });
      }
    }}
    className="bg-[var(--color-bg-card)] border border-[var(--color-border)] px-2 py-1 text-xs text-[var(--color-text)]"
  />
</div>
```

Make sure the `data` prop type now includes `sms_phone` and `sms_optin` (you updated `lib/types.ts` `PlayerSheet` interface in Task 15 already).

- [ ] **Step 3: Type-check + build**

```bash
npx tsc --noEmit 2>&1 | grep -v ".next/types"
npm run build
```

- [ ] **Step 4: Verify**

Open `/players/ashton`. Toggle the checkbox, type a phone, click away. Refresh — values persist. Verify in the DB:

```bash
psql "$DATABASE_URL" -c "SELECT id, sms_optin, sms_phone FROM player_sheets WHERE id = 'ashton'"
```

- [ ] **Step 5: Commit**

```bash
git add components/PlayerSheet.tsx
git commit -m "feat(raven-post): SMS opt-in toggle on PlayerSheet"
```

---

## Task 20: Final smoke pass

- [ ] **Step 1: Type-check + build + lint clean**

```bash
npx tsc --noEmit 2>&1 | grep -v ".next/types"
npm run build
npm run lint
```

All three must produce no errors.

- [ ] **Step 2: End-to-end flow test**

1. **DM publishes a broadsheet item:** Open `/dm/raven-post`, type a beat, click "Draft with AI", edit, click Publish. Verify a row appears in Published Items.
2. **Player sees it:** Open `/raven-post?playerId=ashton`. Verify the broadsheet renders with the new headline.
3. **Newsie audio fires:** Open `/players/ashton`, wait 10–20s. With ELEVENLABS_API_KEY set, you should hear audio. Without it, no audio but no errors. The Raven nav link should pulse red regardless.
4. **Mark as read silences future newsie fires:** Click the Raven link, navigate back. No second pulse on the next visit.
5. **Weather overlay:** Set weather to `storm` via API. Open `/players/ashton`, see lightning flicker.
6. **DM queues an overheard, player triggers it (manual API call):**
   ```bash
   curl -s -X POST -H "content-type: application/json" \
     -d '{"body":"Test overheard rumor"}' http://localhost:3000/api/raven-post/overheard/queue
   curl -s -X POST -H "content-type: application/json" \
     -d '{"playerId":"ashton"}' http://localhost:3000/api/raven-post/overheard/trigger
   # Expected (without Twilio): {"result":"no-twilio"} or {"result":"no-optin"} depending on player config
   ```
7. **Sendings have no reply slot:** Publish a sending via the DM page. Verify it appears as a glowing card on the player's `/raven-post` view, with no input field, with the footer "no sender · no reply."

- [ ] **Step 3: Commit any final fixes**

If steps in Task 20 surfaced issues, fix them inline and commit. Otherwise no commit needed.

- [ ] **Step 4: Notify the user**

Summarize what was built. Ask if they want to push.

---

## Self-review

**Spec coverage:**
- ✅ Schema: items, reads, overheard queue, deliveries, triggers, weather, sms opt-in fields, volume/issue counter on campaign → Task 1
- ✅ Geo helpers hoisted from AR → Task 2
- ✅ ElevenLabs helper with budget gate → Task 3
- ✅ Twilio helper with budget gate → Task 4
- ✅ AI draft helper (Anthropic Haiku) → Task 5
- ✅ High-level publish + overheard orchestration → Task 6
- ✅ All API routes (items GET/POST/PATCH/DELETE/read, headlines, draft, overheard queue + trigger, weather, sms opt-in, newsie mp3 server) → Tasks 7–9
- ✅ RavenBroadsheet visual with weather pill, masthead, headlines, ravens, sendings card, classifieds, ad modal → Task 10
- ✅ /raven-post player page → Task 11
- ✅ PlayerBanner weather overlay → Task 12
- ✅ NewsieCallout (audio + nav pulse trigger) → Task 13
- ✅ OverheardWatcher (geolocation watch) → Task 14
- ✅ /players/[id] integration: Raven nav link, NewsieCallout, OverheardWatcher, RavenNavPulse → Task 15
- ✅ /dm/raven-post page + DmNav entry + RavenManualCompose → Task 16
- ✅ DM Library Overheard Queue pane → Task 17
- ✅ DM Published Items pane → Task 18
- ✅ SMS opt-in UI on player sheet → Task 19
- ✅ End-to-end smoke pass → Task 20
- ✅ Sendings: no reply slot, own card (Task 10 RavenBroadsheet, Task 7 schema validates ≤25 words)
- ✅ Ads: just `medium='ad'` items, no separate flow (Task 7, Task 16)
- ✅ Campaign Volume/Issue counter (Task 1 schema, Task 6 advanceIssueCounter, Task 11 page reads it)
- ✅ Citadel Tree radius alignment to 100m (already on disk from prior work)
- ✅ "skip newsie if already read" → Task 13 NewsieCallout's lastReadAt check

**Placeholder scan:** No "TBD"/"TODO"/"implement later" except the explicit deferred-by-spec items captured at the top of the file.

**Type consistency:** `RavenItem`, `RavenMedium`, `RavenTrust`, `WeatherCondition`, `RavenWeatherRow`, `RavenOverheardQueueRow`, `RavenHeadlinesPayload` are defined in Task 1 and used consistently in Tasks 5–18.

**Method signatures cross-check:**
- `publishItem` in `lib/raven-post.ts` (Task 6) takes `PublishArgs` and returns `RavenItem`. Used by `app/api/raven-post/items/route.ts` (Task 7) — matches.
- `triggerOverheard(playerId: string)` in Task 6 returns a discriminated string. Used by `app/api/raven-post/overheard/trigger/route.ts` (Task 9) — matches.
- `draftBeat({medium, oneLineBeat})` in Task 5 returns `{ headline, body } | null`. Used by `app/api/raven-post/draft/route.ts` (Task 8) — matches.
- `renderNewsie({headlines})` in Task 3 returns `{ mp3PublicUrl, filename } | null`. Used by `lib/raven-post.ts.renderNewsieForLatest()` (Task 6) — matches.

**Cross-plan dependency:** This plan calls `assertCanSpend()`, `record()`, and `BudgetExceededError` from `lib/spend.ts` (Tasks 3, 4, 5). That helper is built in the parallel Budget Tracker plan's Task 2. **Build the Budget Tracker plan's Tasks 1–2 before starting this plan's Task 3.**

Plan ready.
