# Raven Post Budget Tracker — Design

**Date:** 2026-04-08
**Status:** Spec — ready for implementation plan
**Target:** **v1 by Sunday 2026-04-19** (parallel with Core)
**Companion specs:**
- `2026-04-08-raven-post-core-design.md` (v1)
- `2026-04-08-raven-post-world-ai-design.md` (v1, routes through `/ce:plan`)

## Goal

A live, page-width spend widget at the bottom of `/dm/campaign` that tracks every dollar the Raven Post (and the rest of the campaign infra) costs the DM each month. Includes hard caps, kill switches, and a per-service ledger.

The DM should never be surprised by a bill. The widget exists so the answer to *"is this feature too expensive to run?"* is always one glance away.

## Surface

A single component, `components/CampaignSpendTracker.tsx`, rendered at the bottom of `/dm/campaign` after all existing fields and the home artwork drop circle. Page-width (matches `max-w-[1000px]` per DESIGN.md).

The visual is the v3 mockup from the brainstorm session — meter rows per service, a total row, an action bar with adjust caps, view ledger, and the kill switches. See `.superpowers/brainstorm/43900-1775686275/content/dm-curation-v2.html` for reference.

## Tracked services

| Service | Source of cost data | Default soft cap |
|---|---|---|
| **ElevenLabs** | Local accounting — every TTS render adds the character cost. ElevenLabs `/v1/user/subscription` endpoint reports actual usage; we reconcile nightly. | $5/mo |
| **Anthropic** | Local accounting — every Claude call records `input_tokens` and `output_tokens`; we compute cost from a hardcoded price table per model. **Note:** if the World AI runs through the Claude Agent SDK on the DM's Max plan (recommended in the World AI spec), Anthropic API charges are $0 and this line tracks $0/mo. The schema and meter still exist so we can fall back to API mode without code changes. | $8/mo (only meaningful in API-fallback mode) |
| **Twilio** | Twilio Messaging API returns price per message in the response (`price`, `price_unit`). Sum into the ledger. Plus $1/mo for the number itself, hardcoded. | $3/mo |
| **Web search** | Anthropic web search reports per-call cost in the API response. Sum into ledger. | $3/mo |
| **Railway** | Railway has a `usage` API on the project (verify exact endpoint path; if no API, manual entry by the DM monthly). | (no cap — informational only) |

**Total soft target: under $20/month** (excluding Railway's fixed hosting).

## What "soft cap" means

Each service has a `soft_cap_usd` value stored in `raven_budget_caps`. Behavior:

- **Below 80% of soft cap** → green meter, no warnings.
- **80%–100% of soft cap** → gold meter, banner warning at the top of the spend widget.
- **Above 100% of soft cap** → red meter, banner warning, the relevant feature **degrades**:
  - ElevenLabs over cap → newsie audio silently no-ops (no MP3 renders) until next month
  - Anthropic over cap → World AI loop refuses to tick + manual draft button is disabled with tooltip
  - Twilio over cap → SMS push silently no-ops (the Overheard trigger fires server-side and logs the SMS but never sends)
  - Web search over cap → World AI runs without web research

**Hard kill switches** are separate from caps. Hitting the "Pause World AI" button sets a flag that disables the loop regardless of cap state. Same for "Pause SMS push."

## Schema

```sql
CREATE TABLE raven_budget_caps (
  service       TEXT PRIMARY KEY,                       -- 'elevenlabs' | 'anthropic' | 'twilio' | 'websearch' | 'railway'
  soft_cap_usd  NUMERIC(10, 2) NOT NULL,
  paused        BOOLEAN NOT NULL DEFAULT false,         -- hard kill switch for this service
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE raven_spend_ledger (
  id            TEXT PRIMARY KEY,                       -- ulid
  service       TEXT NOT NULL,                          -- matches raven_budget_caps.service
  amount_usd    NUMERIC(10, 4) NOT NULL,
  units         INTEGER,                                -- chars, tokens, messages, calls
  unit_kind     TEXT,                                   -- 'chars' | 'input_tok' | 'output_tok' | 'sms' | 'call'
  details       JSONB,                                  -- model name, voice id, target player, etc.
  occurred_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  ref_table     TEXT,                                   -- 'raven_items' | 'raven_world_ai_ticks' | etc
  ref_id        TEXT
);

CREATE INDEX idx_raven_spend_service_time ON raven_spend_ledger(service, occurred_at DESC);
CREATE INDEX idx_raven_spend_month ON raven_spend_ledger(date_trunc('month', occurred_at));

-- Seed default caps on schema bootstrap
INSERT INTO raven_budget_caps (service, soft_cap_usd) VALUES
  ('elevenlabs', 5.00),
  ('anthropic', 8.00),
  ('twilio', 3.00),
  ('websearch', 3.00),
  ('railway', 0.00)
ON CONFLICT (service) DO NOTHING;
```

Schema additions go in `lib/schema.ts` inside `ensureSchema()`. Same restart-the-dev-server gotcha applies.

## Helper module

`lib/spend.ts` — the single source of truth for recording and querying spend.

```ts
// Record a charge
record({ service, amount_usd, units?, unit_kind?, details?, ref?: { table, id } }): Promise<void>

// Query month-to-date totals for the widget
mtdSpend(): Promise<{ service: string, soft_cap: number, mtd_usd: number, paused: boolean }[]>

// Pre-flight gate: throws BudgetExceededError if the service is paused or over hard kill
assertCanSpend(service: string): Promise<void>

// Check whether a service should silently degrade (over soft cap)
isOverCap(service: string): Promise<boolean>
```

Every external-call helper integrates with `lib/spend.ts`:

- `lib/elevenlabs.ts` calls `assertCanSpend('elevenlabs')` first, then `record()` after the API call returns
- `lib/twilio.ts` same pattern, parses Twilio's `price` from the response
- `lib/anthropic.ts` (the existing one used for inventory drafts and the planned World AI) wraps every call to compute cost from `input_tokens × $/MTok + output_tokens × $/MTok` per model
- A nightly cron reconciles the ledger against ElevenLabs' actual usage endpoint (`GET /v1/user/subscription`) to catch drift

## API routes

| Route | Method | Purpose |
|---|---|---|
| `/api/spend/mtd` | GET | Returns the meter-row data for the widget |
| `/api/spend/caps` | PATCH | Adjust soft caps + pause flags |
| `/api/spend/ledger` | GET | Returns the most recent N rows of the ledger for the "View ledger" modal. Supports `?service=` and `?from=` filters. |
| `/api/spend/reconcile` | POST | Triggers the nightly reconciliation manually (also called by Railway cron once a day) |

## Component breakdown

- `components/CampaignSpendTracker.tsx` — the main widget. Page-width. Hits `/api/spend/mtd` on mount and revalidates every 60 s.
- `components/CampaignSpendCapsModal.tsx` — modal triggered by "Adjust caps". Form for editing each service's `soft_cap_usd` and `paused` flag.
- `components/CampaignSpendLedgerModal.tsx` — modal triggered by "View ledger". Paginated table of recent rows.

## Visual (matches the v3 mockup)

```
┌──────────────────────────────────────────────────────────────────┐
│ Raven Post — month-to-date spend                                  │
│                                                                    │
│ ElevenLabs   ████████░░░░░░░  $2.40 / $5                          │
│ Anthropic    ██████████░░░░░  $5.10 / $8                          │
│ Twilio SMS   █████░░░░░░░░░░  $1.05 / $3                          │
│ Web search   ██████░░░░░░░░░  $1.25 / $3                          │
│ Railway      —                $—                                  │
│ ──────────────────────────────────────────────                    │
│ Total MTD                     $9.80 / $19  (green)                │
│                                                                    │
│ [Adjust caps]  [View ledger]  [⏸ Pause World AI]  [⏸ Pause SMS]   │
└──────────────────────────────────────────────────────────────────┘
```

Colors: green when total < 80% of cap, gold when 80–100%, red when over.

## Campaign page cleanup (related)

Per the brainstorm decision, also **remove the Background textarea** from `/dm/campaign` while we're in the file. `components/CampaignPageClient.tsx` line ~134, the field with placeholder `"The campaign backstory…"`. The DB column stays; only the field stops rendering. Backstory belongs in the journal.

## Constraints, gotchas, and care points

- **`ensureSchema` memoization** — restart the dev server after the new DDL lands.
- **Nightly reconciliation** — needs Railway Cron or pg_cron. If neither is set up yet, ship without it for v1 and reconcile manually until it lands.
- **Race conditions** — two simultaneous `assertCanSpend` calls could both pass before either records. For v1 this is acceptable: a few cents of overshoot is fine. If it becomes a problem, move the check + record into a single SQL transaction with `SELECT ... FOR UPDATE` on `raven_budget_caps`.
- **Railway cost tracking** — verify whether Railway actually exposes a per-project usage API. If not, ship with manual monthly entry by the DM and add the API integration later.
- **The widget polls every 60 s** — fine at the DM-only volume.
- **Ledger size** — append-only, never deleted. Add a `DELETE FROM raven_spend_ledger WHERE occurred_at < now() - interval '6 months'` cron later if it grows large. Not v1.
- **Hard kill switches need to feed back to the loop** — World AI loop, SMS push, ElevenLabs render all need to check `raven_budget_caps.paused = true` *before* making any external call. This requires the cap-check to be invoked before the external call, not after.
- **Page-width on `/dm/campaign`** — the spend tracker matches the page's `max-w-[1000px]` content width per DESIGN.md.
- **`tsc --noEmit` clean before deploy.**

## Resolved decisions

- **Railway usage API — investigate during v1.** First implementation task: spike the Railway GraphQL API (`https://backboard.railway.com/graphql/v2`) to confirm it exposes a per-project usage figure. If yes, wire it. If no, the Railway meter row falls back to manual monthly entry by the DM with a "Set this month's Railway bill" inline edit. Either way the line shows up in v1.
- **No CSV export** from the View Ledger modal. DM queries the DB directly if they need to.
- **Historical monthly charts** (3-month, 6-month rollups) → **v2**. v1 shows month-to-date only.

## v2 backlog

- Monthly historical charts (3 / 6 / 12 month rollups, sparkline per service)
- Budget alerts via SMS to the DM at 80% / 100% of soft cap
- Per-feature attribution drill-down (e.g. "what did the World AI alone cost this month vs manual drafts")
