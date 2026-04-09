---
title: "feat: Raven Post World AI Engine"
type: feat
status: active
date: 2026-04-09
origin: docs/superpowers/specs/2026-04-08-raven-post-world-ai-design.md
---

# Raven Post World AI Engine — Implementation Plan

## Overview

Add the persistent World AI agent loop that reads campaign state (journal, journey, player sheets, weather, world map, lunar calendar, the web) and proposes in-fiction news beats to the DM. The DM curates by checkbox in a new "World AI Suggestions" pane on `/dm/raven-post`. Published proposals flow into the existing `raven_items` table and reach players through the already-implemented broadsheet, newsie audio, and SMS surfaces.

## Problem Frame

The Core plan shipped manual compose — the DM authors every beat by hand. The World AI flips that: the *system* proposes beats from the campaign data, and the DM curates. This is what makes the world feel alive without the DM becoming a full-time copy editor.

See origin: `docs/superpowers/specs/2026-04-08-raven-post-world-ai-design.md`

## Requirements Trace

- R1. A background loop ticks every 3 hours (+ on-demand) and produces proposals
- R2. Pass 1 (Haiku triage) reads full campaign state with prompt caching; outputs 5–10 idea seeds
- R3. Pass 2 (Sonnet draft) takes one seed, RAGs 5 chunks from pgvector, does 1 web search, outputs polished prose + reasoning + tags + confidence
- R4. Proposals land in `raven_world_ai_proposals` with `prompt_version`, `confidence`, `status`
- R5. DM publishes via checkbox (creates `raven_items` row with `source = 'world_ai'`); unchecked items push down; pushdown ≥ 3 expires
- R6. DM can edit proposals inline before publishing; the diff informs future ticks
- R7. Budget gating: loop refuses to tick if Anthropic cap exceeded; web search capped at 10/day
- R8. Agent SDK / Max plan as primary auth path; API key as fallback
- R9. pgvector corpus indexes journal, journey, raven_items, and player sheet text fields
- R10. Real-world moon phase and notable astronomical events feed into the triage context
- R11. Prompt versioning tags every proposal; version bumps when the system prompt changes
- R12. DM curation pane at top of `/dm/raven-post` with live loop status, Generate Now, Pause

## Scope Boundaries

- No player-facing "Ask the World AI" interface
- No multi-campaign isolation (singleton `campaign_id = 'default'`)
- No Raven Radio, Discord delivery, or physical mail
- Budget Tracker UI (Tasks 3–9 of the budget tracker plan) is a separate follow-up — this plan only uses `lib/spend.ts` (already built)
- The affiliate API for ads and multiple SMS-trigger locations are in the v1 deadline but not part of *this* plan — they extend the Core, not the World AI

## Context & Research

### Relevant Code and Patterns

- `lib/raven-draft.ts` — existing Haiku-based one-line-beat drafting. The World AI triage prompt is a scaled-up version of this pattern. Uses `@anthropic-ai/sdk` v0.82.0 with `Anthropic({ apiKey })`.
- `lib/raven-post.ts` → `publishItem()` — the existing publish orchestrator that inserts into `raven_items`, advances the issue counter, and renders the newsie audio. The World AI publish path reuses this function directly.
- `lib/spend.ts` — `canSpend('anthropic')`, `record(...)`, `isOverCap(...)` for budget gating and cost tracking. Already wired into `lib/raven-draft.ts`, `lib/elevenlabs.ts`, `lib/twilio.ts`.
- `lib/anthropic-pricing.ts` — `anthropicCost(model, input, output, cached)` computes USD from token counts.
- `lib/schema.ts` — insertion point for new DDL is after line 854 (after the `campaign.raven_issues_per_volume` ALTER). All DDL uses `pool.query(...).catch(() => {})`.
- `@anthropic-ai/sdk` v0.82.0 supports prompt caching: `system` parameter accepts `Array<TextBlockParam>` where each block can carry `cache_control: { type: 'ephemeral' }`.

### Key Technical Findings

- **OpenAI SDK not installed.** Need `npm install openai` for `text-embedding-3-small` embeddings. The OpenAI embedding API is the cheapest path ($0.02/MTok) and pgvector expects `vector(1536)` which matches this model's output.
- **pgvector not bootstrapped.** `CREATE EXTENSION IF NOT EXISTS vector` must be added to `lib/schema.ts`. Railway Postgres supports pgvector on most plans — if the extension fails to create, the embedding pipeline should silently degrade (skip indexing, skip RAG, Pass 2 falls back to SQL-based context selection).
- **No Railway Cron config.** Only `nixpacks.toml` exists. Railway Cron requires a separate service definition or the Railway CLI (`railway cron`). Fallback: `pg_cron` or external uptime monitor.
- **Agent SDK viability unknown.** The spec recommends the Claude Agent SDK on the DM's Max plan as the primary auth path. This needs a spike task to validate: does an npm package exist, can it run headlessly on Railway, does auth survive redeploys. If the spike fails, the API key fallback is well-understood and already coded in `lib/raven-draft.ts`.

## Key Technical Decisions

- **Two auth paths behind a single config switch**: `lib/world-ai-client.ts` exports a `getWorldAiClient()` that returns either an Agent-SDK-authed or API-key-authed Anthropic client depending on env vars. All downstream code calls this — never instantiates `Anthropic` directly.
- **Embedding costs tracked under `'openai_embeddings'`**: Add this as a new service to `raven_budget_caps` with a $1/mo soft cap (embedding the full corpus is ~$0.01; ongoing deltas are pennies).
- **pgvector degradation**: If `CREATE EXTENSION vector` fails (Railway plan doesn't support it), set a flag in `raven_world_ai_state.pgvector_available = false` and skip all embedding/RAG work. Pass 2 falls back to loading the last 5 journal entries that mention the seed's entities via SQL `LIKE`.
- **Cron implementation**: Railway Cron preferred. If unavailable, the plan includes a self-contained `pg_cron` fallback and a third-option external heartbeat. The cron target is always `POST /api/raven-post/world-ai/tick` — stateless and idempotent.
- **Prompt caching structure**: The system prompt (static guidelines + style rules + guardrails) goes in the first `TextBlockParam` with `cache_control: { type: 'ephemeral' }`. The campaign context (journal, player sheets) goes in subsequent blocks without caching because it changes between ticks. This keeps ~3K tokens cached at $0.30/MTok while the variable context pays full price.
- **The loop is a single function call, not a daemon**: `runWorldAiTick(trigger: 'auto' | 'manual')` does everything in one shot and writes the tick log. Railway Cron calls this via the API route. This means no process management, no crash recovery, no state leaks between ticks.

## Open Questions

### Resolved During Planning

- **Railway Cron config format**: Railway uses a separate "Cron" service type in the project dashboard. The config is a JSON cron expression + a command. Not a file-level config — it's set via the Railway UI or CLI. The plan documents the setup steps.
- **pgvector on Railway**: Supported on Pro and Team plans. The Hobby plan may not have it. The plan includes a graceful degradation path.
- **OpenAI embedding model**: `text-embedding-3-small` outputs 1536-dimension vectors, matches the `vector(1536)` column spec. Verified.

### Deferred to Implementation

- **Agent SDK auth flow**: The npm package name and auth mechanism need a real spike. If it doesn't work headlessly, fall back to API key immediately.
- **Optimal `ivfflat lists` count**: The spec says `lists = 100` but with a small corpus (<1000 rows) this should be lower (e.g., 10). Tune after seeing real corpus size.
- **Prompt engineering for quality**: The exact system prompt text is directional in this plan. The first few ticks will reveal what works; `prompt_version` tracking supports iteration.

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```
┌─────────────────────────────────────────────────────┐
│  Railway Cron (every 3h)                            │
│  → POST /api/raven-post/world-ai/tick               │
└──────────────┬──────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────┐
│  runWorldAiTick(trigger)                             │
│                                                      │
│  1. Guard: paused? budget exceeded? nothing changed? │
│  2. Assemble context (journal, journey, sheets,      │
│     weather, lunar, prior proposals, DM edits)       │
│  3. Pass 1: Haiku triage → 5–10 idea seeds          │
│     (prompt-cached system block + full context)      │
│  4. For each qualifying seed:                        │
│     a. RAG: embed seed → top 5 pgvector chunks      │
│     b. Web search: 1 call per draft                  │
│     c. Pass 2: Sonnet draft → proposal row           │
│  5. Push down pending proposals (pushdown_count++)   │
│  6. Expire proposals with pushdown_count >= 3        │
│  7. Log tick to raven_world_ai_ticks                 │
│  8. Compute next_tick_at, write to state             │
└──────────────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────┐
│  DM Curation Pane (RavenWorldAiSuggestions.tsx)      │
│  ☐ proposal 1 (editable inline, checkbox = publish)  │
│  ☐ proposal 2                                        │
│  ☐ proposal 3                                        │
│  [⟳ Generate now]  [⏸ Pause]  loop status footer    │
└──────────────────────────────────────────────────────┘
               │ on checkbox
               ▼
┌──────────────────────────────────────────────────────┐
│  POST /api/raven-post/world-ai/proposals/:id/publish │
│  → flip status to 'published'                        │
│  → call publishItem() from lib/raven-post.ts         │
│    (inserts raven_items row with source='world_ai',   │
│     triggers newsie render for broadsheet items)     │
└──────────────────────────────────────────────────────┘
```

## Implementation Units

- [ ] **Unit 1: Schema + dependencies**

**Goal:** Add the World AI tables, pgvector extension, `source` column on `raven_items`, new types, and install the OpenAI SDK.

**Requirements:** R4, R9, R11

**Dependencies:** None (Core schema already landed)

**Files:**
- Modify: `lib/schema.ts` — append World AI DDL after line 854; add `ALTER TABLE raven_items ADD COLUMN IF NOT EXISTS source TEXT`; add `CREATE EXTENSION IF NOT EXISTS vector` (with `.catch` for graceful degrade)
- Modify: `lib/types.ts` — add `WorldAiState`, `WorldAiProposal`, `WorldAiTick`, `WorldAiCorpusRow` interfaces; add `'openai_embeddings'` to `SpendService` union
- Modify: `package.json` — `npm install openai`
- Modify: `lib/spend.ts` schema seed — add `('openai_embeddings', 1.00)` to the budget caps INSERT

**Approach:**
- `raven_world_ai_state` has `pgvector_available BOOLEAN NOT NULL DEFAULT true` — set to false if the extension creation fails (checked at runtime by the embedding pipeline)
- The `vector(1536)` column on `raven_world_ai_corpus` requires the extension to exist; wrap the CREATE TABLE in a conditional or accept that it will fail (and the `.catch` swallows the error) when pgvector is unavailable
- `raven_items.source` defaults to `'manual'` for existing rows (via `DEFAULT 'manual'`)

**Patterns to follow:**
- Existing DDL in `lib/schema.ts` (`.catch(() => {})` on every `pool.query`)
- Types in `lib/types.ts` (exported interfaces, snake_case DB-mirroring fields)

**Test scenarios:**
- Schema applies cleanly on a fresh DB with pgvector installed
- Schema applies cleanly on a DB without pgvector (extension creation fails silently, `raven_world_ai_corpus` table creation fails silently, `pgvector_available` remains true until the embedding pipeline sets it to false)
- `raven_items` rows from Core still work — `source` column is nullable or has a safe default
- `npx tsc --noEmit` clean after type additions

**Verification:**
- Dev server restart triggers schema, no errors in the server log
- `SELECT * FROM raven_world_ai_state` returns one seeded row
- `SELECT source FROM raven_items LIMIT 1` returns `'manual'` (or null on existing rows)
- Type check passes

---

- [ ] **Unit 2: Agent SDK spike + auth abstraction**

**Goal:** Validate whether the Claude Agent SDK runs headlessly on a Railway-deployed Node app. Regardless of outcome, produce a `lib/world-ai-client.ts` that exports a single `getWorldAiClient()` function returning a configured Anthropic client.

**Requirements:** R8

**Dependencies:** Unit 1 (types)

**Files:**
- Create: `lib/world-ai-client.ts`
- Modify: `package.json` — conditionally install `@anthropic-ai/agent-sdk` if the spike succeeds; no-op if it doesn't

**Approach:**
- **Spike first**: Check if `@anthropic-ai/agent-sdk` (or the current equivalent) is published on npm, supports headless server-side auth, and can create a messages client that passes the same interface as `new Anthropic({ apiKey })`. Document findings.
- **If spike succeeds**: `getWorldAiClient()` checks for `CLAUDE_AGENT_TOKEN` env var first (Agent SDK path), falls back to `ANTHROPIC_API_KEY` (API path). Both return a standard `Anthropic` client instance.
- **If spike fails**: `getWorldAiClient()` just uses `new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })` and the Agent SDK path is deferred to a future iteration. Document the failure reason.
- **Either way**: all downstream code (triage, drafting) calls `getWorldAiClient()`, never `new Anthropic()` directly. This makes the switch a single env-var change.
- The function should also return a `costMode: 'api' | 'max_plan'` flag so the caller knows whether to record costs to the budget tracker (API mode) or skip (Max plan mode).

**Patterns to follow:**
- `lib/raven-draft.ts` for existing Anthropic SDK usage
- `lib/email.ts` for the "no-op if key missing" pattern

**Test scenarios:**
- `getWorldAiClient()` returns a client when `ANTHROPIC_API_KEY` is set
- `getWorldAiClient()` returns null when neither key is set
- The `costMode` flag correctly reflects which path was chosen

**Verification:**
- Module compiles and exports cleanly
- A one-line Node REPL test (or curl against a temporary smoke route) confirms the client can hit the `messages.create` endpoint with Haiku

---

- [ ] **Unit 3: Lunar + almanac helpers**

**Goal:** Provide `getMoonPhase(date)` and `getAstronomicalEvents(windowDays)` so the triage context can include real-world celestial state.

**Requirements:** R10

**Dependencies:** None

**Files:**
- Create: `lib/lunar.ts`
- Create: `lib/almanac.ts`

**Approach:**
- **Lunar**: pure math (Metonic cycle approximation). Returns `{ phase: 'new' | 'waxing_crescent' | ... | 'waning_crescent', illumination: number, name: string, nextFullMoon: Date }`. No API call.
- **Almanac**: v1 hardcodes a small list of notable events (solstices, equinoxes, meteor showers, eclipses for 2026–2027). Returns `{ date: string, event: string, description: string }[]` for events within the next N days. Future versions swap to a real almanac API.

**Patterns to follow:**
- `lib/geo.ts` — pure math helper with no external deps

**Test scenarios:**
- `getMoonPhase(new Date('2026-04-09'))` returns a plausible phase (verify against a known almanac)
- `getAstronomicalEvents(30)` returns at least one event for any 30-day window in 2026
- Edge: `getAstronomicalEvents(0)` returns an empty array

**Verification:**
- Module compiles, no external dependencies, no `any`

---

- [ ] **Unit 4: Embedding pipeline**

**Goal:** Wrap OpenAI `text-embedding-3-small` in a helper that embeds text chunks and writes them to `raven_world_ai_corpus`. Include a batch-bootstrap function and an incremental-update function.

**Requirements:** R9

**Dependencies:** Unit 1 (schema + OpenAI SDK)

**Files:**
- Create: `lib/embeddings.ts`

**Approach:**
- `embedChunks(chunks: { source_type, source_id, chunk_text }[]): Promise<void>` — calls OpenAI embeddings API in batches of 100, writes rows to `raven_world_ai_corpus` with `ON CONFLICT (source_type, source_id) DO UPDATE`
- `bootstrapCorpus(): Promise<void>` — reads all journal entries, journey entries, raven_items, and player sheet text fields, chunks them (one row per DB row, no sub-chunking for v1), and calls `embedChunks`
- `embedNewRows(since: Date): Promise<void>` — incremental delta of rows modified since `since`
- `searchCorpus(queryText: string, topK: number): Promise<{ chunk_text, source_type, source_id, similarity }[]>` — embeds the query, runs a cosine similarity search against `raven_world_ai_corpus`, returns top K results
- **Graceful degrade**: if pgvector is unavailable (check `raven_world_ai_state.pgvector_available`), all functions no-op or return empty results. `searchCorpus` returns `[]` and the caller falls back to SQL.
- **Cost tracking**: every OpenAI call records cost via `record({ service: 'openai_embeddings', ... })`
- **Budget gate**: `canSpend('openai_embeddings')` before every batch

**Patterns to follow:**
- `lib/elevenlabs.ts` for the canSpend + record + silent-degrade pattern
- `lib/spend.ts` for the RecordArgs shape

**Test scenarios:**
- `bootstrapCorpus()` runs without error on an empty DB (no rows to embed = no API calls)
- `searchCorpus('tavern fire', 5)` returns results after bootstrapping with at least one matching journal entry
- When pgvector is unavailable, `searchCorpus` returns `[]` and `bootstrapCorpus` logs a warning and returns

**Verification:**
- `npx tsc --noEmit` clean
- After bootstrapping, `SELECT COUNT(*) FROM raven_world_ai_corpus` returns > 0 (on a DB with existing journal entries)

---

- [ ] **Unit 5: Context assembly**

**Goal:** Build the structured prompt input for Pass 1 (triage). Assembles journal, journey, player sheets, weather, world state, lunar phase, prior proposals, and DM edit history into a single prompt-ready payload.

**Requirements:** R2, R10

**Dependencies:** Unit 3 (lunar/almanac)

**Files:**
- Create: `lib/world-ai-context.ts`

**Approach:**
- `assembleTriageContext(): Promise<{ systemBlocks: TextBlockParam[], userContent: string }>` where `systemBlocks` are the prompt-cached system prompt blocks and `userContent` is the variable campaign state.
- The system prompt (static) goes in `systemBlocks[0]` with `cache_control: { type: 'ephemeral' }`. It contains: the agent's identity, the medium catalog, style rules, guardrails (no PII, no em-dashes, length caps), categories to explore, and the "DM teaches the agent" feedback loop instructions.
- The campaign context (variable) goes in `userContent`: recent journal entries (last 10 sessions), recent journey entries, all active player sheets (species/class/backstory/gear/level), current weather, current world entities, current lunar phase, recently published raven_items (last 20), pending proposals (so triage doesn't duplicate), expired proposals (so triage avoids them), and any DM edits from the last tick.
- **Prompt format**: structured markdown with clear section headers so the model can scan quickly. Player sheets are rendered as compact summaries (name, species, class, level, key backstory lines, current gear highlights).
- **DM edit diffs**: when the DM publishes a proposal after editing, store both the original body and the edited body. The context assembler includes the last 5 edit diffs as "the DM prefers prose like this: [original → edited]" so the agent learns the DM's voice.

**Patterns to follow:**
- `lib/raven-draft.ts` SYSTEM_PROMPTS for the per-medium prompt structure

**Test scenarios:**
- `assembleTriageContext()` returns non-empty systemBlocks and userContent when journal/player data exists
- The `cache_control` annotation is present on the first system block
- Player names in the context are character names, never real-world player names (R7 guardrail)

**Verification:**
- Module compiles
- A manual inspection of the assembled context string shows structured, parseable markdown

---

- [ ] **Unit 6: Pass 1 — Haiku triage**

**Goal:** Run the Haiku triage call that reads the full campaign context and outputs 5–10 idea seeds.

**Requirements:** R2, R7

**Dependencies:** Unit 2 (client), Unit 5 (context)

**Files:**
- Create: `lib/world-ai-triage.ts`

**Approach:**
- `runTriage(context: TriageContext): Promise<{ seeds: IdeaSeed[], usage: { input_tokens, output_tokens, cached_tokens } }>` where `IdeaSeed = { category: string, medium: RavenMedium, oneLiner: string, targetPlayer?: string, confidence: number }`
- Calls `getWorldAiClient()` for the Anthropic client, uses `claude-haiku-4-5-20251001` with `max_tokens: 1500`
- System blocks from context assembly (with `cache_control`)
- User content is the assembled campaign state
- Asks the model to return a JSON array of seed objects
- Parses with the same `text.match(/\[[\s\S]*\]/)` + `JSON.parse` pattern used in `lib/raven-draft.ts`
- **Budget gating**: `canSpend('anthropic')` before the call; `record(...)` after with the usage
- **Cost tracking**: uses `anthropicCost()` from `lib/anthropic-pricing.ts` when `costMode === 'api'`; skips recording when `costMode === 'max_plan'`

**Patterns to follow:**
- `lib/raven-draft.ts` for the Anthropic SDK call pattern, JSON extraction, and cost recording

**Test scenarios:**
- Returns 5–10 seeds with valid `medium` and `confidence` values
- Returns an empty array (not an error) when the campaign has no journal entries
- Budget gate prevents the call when Anthropic is paused

**Verification:**
- Module compiles
- A manual tick (via curl to the tick endpoint) produces seed output in the tick log

---

- [ ] **Unit 7: Pass 2 — Sonnet drafting**

**Goal:** Take a single idea seed, RAG relevant context from pgvector, do one web search, and produce a polished proposal.

**Requirements:** R3, R4, R11

**Dependencies:** Unit 2 (client), Unit 4 (embeddings/RAG), Unit 6 (triage output shape)

**Files:**
- Create: `lib/world-ai-draft.ts`

**Approach:**
- `draftProposal(seed: IdeaSeed, tickId: string): Promise<WorldAiProposal | null>`
- Steps:
  1. RAG: call `searchCorpus(seed.oneLiner, 5)` to get the 5 most relevant chunks from the vector DB. If pgvector unavailable, fall back to `SELECT * FROM sessions WHERE journal ILIKE '%{seed keyword}%' ORDER BY number DESC LIMIT 5` (SQL fuzzy match)
  2. Web search: call `client.messages.create(...)` with `tools: [{ type: 'web_search_20250305' }]` (Anthropic native web search tool). Parse the search results from the tool-use response.
  3. Sonnet draft: call `client.messages.create(...)` with `claude-sonnet-4-5` model, the seed + RAG context + web search results as user content, and the system prompt with style/length/medium rules.
  4. Parse the JSON response into `{ medium, body, headline, reasoning, tags, confidence }`
  5. Enforce length caps per medium (broadsheet 80 words, raven 60, sending 25, overheard 50)
  6. Record cost + web search call count
  7. Write to `raven_world_ai_proposals` with `prompt_version` from `raven_world_ai_state`
- **Budget gating**: `canSpend('anthropic')` before Sonnet call; `canSpend('websearch')` before web search. If web search is over cap, draft without it.
- **Daily web search cap**: read today's count from `raven_world_ai_ticks` and skip if ≥ 10

**Patterns to follow:**
- `lib/raven-draft.ts` for JSON extraction and length enforcement
- `lib/elevenlabs.ts` for the silent-degrade-on-failure pattern

**Test scenarios:**
- Produces a valid proposal with reasoning and tags from a seed
- Falls back to SQL context when pgvector is unavailable
- Skips web search gracefully when `websearch` service is over cap or paused
- Enforces word count caps per medium
- Records the proposal with the correct `prompt_version`

**Verification:**
- Module compiles
- A manual tick produces at least one proposal row in `raven_world_ai_proposals`

---

- [ ] **Unit 8: Loop runner**

**Goal:** Orchestrate a complete tick: guard checks → context assembly → triage → drafting → proposal management → tick logging.

**Requirements:** R1, R5, R7

**Dependencies:** Units 5, 6, 7

**Files:**
- Create: `lib/world-ai-loop.ts`

**Approach:**
- `runWorldAiTick(trigger: 'auto' | 'manual'): Promise<{ tickId: string, proposalsGenerated: number, skipped: boolean, reason?: string }>`
- Steps:
  1. **Guard checks**: read `raven_world_ai_state`. If `paused` → return `{ skipped: true, reason: 'paused' }`. If `canSpend('anthropic')` fails → return `{ skipped: true, reason: 'budget' }`.
  2. **Stale check** (auto ticks only): compare `last_tick_at` with the last modification time of journal, journey, player_sheets, and raven_items. If nothing changed since the last tick → return `{ skipped: true, reason: 'no_changes' }`.
  3. **Context assembly**: call `assembleTriageContext()`
  4. **Pass 1**: call `runTriage(context)` → seeds
  5. **Pass 2**: for the top N seeds (where N = `daily_cap_drafts / expected_ticks_today`, defaulting to 1), call `draftProposal(seed, tickId)`
  6. **Push down pending proposals**: `UPDATE raven_world_ai_proposals SET pushdown_count = pushdown_count + 1 WHERE status = 'pending'`
  7. **Expire stale proposals**: `UPDATE raven_world_ai_proposals SET status = 'expired' WHERE status = 'pending' AND pushdown_count >= 3`
  8. **Log the tick**: INSERT into `raven_world_ai_ticks` with token counts, cost, proposal count
  9. **Update state**: `UPDATE raven_world_ai_state SET last_tick_at = now(), next_tick_at = now() + interval '3 hours'`
- **Error handling**: if any step throws, log the error, write a tick row with `notes = error.message`, and return `{ skipped: true, reason: 'error' }`. Never leave the loop in an unrecoverable state.
- **Idempotent**: calling `runWorldAiTick` twice in quick succession is safe because the stale check prevents duplicate work.

**Patterns to follow:**
- `lib/raven-post.ts` → `triggerOverheard()` for the guard-check → transactional work → log pattern

**Test scenarios:**
- A tick on a fresh DB with journal data produces at least one proposal
- A tick on a paused loop returns `skipped: true, reason: 'paused'`
- A tick with no campaign changes since the last tick returns `skipped: true, reason: 'no_changes'` (auto only; manual bypasses this)
- A tick when Anthropic is over budget returns `skipped: true, reason: 'budget'`
- Push-down increments correctly; expiration fires at count ≥ 3

**Verification:**
- Module compiles
- `curl -X POST /api/raven-post/world-ai/tick` returns a tick result with `proposalsGenerated ≥ 0`

---

- [ ] **Unit 9: API routes**

**Goal:** Expose the World AI state, proposals, tick trigger, and tick history as REST endpoints.

**Requirements:** R1, R5, R12

**Dependencies:** Unit 8 (loop runner)

**Files:**
- Create: `app/api/raven-post/world-ai/state/route.ts` — GET + PATCH
- Create: `app/api/raven-post/world-ai/proposals/route.ts` — GET
- Create: `app/api/raven-post/world-ai/proposals/[id]/route.ts` — PATCH (inline edit)
- Create: `app/api/raven-post/world-ai/proposals/[id]/publish/route.ts` — POST
- Create: `app/api/raven-post/world-ai/tick/route.ts` — POST
- Create: `app/api/raven-post/world-ai/ticks/route.ts` — GET

**Approach:**
- **State GET/PATCH**: reads/updates `raven_world_ai_state` for the `'default'` campaign. PATCH accepts `paused`, `active_window_start`, `active_window_end`, `daily_cap_ticks`, `daily_cap_drafts`, `daily_cap_websearch`.
- **Proposals GET**: `SELECT * FROM raven_world_ai_proposals WHERE status = 'pending' ORDER BY confidence DESC LIMIT 50`
- **Proposals PATCH**: inline edit — updates `body`, `headline`, `tags`, `reasoning`. Records the original body in a `original_body` field for DM-edit-diff tracking (add this column to the proposals table if not present).
- **Proposals publish POST**: inside a transaction, flip `status = 'published'`, call `publishItem(...)` from `lib/raven-post.ts` with `source: 'world_ai'`, set `published_item_id` to the new raven_items row id. The `publishItem` function needs a small modification to accept and pass through the `source` field — or the publish route writes to `raven_items` directly.
- **Tick POST**: calls `runWorldAiTick('manual')`, returns the result. This is the target of Railway Cron AND the "Generate now" button.
- **Ticks GET**: `SELECT * FROM raven_world_ai_ticks ORDER BY ticked_at DESC LIMIT 20`. Used by the loop status footer in the DM pane.
- Hand-rolled validation, `ensureSchema()` at the top, try/catch with 500, `NextResponse.json` — matching the existing Core routes.

**Patterns to follow:**
- `app/api/raven-post/items/route.ts` for the GET + POST pattern
- `app/api/raven-post/items/[id]/route.ts` for the dynamic PATCH pattern
- `app/api/spend/caps/route.ts` for the state GET + PATCH pattern

**Test scenarios:**
- GET state returns the seeded default row
- PATCH state toggles `paused` and reflects the change on subsequent GET
- POST tick returns a valid tick result (or `skipped: true` if no campaign data)
- GET proposals returns items ordered by confidence DESC
- POST publish creates a `raven_items` row and flips the proposal status

**Verification:**
- All 6 route files compile
- `npm run build` shows the new routes in the route tree
- curl round-trips on state, proposals, and tick behave as expected

---

- [ ] **Unit 10: DM curation pane (World AI Suggestions)**

**Goal:** Add a new `RavenWorldAiSuggestions` pane at the top of `/dm/raven-post` that shows pending proposals, lets the DM edit inline and publish by checkbox, and shows loop status.

**Requirements:** R5, R6, R12

**Dependencies:** Unit 9 (API routes)

**Files:**
- Create: `components/dm/RavenWorldAiSuggestions.tsx`
- Modify: `app/dm/raven-post/page.tsx` — import and render the new pane above `<RavenManualCompose>`

**Approach:**
- Polls `GET /api/raven-post/world-ai/proposals` on mount and every 30s
- Polls `GET /api/raven-post/world-ai/state` for the loop status footer (last tick, next tick, paused flag, counters)
- Each proposal row:
  - Checkbox on the left. Checking it → `POST /api/raven-post/world-ai/proposals/:id/publish` → refetch proposals list
  - Editable textarea for body (and headline if broadsheet). Blur-to-save via `PATCH /api/raven-post/world-ai/proposals/:id`
  - Reasoning displayed as a small italic label below the body (e.g., "because: party heading to Baldur's Gate · ties to Lord Calder (journal s7)")
  - Tags, confidence, and medium shown as metadata
  - Unchecked items show a "↓ will push down" hint
- Header bar: live-pulsing dot (blue when loop is active, grey when paused), "World AI — Suggested Beats" title, "N new · streamed X min ago" tag
- Action bar: "⟳ Generate now" button (hits `POST /tick`), "⏸ Pause loop" button (hits `PATCH /state` with `paused: true/false`)
- Footer: loop status (last tick, next tick, proposed/published/pushed-down/pending counts from the ticks history)

**Patterns to follow:**
- `components/dm/RavenOverheardQueue.tsx` for the poll-fetch-render-edit-on-blur cycle
- `components/CampaignSpendTracker.tsx` for the polling + action bar + status footer pattern
- The brainstorm mockup at `.superpowers/brainstorm/43900-1775686275/content/dm-curation-v2.html` for the exact visual

**Test scenarios:**
- Pane renders with "no suggestions yet" when proposals table is empty
- After a tick produces proposals, pane shows them ordered by confidence
- Checking a proposal's checkbox publishes it (item appears on `/raven-post`)
- Editing a proposal's body inline saves on blur
- "Generate now" button triggers a tick and refreshes the list
- "Pause" button toggles the paused state and updates the header dot color

**Verification:**
- Component renders at `/dm/raven-post` above the Manual Compose pane
- `npm run build` succeeds
- Live round-trip: generate → edit → publish → verify item on `/raven-post`

---

- [ ] **Unit 11: Railway Cron wiring**

**Goal:** Configure the scheduled tick to fire every 3 hours automatically.

**Requirements:** R1

**Dependencies:** Unit 9 (tick route must exist)

**Files:**
- Create: `docs/railway-cron-setup.md` — documentation for the DM
- Optionally modify: `railway.json` or create a Railway CLI script

**Approach:**
- Railway Cron is set up via the Railway dashboard or CLI, not via file-based config. This unit documents the exact steps:
  1. In the Railway project, add a new "Cron" service
  2. Set the schedule to `0 */3 * * *` (every 3 hours)
  3. Set the command to `curl -s -X POST https://<app-domain>/api/raven-post/world-ai/tick -H "Authorization: Bearer $WORLD_AI_CRON_SECRET"`
  4. Add `WORLD_AI_CRON_SECRET` as an env var on both the app service and the cron service
- **Auth on the tick endpoint**: the `POST /api/raven-post/world-ai/tick` route should check for a `Authorization: Bearer <secret>` header matching `WORLD_AI_CRON_SECRET`. This prevents public access to the tick trigger. Manual "Generate now" from the DM pane doesn't need this header because it's same-origin.
- **Fallback if Railway Cron isn't available**: document the `pg_cron` approach (install the extension, create a cron job that calls the tick function via `pg_notify` or HTTP) and the external-heartbeat approach (cron-job.org free tier, hits the tick endpoint every 3 hours).

**Patterns to follow:**
- None in the existing codebase — this is new infrastructure

**Test scenarios:**
- The cron fires and produces a tick log row
- An unauthorized request to `/api/raven-post/world-ai/tick` without the secret header is rejected (401)
- The same-origin "Generate now" button still works (no auth header required for browser-origin requests)

**Verification:**
- Documentation is clear enough for the DM to set up
- The tick endpoint validates the secret when present, allows same-origin when absent
- After setup, ticks appear in `raven_world_ai_ticks` every 3 hours

---

- [ ] **Unit 12: Corpus bootstrap + incremental indexing**

**Goal:** Run the initial embedding of all campaign data into the pgvector corpus, and wire incremental updates to fire after each tick.

**Requirements:** R9

**Dependencies:** Unit 4 (embedding pipeline), Unit 8 (loop runner for the incremental hook)

**Files:**
- Create: `app/api/raven-post/world-ai/bootstrap/route.ts` — POST route that runs `bootstrapCorpus()`
- Modify: `lib/world-ai-loop.ts` — call `embedNewRows(since: lastTick)` at the start of each tick (before context assembly) so the corpus stays fresh

**Approach:**
- The bootstrap route is a one-time (or on-demand) operation the DM triggers after first setup: `curl -X POST /api/raven-post/world-ai/bootstrap`
- Incremental: at the start of each tick, call `embedNewRows(state.last_tick_at)` to index any journal/journey/item rows added since the last tick. This is a fast delta (usually 0–5 rows) and costs negligible embedding tokens.
- Both paths respect the `canSpend('openai_embeddings')` gate

**Patterns to follow:**
- `app/api/spend/reconcile/route.ts` for a one-time-operation POST route

**Test scenarios:**
- Bootstrap on a DB with 10 journal entries produces 10 corpus rows
- A tick after adding a new journal entry embeds just that entry (delta = 1)
- Bootstrap on a DB without pgvector returns a warning message and no error

**Verification:**
- `SELECT COUNT(*) FROM raven_world_ai_corpus` grows after bootstrap
- Incremental indexing adds rows between ticks without re-embedding the full corpus

---

- [ ] **Unit 13: End-to-end smoke + rollout notes**

**Goal:** Verify the full loop end-to-end and document rollout requirements.

**Requirements:** All

**Dependencies:** All prior units

**Files:**
- Create: `docs/raven-post-world-ai-rollout.md` — env vars, Railway setup steps, first-tick checklist

**Approach:**
- Run a full manual tick via `curl -X POST /api/raven-post/world-ai/tick`
- Verify proposals land in `raven_world_ai_proposals`
- Check one proposal via the DM pane
- Verify a `raven_items` row appears with `source = 'world_ai'`
- Verify the newsie audio renders (if broadsheet) or the item appears on `/raven-post`
- Verify the tick log in `raven_world_ai_ticks` has token counts and cost
- Verify the budget tracker's Anthropic meter updated (if on API path)
- Document all required env vars:
  - `ANTHROPIC_API_KEY` (or `CLAUDE_AGENT_TOKEN` for Max plan path)
  - `OPENAI_API_KEY` (for embeddings)
  - `WORLD_AI_CRON_SECRET` (for cron auth)
  - `ELEVENLABS_API_KEY`, `TWILIO_*` (already documented in Core)
- Document Railway Cron setup steps (cross-reference Unit 11's doc)
- Document the `POST /api/raven-post/world-ai/bootstrap` one-time step

**Verification:**
- A complete end-to-end cycle works: tick → proposals → DM checks one → item appears for players
- `tsc --noEmit` clean, `npm run build` succeeds, `npm run lint` passes

## System-Wide Impact

- **Interaction graph:** The tick route calls triage → draft → proposal-write. The publish route calls `publishItem()` which inserts into `raven_items`, advances the issue counter, and triggers `renderNewsie()`. This means a World AI publish touches the same downstream chain as a manual DM publish.
- **Error propagation:** Tick failures are logged to `raven_world_ai_ticks.notes` and never bubble up to players. The loop is self-healing: the next tick starts fresh.
- **State lifecycle risks:** Proposals in `pending` state accumulate if the DM doesn't curate. The pushdown/expiry mechanism prevents unbounded growth (expired after 3 ticks ≈ 9 hours). The DM pane only shows pending proposals (not expired).
- **API surface parity:** The existing `POST /api/raven-post/items` (manual publish) and the new `POST /api/raven-post/world-ai/proposals/:id/publish` (World AI publish) both produce `raven_items` rows, but through different code paths. Both must tag `source` correctly (`'manual'` vs `'world_ai'`).
- **Integration coverage:** The most important cross-layer scenario is: tick → proposal → DM publishes → newsie renders → player sees broadsheet → newsie audio plays. This chain spans 6 modules and should be verified end-to-end in Unit 13.

## Risks & Dependencies

- **Agent SDK may not exist or work headlessly** — Unit 2 is a spike with an explicit fallback. Risk is mitigated.
- **pgvector may not be available on the current Railway plan** — Graceful degradation documented in Units 1 and 4. The feature works without RAG, just with less rich context.
- **Prompt quality** — The triage and drafting prompts will need iteration. `prompt_version` tracking enables A/B comparison. The first few ticks should be monitored manually.
- **Cost surprise** — Even with the Max plan, if the DM switches to the API path temporarily, the 3-hour cadence could produce unexpected charges. The budget tracker's soft cap + kill switch mitigate this.
- **Railway Cron availability** — If Railway doesn't support Cron on the current plan, the fallback (pg_cron or external heartbeat) is documented but requires additional setup.

## Documentation / Operational Notes

- `docs/railway-cron-setup.md` covers the Railway Cron wiring
- `docs/raven-post-world-ai-rollout.md` covers env vars, first-tick checklist, and troubleshooting
- The `prompt_version` system should be documented in DESIGN.md's Ideas section once the first prompt is stable

## Sources & References

- **Origin document:** [docs/superpowers/specs/2026-04-08-raven-post-world-ai-design.md](docs/superpowers/specs/2026-04-08-raven-post-world-ai-design.md)
- Related code: `lib/raven-draft.ts`, `lib/raven-post.ts`, `lib/spend.ts`, `lib/anthropic-pricing.ts`
- Related plans: `docs/superpowers/plans/2026-04-08-raven-post-core.md`, `docs/superpowers/plans/2026-04-08-raven-post-budget-tracker.md`
- Anthropic prompt caching docs: https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching
- OpenAI embeddings API: https://platform.openai.com/docs/guides/embeddings
- pgvector docs: https://github.com/pgvector/pgvector
