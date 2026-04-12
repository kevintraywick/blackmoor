---
title: "fix: World AI hardening — retry, transactions, key validation"
type: fix
status: completed
date: 2026-04-12
deepened: 2026-04-12
---

# World AI Hardening — Retry, Transactions, Key Validation

## Overview

The Raven Post World AI loop works but fails silently on transient errors with no retry, has a non-atomic publish flow, and doesn't detect misconfigured API keys until the first call fails. This plan addresses the three highest-impact gaps.

## Problem Frame

The World AI calls three external APIs (Anthropic, ElevenLabs, Twilio). All use a silent-degrade pattern — failures return `null` and the tick skips. This is correct for budget pauses and missing keys, but wrong for transient network errors and rate limits. A single 503 from Anthropic silently drops a 3-hour tick. The publish flow writes to two tables without a transaction, risking orphaned `raven_items` rows. API key typos go undetected until runtime.

## Requirements Trace

- R1. Transient failures on Anthropic and ElevenLabs calls retry with exponential backoff before giving up
- R2. The proposal publish flow is atomic — either both the `raven_items` insert and `raven_world_ai_proposals` status update succeed, or neither does
- R3. Missing or malformed API keys are logged at startup with clear warnings

## Scope Boundaries

- No budget caps, monthly spend limits, or DM-facing alerts (deferred)
- No concurrent tick protection / advisory locks (deferred)
- No Twilio retry (SMS is fire-and-forget by design; delivery receipts are Twilio's job)
- No changes to the silent-degrade pattern for missing keys — `null` return stays
- No web search retry (the draft proceeds without web context on failure — acceptable)

## Context & Research

### Relevant Code and Patterns

- `lib/world-ai-triage.ts` — single Anthropic Haiku call at line 43, catches all errors at line 123
- `lib/world-ai-draft.ts` — Anthropic Sonnet call at line 166, web search call earlier (~line 110), catches errors broadly
- `lib/elevenlabs.ts` — single fetch call at line 49, 20s timeout via `AbortSignal.timeout`, catches at top level
- `lib/world-ai-client.ts` — `getWorldAiClient()` returns null if key missing (line 52)
- `lib/twilio.ts` — similar pattern, returns false on failure
- `lib/db.ts` — `withTransaction(fn)` helper exists (line 35), takes a `PoolClient` callback
- `app/api/raven-post/world-ai/proposals/[id]/publish/route.ts` — three sequential queries (lines 27, 36, 42) not wrapped in transaction
- `lib/raven-post.ts` — `publishItem()` does the `raven_items` INSERT

### Institutional Learnings

- `ensureSchema` is memoized — schema DDL runs once per server start, making it the right place for startup validation
- Silent-degrade is the established pattern — don't change the contract, just add retry before the final `return null`

## Key Technical Decisions

- **Shared retry helper, not per-file retry loops**: A `withRetry(fn, opts)` utility in `lib/retry.ts` keeps retry logic in one place. Anthropic and ElevenLabs callers wrap their fetch/SDK call in it. Rationale: DRY, testable, consistent backoff behavior.
- **3 retries, exponential backoff (1s, 2s, 4s)**: Matches Anthropic's rate limit guidance. Total wall time ~7s worst case — acceptable within a background tick.
- **Retry only on transient errors**: 429 (rate limit), 500, 502, 503, 529 (Anthropic overloaded), network errors, and timeouts. Do NOT retry 400 (bad request) or 401 (bad key).
- **Key validation as warnings, not crashes**: Log `console.warn` at schema init time. Don't block startup — the app works without the World AI.
- **Disable SDK internal retry**: The Anthropic SDK (v0.82.0) retries internally by default (`maxRetries: 2`). Set `maxRetries: 0` in `getWorldAiClient()` so `withRetry` owns the full retry loop. This avoids double-retry (SDK retries 2× internally, then `withRetry` retries 3× on top = up to 9 attempts).
- **Transaction wraps the full publish flow**: Use `withTransaction` around the `publishItem` call + both UPDATE queries. `publishItem` needs a `client` parameter override.

## Open Questions

### Resolved During Planning

- **Should `publishItem` accept a transaction client?** Yes — add an optional `client` parameter. When provided, it uses that client instead of the shared pool. This keeps the existing non-transactional callers working unchanged.
- **Where to validate keys?** In `ensureSchema()` — it runs once at startup and is the existing gate for all initialization. Add key checks after the DDL block.

### Deferred to Implementation

- Exact retry jitter strategy (fixed vs random jitter)
- Whether `AbortSignal.timeout` on ElevenLabs should increase on retry (20s → 30s → 40s) or stay fixed

## Implementation Units

- [ ] **Unit 1: Retry helper**

**Goal:** Create a reusable retry-with-backoff utility.

**Requirements:** R1

**Dependencies:** None

**Files:**
- Create: `lib/retry.ts`

**Approach:**
- Generic async function `withRetry<T>(fn: () => Promise<T>, opts?)` that catches errors, checks if retryable, waits with exponential backoff, and re-throws after max attempts
- `opts`: `maxAttempts` (default 3), `baseDelayMs` (default 1000), `isRetryable` (predicate on error)
- Default `isRetryable` uses Anthropic SDK's typed error hierarchy (v0.82.0): `RateLimitError`, `InternalServerError`, `APIConnectionError`, `APIConnectionTimeoutError` are retryable. `BadRequestError`, `AuthenticationError`, `NotFoundError` are not. For non-SDK errors (plain fetch), check `error.status` or `error.name === 'AbortError'`
- The helper should also accept a raw `Response` object pattern for fetch-based callers (ElevenLabs) — see Unit 2 approach
- Returns the successful result or throws the last error

**Patterns to follow:**
- `lib/email.ts` silent-degrade pattern (but retry adds a layer before the final give-up)

**Test scenarios:**
- Succeeds on first try — no delay
- Fails twice with 503 then succeeds — returns result
- Fails 3 times — throws the last error
- 400 error — does not retry, throws immediately

**Verification:**
- Helper is importable and typed correctly
- `tsc --noEmit` passes

---

- [ ] **Unit 2: Wire retry into Anthropic + ElevenLabs calls**

**Goal:** Wrap the Anthropic SDK calls (triage + draft) and ElevenLabs fetch in `withRetry`.

**Requirements:** R1

**Dependencies:** Unit 1

**Files:**
- Modify: `lib/world-ai-triage.ts`
- Modify: `lib/world-ai-draft.ts`
- Modify: `lib/elevenlabs.ts`

**Approach:**
- In `runTriage`: wrap the `wc.client.messages.create()` call in `withRetry`. The Anthropic SDK throws typed errors (`RateLimitError`, `InternalServerError`, etc.) — the default `isRetryable` handles them directly. The existing outer try/catch stays and returns `null` after retries exhaust (preserving silent-degrade)
- In `draftProposal`: wrap the main Sonnet draft `messages.create()` call in `withRetry`. Do NOT retry the web search call — it already has its own try/catch that continues without web context, and web search failures are acceptable
- In `renderNewsie`: `fetch()` does not throw on non-2xx — it returns a Response. Wrap the fetch in a function that checks `res.ok` and, if the status is retryable (429/500/502/503), throws an error with the status code to trigger `withRetry`. If `res.ok`, return the response. This bridges fetch's non-throwing behavior with `withRetry`'s throw-based model
- Do NOT change any return types or the external contract of these functions
- Log retry attempts at `console.warn` level with the attempt number and error status

**Patterns to follow:**
- Existing error handling in each file — retry wraps the inner call, outer catch stays unchanged

**Test scenarios:**
- Triage: Anthropic returns 529 twice then succeeds — triage completes normally
- Draft: Sonnet returns 503 once then succeeds — draft completes normally
- ElevenLabs: TTS returns 502 then succeeds — audio file saved
- All three: permanent failure (3× 503) — each function returns null, tick continues

**Verification:**
- `console.log` messages on retry attempts visible in server output
- Functions still return null on permanent failure (no behavior change for callers)
- `tsc --noEmit` passes

---

- [ ] **Unit 3: Atomic proposal publish**

**Goal:** Wrap the publish flow in a database transaction so raven_items insert and proposal status update are atomic.

**Requirements:** R2

**Dependencies:** None

**Files:**
- Modify: `app/api/raven-post/world-ai/proposals/[id]/publish/route.ts`
- Modify: `lib/raven-post.ts` (add optional `client` parameter to `publishItem`)

**Approach:**
- `publishItem` currently makes 2 `query()` calls: one SELECT for volume/issue, one INSERT for the raven_items row. Both need the client override when running inside a transaction
- Add an optional `client?: PoolClient` parameter. When provided, use a local `q` function that delegates to `client.query` with the same signature as the shared `query` helper
- In the publish route, wrap the `publishItem` call + both UPDATE queries in `withTransaction`. The `ensureSchema()` call stays outside the transaction (it's idempotent and shouldn't hold the transaction open)
- `publishItem` is also called from `app/api/raven-post/items/route.ts` — that caller doesn't pass a client, so it continues using the shared pool (backwards-compatible)

**Patterns to follow:**
- `lib/db.ts::withTransaction` — existing helper, used elsewhere in the codebase
- `lib/game-clock.ts` uses `withTransaction` for the clock advance + entity tick — same pattern

**Test scenarios:**
- Publish succeeds — both `raven_items` row and proposal status updated atomically
- `publishItem` throws — transaction rolls back, no orphaned raven_items row
- Proposal status UPDATE fails — transaction rolls back, raven_items row cleaned up

**Verification:**
- Publish still works end-to-end (manual test via DM curation page)
- On simulated failure, neither table has partial state
- `tsc --noEmit` passes

---

- [ ] **Unit 4: API key validation at startup**

**Goal:** Log clear warnings at startup when API keys are missing or obviously malformed.

**Requirements:** R3

**Dependencies:** None

**Files:**
- Modify: `lib/schema.ts` (add key validation after DDL block)

**Approach:**
- After the existing DDL statements in `ensureSchema()`, add a validation block that checks:
  - `ANTHROPIC_API_KEY` — present and starts with `sk-ant-`
  - `ELEVENLABS_API_KEY` — present (no known prefix convention)
  - `TWILIO_ACCOUNT_SID` — present and starts with `AC`
  - `TWILIO_AUTH_TOKEN` — present
- For each missing/malformed key, `console.warn` with a clear message like `⚠ ANTHROPIC_API_KEY is missing — World AI triage and drafting will be disabled`
- Do NOT throw or block startup — the app works without these services
- Do NOT log the key value — just presence and format

**Patterns to follow:**
- `lib/world-ai-client.ts` line 52 — existing pattern of checking key presence and returning null

**Test scenarios:**
- All keys present and valid — no warnings
- `ANTHROPIC_API_KEY` missing — warning logged, app starts normally
- `ANTHROPIC_API_KEY` present but doesn't start with `sk-ant-` — warning about possible misconfiguration
- Multiple keys missing — all warnings logged

**Verification:**
- Server restart with correct keys shows no warnings
- Server restart with missing key shows the expected warning in console
- `tsc --noEmit` passes

## Risks & Dependencies

- **Anthropic SDK error shape (resolved)**: Verified — SDK v0.82.0 exports typed error classes (`RateLimitError`, `InternalServerError`, `APIConnectionError`, `APIConnectionTimeoutError`). All have a `.status` property. The `isRetryable` predicate can use `instanceof` checks. No runtime discovery needed.
- **`publishItem` callers**: Two callers exist: the publish route (will use transaction) and `app/api/raven-post/items/route.ts` (manual publish, stays non-transactional). The optional `client` parameter is backwards-compatible.
- **Retry wall-time impact on tick**: Worst case: triage retries 3× (7s) + draft retries 3× (7s) = 14s added to a tick. The tick runs on a 3-hour cadence in a background cron — 14s is negligible. ElevenLabs retry is separate (runs after the tick, during publish) and adds at most 60s (20s timeout × 3 attempts) — acceptable for a background audio render.
- **Anthropic `retry-after` header**: Anthropic sends a `retry-after` header on 429 responses. The SDK's own retry mechanism may already handle this if the SDK has built-in retry. Check at implementation time whether the SDK retries internally — if so, wrapping in `withRetry` could cause double-retry. The SDK constructor accepts `maxRetries` (default 2). Set `maxRetries: 0` on the Anthropic client to disable SDK-internal retry and let `withRetry` own the full retry loop.

## Sources & References

- Anthropic rate limit docs: 429 with `retry-after` header, 529 for overloaded
- Anthropic SDK v0.82.0: typed error classes (`RateLimitError`, `InternalServerError`, etc.), `maxRetries` constructor option
- Existing `withTransaction` usage in `lib/game-clock.ts`
- `publishItem` callers: `proposals/[id]/publish/route.ts` and `raven-post/items/route.ts`
- Audit findings from this conversation session (2026-04-12)
