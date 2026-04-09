# The Raven Post — World AI (v2) Design

**Date:** 2026-04-08
**Status:** Spec — **routes to `/ce:plan` for deeper planning before implementation**
**Target:** **v1, deadline Sunday 2026-04-19** (extended from Apr 12 to absorb the World AI scope)
**Companion specs:**
- `2026-04-08-raven-post-core-design.md` (v1, ships first)
- `2026-04-08-raven-post-budget-tracker-design.md` (v1, parallel)

## Why this is its own spec

The World AI is the *heart* of the Raven Post but also the most novel and the most failure-prone piece. It needs:

- A persistent agent loop with its own state
- Web research authority and the budget guardrails to match
- A learning model that gets smarter as the DM curates
- Deep integration with the Core spec's `raven_items` table and the existing campaign state (journal, journey, world map, weather, player notes, **player sheets and play history**)

Standing this up well requires its own planning pass via `/ce:plan` — model selection, prompt engineering, the loop's exact contract with the Core curation pane, the cost ceiling, the state schema. **v1 now includes the World AI** (the user pulled it back in from v2 after extending the deadline). The Core spec is still designed so the World AI slots in cleanly by writing into the existing `raven_items` table with a `source = 'world_ai'` flag.

## Goal

A persistent, agentic background process that reads the campaign state and proposes new in-fiction news beats to the DM. The DM curates by checkbox; published items land in `raven_items` and reach players through the Core surfaces.

The agent should make the world feel like it moves while the party sleeps — and the prose should feel like a real fantasy author wrote it, not a chatbot.

## What it reads

- `journal` — DM-private session notes (campaign state)
- `journey` — public per-session timeline (player-visible canon)
- `player_sheets.player_notes` — what each player is currently focused on
- `player_sheets.dm_notes` — DM's per-player threads
- **`player_sheets`** — every player's **species, class, level, alignment, backstory, character traits, gear, spells, items, gold, HP/AC** — the agent should know who each PC *is*, not just what they did
- **Per-player play history** — recent boons, poisons, marketplace activity, initiative rolls, session logs they featured in. Anything the DB knows about how each PC has been playing the game shapes the proposals for them.
- `raven_items` — what's already been published
- `raven_overheard_queue` — what's queued to fire
- `world_hexes` (when world map exists) — geography, weather, army positions
- `campaign` — game clock, current in-fiction date, the world's name
- **The real-world calendar** — current date, moon phase, notable astronomical events (full moons especially)
- **The web** — Wikipedia, Wikia/Fandom, mythology references, and any other source the agent decides it needs

This means when the World AI proposes a beat for Pip the Halfling Ranger whose backstory mentions a dead mentor, the proposal can *name* the mentor, *reference* the manner of their death, and tie a new mentor's appearance to a real character thread the DM established at the table. The agent isn't writing for *a* party — it's writing for *this* party.

## What it produces

A stream of **proposed beats** in the same shape as `raven_items`, plus:

- A `reasoning` field — why the agent proposed this. Visible in the DM curation pane (e.g. *"because: party is heading toward Baldur's Gate · ties to Lord Calder's tax dispute (journal s7)"*). The reasoning is also what the agent learns from when items are published vs pushed-down.
- A `source = 'world_ai'` flag on `raven_items` so we can tell agent-authored from DM-authored items.
- Tags pre-populated from entities the agent recognized in the campaign state.
- A `confidence` score (0–100) the agent assigns to itself — used to sort suggestions in the DM pane.

## Categories the agent should explore

Each loop should produce a *mix* across these categories, not a stack of one type:

- **Weather omens** — tied to the real-world weather model and the in-fiction lunar calendar
- **Faction movement** — armies, guilds, religious orders
- **Political beats** — decrees, postponements, scandals, elections, taxes
- **Economic beats** — sales, shortages, ship arrivals, caravan losses
- **Mentor news** — the party's mentors growing, dying, reaching out, offering training
- **Skill-building hooks** — masters willing to teach, hidden trainers, lost techniques
- **Guild news** — promotions, expulsions, walkouts, contracts
- **Mystery hooks** — missing children, disappearing nobles, strange humming stones
- **Real-world parallels** — comets, eclipses, astronomical events drawn from the IRL calendar
- **Callbacks** — items that escalate or resolve earlier beats (the "three-clue rule" from the Alexandrian)
- **Real-world ads** — products from the curated bookstore directory (TODO) that fit the current beat

## Loop trigger

- **Time-based background loop** — **every 3 hours**, all day. (We'll tune from real usage.)
- **DM-on-demand button** — `⟳ Generate now` in the curation pane. Forces an immediate tick.
- **No automatic ticks on game-clock advance.** The DM is in control of cadence.
- The loop pauses itself if **nothing has changed** in the campaign state since the last tick (no new journal entries, no game time advance, no curation activity).
- The loop **kills itself** if the budget tracker reports the Anthropic monthly cap is exceeded.

At 3-hour cadence: **8 ticks/day**. Plus a typical handful of manual ticks per day.

## Two-pass architecture (cost discipline)

Use a two-pass to minimize Sonnet calls:

**Pass 1 — Triage (Claude Haiku):**
- Cheap, fast, runs every tick.
- Reads a compressed summary of campaign state (NOT the full journal).
- Outputs a list of 5–10 *idea seeds* — terse one-line directions ("guild news: Stonecutters walk out", "mentor: Cedric reaches out re skill-building").
- Cost target: **~$0.003/tick.**

**Pass 2 — Drafting (Claude Sonnet):**
- Triggered selectively. Only runs on idea seeds that score above the confidence threshold.
- Reads the full relevant context for that one seed (journal + journey + entity tags + relevant player sheets).
- Outputs the polished prose, the reasoning, the tags, the confidence.
- Cost target: **~$0.05/draft** (API pricing) — but see "Authentication & cost model" below for the Max-plan path.

## Authentication & cost model

There are two ways to call Claude from this codebase:

### Path A — Anthropic API (`ANTHROPIC_API_KEY`)

Real numbers, computed from Anthropic's published pricing (Sonnet 4.5: $3/MTok input, $15/MTok output; Haiku 4.5: $1/MTok input, $5/MTok output):

**Per Haiku triage call:** ~5K input + ~500 output = $0.005 + $0.0025 = **~$0.008/tick**

**Per Sonnet draft call:** ~8K input (system prompt + relevant journal slice + relevant player sheet) + ~600 output (prose + reasoning + tags) = 8K × $3/MTok + 600 × $15/MTok = $0.024 + $0.009 = **~$0.033/draft**. With prompt caching on the static system prompt (~3K of the input cached at $0.30/MTok instead of $3/MTok), this drops to **~$0.027/draft**.

At **8 ticks/day** with **1 Sonnet draft per tick** (good triage, one polished proposal each cycle):
- Triage: 8 × $0.008 = $0.064/day = ~$2/mo
- Drafts: 8 × $0.027 = $0.22/day = ~$6.50/mo
- **Total: ~$8–9/mo with prompt caching, ~$10/mo without.**

If we run **3 Sonnet drafts per tick** (richer suggestion stream): ~$20–22/mo. Still well inside the $8 cap if we throttle to 1 draft/tick, comfortable inside a $25 cap if we want 3.

The earlier "$36/mo" in this spec was wrong — it baked in 30-minute cadence (48 ticks/day, not 8) and skipped prompt caching. Corrected.

### Path B — Claude Agent SDK on the Max plan

Uses the DM's existing **Claude Max plan** subscription. Same models, same prompts, no per-token API charge. Auth via the DM's local Claude Code login on the Railway box (or a long-lived OAuth token). The DM is already using this for Claude Code in this conversation.

**Cost: $0 incremental**, until the Max plan's usage limits are reached (which at 8 ticks/day + the DM's normal Claude Code use is comfortably below the limit).

### Recommendation

**Use Path B (Agent SDK / Max plan) as primary, Path A (API key) as fallback.** With Path B, the Anthropic budget meter sits at $0 indefinitely. With Path A as fallback, the realistic spend is ~$8–10/mo at the throttled cadence — still under the $8 soft cap if we use Haiku triage + 1 Sonnet draft per tick, slightly over if we want 3 drafts.

`/ce:plan` should validate the Agent SDK runs cleanly under Railway's Node runtime and that authentication survives redeploys.

## Web research authority

The agent has access to:

- **Anthropic native web search tool** (`web_search` in the Anthropic API) — primary
- **Curated lookup helpers** (lib helpers the agent can call):
  - `lib/lunar.ts` — `getMoonPhase(date)` returns phase + name + IRL date of next full moon. No API call required (math).
  - `lib/almanac.ts` — `getAstronomicalEvents(window)` returns notable events in the next N days. v1 hardcodes a small list of well-known events; later swaps to a real almanac API.
  - `lib/wiki.ts` — wraps WebFetch on Wikipedia with caching.

Web search costs are tracked in the budget tracker. Cap: **10 calls/day**.

## Persistent state

New tables, prefix `raven_world_ai_`:

```sql
CREATE TABLE raven_world_ai_state (
  campaign_id   TEXT PRIMARY KEY,
  active_themes TEXT[] DEFAULT '{}',           -- themes the agent is currently playing with
  paused        BOOLEAN NOT NULL DEFAULT false,
  last_tick_at  TIMESTAMPTZ,
  next_tick_at  TIMESTAMPTZ,
  active_window_start TIME DEFAULT '18:00',
  active_window_end   TIME DEFAULT '23:00',
  daily_cap_ticks    INTEGER NOT NULL DEFAULT 4,
  daily_cap_drafts   INTEGER NOT NULL DEFAULT 12,
  daily_cap_websearch INTEGER NOT NULL DEFAULT 10,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE raven_world_ai_proposals (
  id            TEXT PRIMARY KEY,                       -- ulid
  proposed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  medium        TEXT NOT NULL,
  body          TEXT NOT NULL,
  headline      TEXT,
  reasoning     TEXT NOT NULL,
  tags          TEXT[] DEFAULT '{}',
  confidence    INTEGER NOT NULL,                       -- 0..100
  status        TEXT NOT NULL DEFAULT 'pending',        -- 'pending' | 'published' | 'pushed_down' | 'expired'
  pushdown_count INTEGER NOT NULL DEFAULT 0,            -- how many ticks it's survived without being checked
  published_item_id TEXT REFERENCES raven_items(id),
  prompt_version INTEGER NOT NULL DEFAULT 1,            -- system prompt version that produced this proposal
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_raven_proposals_prompt_version ON raven_world_ai_proposals(prompt_version);

-- Vector DB corpus for Pass 2 RAG (pgvector extension required)
-- CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE raven_world_ai_corpus (
  id            TEXT PRIMARY KEY,                       -- ulid
  source_type   TEXT NOT NULL,                          -- 'journal' | 'journey' | 'raven_items' | 'player_sheet'
  source_id     TEXT NOT NULL,                          -- foreign key into the source table
  chunk_text    TEXT NOT NULL,
  embedding     vector(1536),                           -- text-embedding-3-small
  indexed_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_raven_corpus_embedding ON raven_world_ai_corpus
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
CREATE INDEX idx_raven_corpus_source ON raven_world_ai_corpus(source_type, source_id);

CREATE INDEX idx_raven_proposals_status ON raven_world_ai_proposals(status, confidence DESC);

CREATE TABLE raven_world_ai_ticks (
  id            TEXT PRIMARY KEY,                       -- ulid
  ticked_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  trigger       TEXT NOT NULL,                          -- 'auto' | 'manual'
  haiku_input_tokens  INTEGER,
  haiku_output_tokens INTEGER,
  sonnet_input_tokens  INTEGER,
  sonnet_output_tokens INTEGER,
  websearch_calls     INTEGER NOT NULL DEFAULT 0,
  proposals_generated INTEGER NOT NULL DEFAULT 0,
  cost_usd      NUMERIC(10, 4),
  notes         TEXT
);
```

The `raven_world_ai_proposals` table is the agent's working memory. When the DM checks a proposal box in the curation UI, the row's `status` flips to `published` and a new `raven_items` row is created from it. When the next tick runs and a proposal is still `pending`, its `pushdown_count` increments — at `pushdown_count >= 3` it expires and the agent learns *not* to propose anything similar.

## How the DM teaches the agent

- **Published** = a strong positive signal. The agent biases toward similar themes/voices on subsequent ticks.
- **Pushed down** (left unchecked across ticks) = a soft negative. The agent slowly de-emphasizes that direction.
- **Expired** (pushed down 3+ times) = a hard negative. The agent records the *reasoning* of the expired proposal in a "do not propose" memory and stops generating that family.
- **DM inline edits before publishing** = a style signal. The diff between the agent's prose and the DM's edit gets folded into the next tick's prompt as "the DM prefers prose like this."

## API routes

Under `app/api/raven-post/world-ai/`:

| Route | Method | Purpose |
|---|---|---|
| `/api/raven-post/world-ai/state` | GET, PATCH | Read or update loop state, caps, active window, paused flag |
| `/api/raven-post/world-ai/proposals` | GET | List pending proposals, ordered by confidence |
| `/api/raven-post/world-ai/proposals/:id/publish` | POST | DM ticks a box → flip status, create raven_items row |
| `/api/raven-post/world-ai/proposals/:id` | PATCH | Inline edit before publishing |
| `/api/raven-post/world-ai/tick` | POST | Manual "Generate now" trigger |
| `/api/raven-post/world-ai/ticks` | GET | Recent tick history for the loop status footer |

## The loop process

The loop is **not** a long-running Node process — it's a scheduled task that runs once per tick and exits, so it survives Railway redeploys cleanly.

Two implementation options for `/ce:plan` to evaluate:

- **(a) Vercel/Railway cron** — a `pg_cron` job (Railway Postgres supports it) or a Railway Cron service that hits `POST /api/raven-post/world-ai/tick` every 30 min during the active window.
- **(b) Self-scheduling internal route** — each tick computes `next_tick_at` and stores it; an external uptime monitor (cron-job.org or similar) hits a heartbeat endpoint every minute that fires the next tick if `now() >= next_tick_at`.

Lean toward **(a)** for cleanliness but `/ce:plan` should pick.

## Guardrails

- **Budget cap from the budget tracker** — if Anthropic spend exceeds the soft cap, loop refuses to tick. Hard cap kills the loop and emails the DM.
- **Rate limit on web search** — 10 calls/day, hard cap. Failed-over loops produce no proposals rather than continuing without research.
- **No PII** — the agent must never include real-world player names in proposals (it sees player IDs and character names only).
- **Style guardrail** — agent prompt explicitly forbids modern idioms, AI-tells (em-dashes, "It's not just X, it's Y"), and the user's documented `feedback_no_ai_prose` preferences.
- **Length cap** — broadsheet items capped at 80 words, ravens at 60, sendings at 25, overheards at 50.
- **Kill switch** — DM can pause from `/dm/raven-post`, from `/dm/campaign` budget widget, or by setting `paused = true` in the DB directly.

## Resolved decisions (for `/ce:plan` to implement)

These were open questions in the first draft of this spec; the DM has answered them:

- **Models — Haiku 4.5 triage + Sonnet 4.5 drafts.** With prompt caching enabled on the static system prompt to keep input costs flat across ticks.
- **Cron — Railway Cron.** The native scheduler. `/ce:plan` should validate the project supports it and that the cron job survives redeploys without manual re-attachment. Falls back to `pg_cron` if Railway Cron is unavailable.
- **Pass 1 context strategy — full text dump.** Triage reads the full recent journal entries, the full journey, and the relevant player sheets verbatim. No auto-summary helper. **Prompt caching is mandatory** because the bulk of this input is static between ticks — without caching, the per-tick triage cost rises to ~$0.08; with caching it sits at ~$0.015. `/ce:plan` must wire prompt caching from day one.
- **Vector DB scope — index everything.** All four sources get embedded into `world_ai_corpus`: journal entries, journey entries, `raven_items`, and player sheet text fields (backstory, traits, notes). Pass 2 RAGs the top 5 most relevant chunks for the seed it's drafting. This is the maximally rich Pass 2 context option.
- **Web search — aggressive (1 call per Sonnet draft).** Every draft pass includes one `web_search` call so the prose is reliably grounded in real-world references. At 8 ticks/day × 1 draft/tick × 1 search/draft = 8 searches/day, comfortably under the 10/day soft cap. Realistic spend: ~$2.40/month at API rates, $0 on the Max plan path. **The DM has explicitly authorized backing this off later if the spend feels high.**
- **Fail-soft mode — keep proposing.** If ElevenLabs or Twilio is down, the loop continues to propose and publish items. The broadsheet page works without the newsie audio. The Overheard queue holds rumors until Twilio recovers. Only an Anthropic outage stops the loop entirely.
- **Prompt versioning — tag every proposal.** Add a `prompt_version INTEGER NOT NULL DEFAULT 1` column to `raven_world_ai_proposals`. When the system prompt changes, increment the version. Pending proposals keep their original version so the DM can filter / A/B compare across versions in the curation pane.

## Cost summary at the chosen settings

| Component | Per tick | Per day (8 ticks) | Per month |
|---|---|---|---|
| Haiku triage (full-text input, cached) | ~$0.015 | ~$0.12 | **~$3.60** |
| Sonnet draft (1 per tick, cached) | ~$0.027 | ~$0.22 | **~$6.50** |
| Web search (1 per draft) | ~$0.01 | ~$0.08 | **~$2.40** |
| **API path total** | | | **~$12.50** |
| **Max plan / Agent SDK path total** | | | **$0** |

The Max-plan path is the recommendation. The API path is the fallback and is still under the $19 total budget cap.

## Out of scope (still)

- Player-facing "Ask the World AI" interface (no — the agent never talks to players, only proposes to the DM)
- Multi-campaign isolation (the agent's state is currently campaign-scoped, but the loop assumes one campaign — fine for now, revisit if multi-campaign happens)
- Raven Radio (24/7 news + period music stream)
- Discord delivery
- Real-world deliveries (physical mail to players)

The vector DB / curated literary corpus is **in v1** per the Apr-19 deadline extension. The affiliate API for ads is **in v1**. Multiple SMS-trigger locations beyond the library are **in v1**.
