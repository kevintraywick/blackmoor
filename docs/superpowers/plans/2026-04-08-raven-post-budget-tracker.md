# Raven Post Budget Tracker — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a page-width spend tracker widget at the bottom of `/dm/campaign` that meters ElevenLabs, Anthropic, Twilio, web search, and Railway costs against per-service soft caps, with hard kill switches and a ledger view.

**Architecture:** A `lib/spend.ts` helper is the single source of truth for recording/querying spend, gating external calls, and reporting "over cap" status. Two new tables (`raven_budget_caps`, `raven_spend_ledger`) get added to `lib/schema.ts`. Four API routes (`/api/spend/mtd`, `/caps`, `/ledger`, `/reconcile`) expose them. A client component `CampaignSpendTracker.tsx` polls month-to-date totals every 60s. Two modal components handle "Adjust caps" and "View ledger." The Background textarea is removed from the campaign page in the same touch.

**Tech Stack:** Next.js 16 App Router (server components default, `'use client'` for interactive widgets), Postgres via `lib/db.ts` (`pg.Pool`, no ORM), TypeScript strict mode, Tailwind v4 (with the Safari gotcha — use inline `style={{}}` for layout-critical surfaces).

**Ship target:** Sunday 2026-04-19 (parallel with Core, this lands first).

**Build / verify commands** (project has no test framework — verification is type-check + manual eyeball):
- Type check: `npx tsc --noEmit 2>&1 | grep -v ".next/types"`
- Production build: `npm run build`
- Lint: `npm run lint`
- Dev server: `npx next dev -p 3000` (must restart after DDL changes — `ensureSchema` is memoized)

---

## File structure

**Files to create:**
- `lib/spend.ts` — record/query/gate helper (the single source of truth)
- `lib/anthropic-pricing.ts` — hardcoded model price table (used by spend.ts callers)
- `lib/railway-usage.ts` — Railway GraphQL spike (returns null on failure)
- `app/api/spend/mtd/route.ts` — GET month-to-date totals
- `app/api/spend/caps/route.ts` — GET + PATCH soft caps and pause flags
- `app/api/spend/ledger/route.ts` — GET recent ledger rows
- `app/api/spend/reconcile/route.ts` — POST manual reconciliation trigger
- `components/CampaignSpendTracker.tsx` — main widget
- `components/CampaignSpendCapsModal.tsx` — adjust caps modal
- `components/CampaignSpendLedgerModal.tsx` — view ledger modal

**Files to modify:**
- `lib/schema.ts` — add `raven_budget_caps` and `raven_spend_ledger` tables; seed default caps
- `lib/types.ts` — add `BudgetCap`, `SpendLedgerRow`, `MtdSpend` types
- `components/CampaignPageClient.tsx` — remove Background textarea (line ~134); render `<CampaignSpendTracker />` at the bottom
- `app/dm/campaign/page.tsx` — pass anything the tracker needs (it's self-fetching, so probably nothing)

---

## Task 1: Schema additions and types

**Files:**
- Modify: `lib/schema.ts`
- Modify: `lib/types.ts`

- [ ] **Step 1: Add the two tables to `_initSchema()` in `lib/schema.ts`**

Find the end of `_initSchema()` (currently around line 696, just after the npc backfill loop) and append before the closing brace:

```ts
  // ── Raven Post: budget tracker ─────────────────────────────────────────────
  // Two tables: per-service caps + paused flags, and an append-only ledger of
  // every charge from ElevenLabs / Anthropic / Twilio / Anthropic web search /
  // Railway. The ledger is the source of truth for month-to-date spend; the
  // caps row stores the soft cap and the hard kill-switch flag.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS raven_budget_caps (
      service       TEXT PRIMARY KEY,
      soft_cap_usd  NUMERIC(10, 2) NOT NULL,
      paused        BOOLEAN NOT NULL DEFAULT false,
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `).catch(() => {});

  await pool.query(`
    CREATE TABLE IF NOT EXISTS raven_spend_ledger (
      id            TEXT PRIMARY KEY,
      service       TEXT NOT NULL,
      amount_usd    NUMERIC(10, 4) NOT NULL,
      units         INTEGER,
      unit_kind     TEXT,
      details       JSONB,
      occurred_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      ref_table     TEXT,
      ref_id        TEXT
    )
  `).catch(() => {});

  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_raven_spend_service_time
       ON raven_spend_ledger(service, occurred_at DESC)`
  ).catch(() => {});

  await pool.query(
    `CREATE INDEX IF NOT EXISTS idx_raven_spend_month
       ON raven_spend_ledger(date_trunc('month', occurred_at))`
  ).catch(() => {});

  // Seed the default soft caps once. ON CONFLICT keeps existing DM tweaks.
  await pool.query(`
    INSERT INTO raven_budget_caps (service, soft_cap_usd) VALUES
      ('elevenlabs', 5.00),
      ('anthropic',  8.00),
      ('twilio',     3.00),
      ('websearch',  3.00),
      ('railway',    0.00)
    ON CONFLICT (service) DO NOTHING
  `).catch(() => {});
```

- [ ] **Step 2: Add new types to `lib/types.ts`**

Append at the end of `lib/types.ts`:

```ts
// ── Raven Post: budget tracker ─────────────────────────────────────────────

export type SpendService = 'elevenlabs' | 'anthropic' | 'twilio' | 'websearch' | 'railway';

export interface BudgetCap {
  service: SpendService;
  soft_cap_usd: number;
  paused: boolean;
  updated_at: string;
}

export interface SpendLedgerRow {
  id: string;
  service: SpendService;
  amount_usd: number;
  units: number | null;
  unit_kind: string | null;
  details: Record<string, unknown> | null;
  occurred_at: string;
  ref_table: string | null;
  ref_id: string | null;
}

export interface MtdSpend {
  service: SpendService;
  soft_cap_usd: number;
  mtd_usd: number;
  paused: boolean;
}
```

- [ ] **Step 3: Restart the dev server so the new DDL runs**

The `ensureSchema()` function is memoized across the process lifetime — new DDL won't run on a hot reload. Stop the existing dev server (Ctrl-C, or `lsof -i :3000` then `kill <pid>`), then restart with `npx next dev -p 3000`.

- [ ] **Step 4: Type-check and verify the schema applied**

Run: `npx tsc --noEmit 2>&1 | grep -v ".next/types"`
Expected: no output (clean).

Then trigger schema by hitting any API in the browser, then verify the tables exist:

```bash
# In another terminal — adjust DATABASE_URL if your local pg is different
psql "$DATABASE_URL" -c "\d raven_budget_caps"
psql "$DATABASE_URL" -c "\d raven_spend_ledger"
psql "$DATABASE_URL" -c "SELECT service, soft_cap_usd FROM raven_budget_caps ORDER BY service"
```

Expected: tables show their columns; the SELECT returns 5 rows (anthropic, elevenlabs, railway, twilio, websearch).

- [ ] **Step 5: Commit**

```bash
git add lib/schema.ts lib/types.ts
git commit -m "feat(spend): add raven_budget_caps + raven_spend_ledger schema"
```

---

## Task 2: The `lib/spend.ts` helper

**Files:**
- Create: `lib/spend.ts`
- Create: `lib/anthropic-pricing.ts`

The single source of truth for recording charges, querying month-to-date, and gating external calls.

- [ ] **Step 1: Create `lib/anthropic-pricing.ts` with the model price table**

```ts
// Anthropic API pricing per million tokens, in USD.
// Source: https://www.anthropic.com/pricing as of 2026-04-08.
// Update this table when prices change.

export interface ModelPricing {
  input_per_mtok: number;
  output_per_mtok: number;
  cached_input_per_mtok: number; // 90% discount when prompt caching is hit
}

export const ANTHROPIC_PRICING: Record<string, ModelPricing> = {
  'claude-haiku-4-5-20251001': {
    input_per_mtok: 1.00,
    output_per_mtok: 5.00,
    cached_input_per_mtok: 0.10,
  },
  'claude-sonnet-4-5': {
    input_per_mtok: 3.00,
    output_per_mtok: 15.00,
    cached_input_per_mtok: 0.30,
  },
  'claude-opus-4-6': {
    input_per_mtok: 15.00,
    output_per_mtok: 75.00,
    cached_input_per_mtok: 1.50,
  },
};

/** Compute USD cost for a Claude call given token counts. Returns 0 for unknown models. */
export function anthropicCost(
  model: string,
  input_tokens: number,
  output_tokens: number,
  cached_input_tokens = 0,
): number {
  const p = ANTHROPIC_PRICING[model];
  if (!p) return 0;
  const non_cached_input = Math.max(0, input_tokens - cached_input_tokens);
  return (
    (non_cached_input / 1_000_000) * p.input_per_mtok +
    (cached_input_tokens / 1_000_000) * p.cached_input_per_mtok +
    (output_tokens / 1_000_000) * p.output_per_mtok
  );
}
```

- [ ] **Step 2: Create `lib/spend.ts`**

```ts
import { randomUUID } from 'crypto';
import { query } from './db';
import { ensureSchema } from './schema';
import type { SpendService, MtdSpend, BudgetCap, SpendLedgerRow } from './types';

/**
 * Single source of truth for recording charges and gating external calls.
 *
 * Pattern:
 *   await assertCanSpend('elevenlabs');   // throws BudgetExceededError if paused or over hard kill
 *   const result = await callExternalApi();
 *   await record({ service: 'elevenlabs', amount_usd: 0.012, units: 150, unit_kind: 'chars' });
 *
 * Soft cap (over 100% of soft_cap_usd) is silent — callers check `isOverCap()`
 * and degrade gracefully. Hard pause is the kill switch — `assertCanSpend()`
 * throws and the caller MUST handle (typically by no-oping like lib/email.ts).
 */

export class BudgetExceededError extends Error {
  constructor(public service: SpendService, public reason: 'paused' | 'unknown') {
    super(`spend gate: ${service} (${reason})`);
    this.name = 'BudgetExceededError';
  }
}

interface RecordArgs {
  service: SpendService;
  amount_usd: number;
  units?: number;
  unit_kind?: string;
  details?: Record<string, unknown>;
  ref?: { table: string; id: string };
}

export async function record(args: RecordArgs): Promise<void> {
  await ensureSchema();
  try {
    await query(
      `INSERT INTO raven_spend_ledger
         (id, service, amount_usd, units, unit_kind, details, ref_table, ref_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        randomUUID(),
        args.service,
        args.amount_usd,
        args.units ?? null,
        args.unit_kind ?? null,
        args.details ? JSON.stringify(args.details) : null,
        args.ref?.table ?? null,
        args.ref?.id ?? null,
      ],
    );
  } catch (err) {
    // Recording must never throw to the caller — losing a few cents of
    // accounting is worse than losing the actual feature.
    console.error('spend.record failed:', err);
  }
}

export async function mtdSpend(): Promise<MtdSpend[]> {
  await ensureSchema();
  const rows = await query<{
    service: SpendService;
    soft_cap_usd: string;
    paused: boolean;
    mtd_usd: string;
  }>(
    `SELECT
       c.service,
       c.soft_cap_usd::text,
       c.paused,
       COALESCE((
         SELECT SUM(amount_usd)::text
         FROM raven_spend_ledger
         WHERE service = c.service
           AND occurred_at >= date_trunc('month', now())
       ), '0') AS mtd_usd
     FROM raven_budget_caps c
     ORDER BY c.service`,
  );

  return rows.map(r => ({
    service: r.service,
    soft_cap_usd: parseFloat(r.soft_cap_usd),
    mtd_usd: parseFloat(r.mtd_usd),
    paused: r.paused,
  }));
}

export async function assertCanSpend(service: SpendService): Promise<void> {
  await ensureSchema();
  const rows = await query<{ paused: boolean }>(
    `SELECT paused FROM raven_budget_caps WHERE service = $1`,
    [service],
  );
  if (rows.length === 0) return; // unknown service — let it through
  if (rows[0].paused) throw new BudgetExceededError(service, 'paused');
}

export async function isOverCap(service: SpendService): Promise<boolean> {
  await ensureSchema();
  const rows = await query<{ over: boolean }>(
    `SELECT (COALESCE(SUM(amount_usd), 0) >= c.soft_cap_usd) AS over
     FROM raven_budget_caps c
     LEFT JOIN raven_spend_ledger l
       ON l.service = c.service
       AND l.occurred_at >= date_trunc('month', now())
     WHERE c.service = $1
     GROUP BY c.soft_cap_usd`,
    [service],
  );
  return rows[0]?.over ?? false;
}

export async function listCaps(): Promise<BudgetCap[]> {
  await ensureSchema();
  const rows = await query<BudgetCap & { soft_cap_usd: string }>(
    `SELECT service, soft_cap_usd::text, paused, updated_at
     FROM raven_budget_caps
     ORDER BY service`,
  );
  return rows.map(r => ({ ...r, soft_cap_usd: parseFloat(r.soft_cap_usd) }));
}

export async function updateCap(
  service: SpendService,
  patch: Partial<Pick<BudgetCap, 'soft_cap_usd' | 'paused'>>,
): Promise<void> {
  await ensureSchema();
  const sets: string[] = [];
  const vals: unknown[] = [];
  if (typeof patch.soft_cap_usd === 'number') {
    sets.push(`soft_cap_usd = $${vals.length + 1}`);
    vals.push(patch.soft_cap_usd);
  }
  if (typeof patch.paused === 'boolean') {
    sets.push(`paused = $${vals.length + 1}`);
    vals.push(patch.paused);
  }
  if (sets.length === 0) return;
  sets.push(`updated_at = now()`);
  vals.push(service);
  await query(
    `UPDATE raven_budget_caps SET ${sets.join(', ')} WHERE service = $${vals.length}`,
    vals,
  );
}

export async function recentLedger(args: {
  service?: SpendService;
  limit?: number;
  from?: string; // ISO timestamp
}): Promise<SpendLedgerRow[]> {
  await ensureSchema();
  const where: string[] = [];
  const vals: unknown[] = [];
  if (args.service) {
    where.push(`service = $${vals.length + 1}`);
    vals.push(args.service);
  }
  if (args.from) {
    where.push(`occurred_at >= $${vals.length + 1}`);
    vals.push(args.from);
  }
  const limit = Math.min(args.limit ?? 100, 500);
  const rows = await query<SpendLedgerRow & { amount_usd: string }>(
    `SELECT id, service, amount_usd::text, units, unit_kind, details,
            occurred_at, ref_table, ref_id
     FROM raven_spend_ledger
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY occurred_at DESC
     LIMIT ${limit}`,
    vals,
  );
  return rows.map(r => ({ ...r, amount_usd: parseFloat(r.amount_usd) }));
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit 2>&1 | grep -v ".next/types"`
Expected: no output.

- [ ] **Step 4: Smoke test from a Node REPL**

```bash
node --experimental-vm-modules -e '
import("./lib/spend.ts").then(async (m) => {
  await m.record({ service: "elevenlabs", amount_usd: 0.012, units: 150, unit_kind: "chars", details: { test: true } });
  const mtd = await m.mtdSpend();
  console.log(mtd);
  await m.assertCanSpend("elevenlabs"); // should not throw
  console.log("over cap?", await m.isOverCap("elevenlabs"));
  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
'
```

Skip if the REPL approach fails — the API route in Task 3 will exercise the same code paths and we can verify there.

- [ ] **Step 5: Commit**

```bash
git add lib/spend.ts lib/anthropic-pricing.ts
git commit -m "feat(spend): add lib/spend.ts helper + anthropic price table"
```

---

## Task 3: API route — `/api/spend/mtd`

**Files:**
- Create: `app/api/spend/mtd/route.ts`

- [ ] **Step 1: Create the route**

```ts
import { NextResponse } from 'next/server';
import { mtdSpend } from '@/lib/spend';

// GET /api/spend/mtd — month-to-date totals for the budget tracker widget.
// Returns one row per service with current spend, soft cap, and pause flag.
export async function GET() {
  try {
    const data = await mtdSpend();
    return NextResponse.json(data);
  } catch (err) {
    console.error('GET /api/spend/mtd', err);
    return NextResponse.json({ error: 'spend query failed' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify it returns valid JSON**

Open the dev server, then:

```bash
curl -s http://localhost:3000/api/spend/mtd | head -50
```

Expected: a JSON array of 5 objects, each with `service`, `soft_cap_usd`, `mtd_usd`, `paused` fields. After Task 2's smoke test the elevenlabs row should show `mtd_usd: 0.012`.

- [ ] **Step 3: Commit**

```bash
git add app/api/spend/mtd/route.ts
git commit -m "feat(spend): GET /api/spend/mtd"
```

---

## Task 4: API routes — `/api/spend/caps` (GET + PATCH)

**Files:**
- Create: `app/api/spend/caps/route.ts`

- [ ] **Step 1: Create the route**

```ts
import { NextResponse } from 'next/server';
import { listCaps, updateCap } from '@/lib/spend';
import type { SpendService } from '@/lib/types';

const VALID_SERVICES: SpendService[] = ['elevenlabs', 'anthropic', 'twilio', 'websearch', 'railway'];

// GET /api/spend/caps — list all caps + pause flags
export async function GET() {
  try {
    return NextResponse.json(await listCaps());
  } catch (err) {
    console.error('GET /api/spend/caps', err);
    return NextResponse.json({ error: 'caps query failed' }, { status: 500 });
  }
}

// PATCH /api/spend/caps — update one service's cap or pause flag
// Body: { service: 'elevenlabs', soft_cap_usd?: number, paused?: boolean }
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { service, soft_cap_usd, paused } = body as {
      service?: string;
      soft_cap_usd?: number;
      paused?: boolean;
    };

    if (!service || !VALID_SERVICES.includes(service as SpendService)) {
      return NextResponse.json({ error: 'service must be one of: ' + VALID_SERVICES.join(', ') }, { status: 400 });
    }

    if (soft_cap_usd !== undefined) {
      if (typeof soft_cap_usd !== 'number' || soft_cap_usd < 0 || soft_cap_usd > 1000) {
        return NextResponse.json({ error: 'soft_cap_usd must be a number between 0 and 1000' }, { status: 400 });
      }
    }

    if (paused !== undefined && typeof paused !== 'boolean') {
      return NextResponse.json({ error: 'paused must be a boolean' }, { status: 400 });
    }

    await updateCap(service as SpendService, { soft_cap_usd, paused });
    return NextResponse.json(await listCaps());
  } catch (err) {
    console.error('PATCH /api/spend/caps', err);
    return NextResponse.json({ error: 'caps update failed' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify GET and PATCH work**

```bash
curl -s http://localhost:3000/api/spend/caps
# Expected: array of 5 caps

curl -s -X PATCH -H "content-type: application/json" \
  -d '{"service":"elevenlabs","soft_cap_usd":7.50}' \
  http://localhost:3000/api/spend/caps
# Expected: updated array; elevenlabs row now shows soft_cap_usd 7.5

curl -s -X PATCH -H "content-type: application/json" \
  -d '{"service":"twilio","paused":true}' \
  http://localhost:3000/api/spend/caps
# Expected: twilio paused = true
```

Then revert: `curl -s -X PATCH -d '{"service":"twilio","paused":false}' -H "content-type: application/json" http://localhost:3000/api/spend/caps`

- [ ] **Step 3: Commit**

```bash
git add app/api/spend/caps/route.ts
git commit -m "feat(spend): GET + PATCH /api/spend/caps"
```

---

## Task 5: API route — `/api/spend/ledger`

**Files:**
- Create: `app/api/spend/ledger/route.ts`

- [ ] **Step 1: Create the route**

```ts
import { NextResponse } from 'next/server';
import { recentLedger } from '@/lib/spend';
import type { SpendService } from '@/lib/types';

const VALID_SERVICES: SpendService[] = ['elevenlabs', 'anthropic', 'twilio', 'websearch', 'railway'];

// GET /api/spend/ledger?service=&from=&limit=
// Returns recent ledger rows. Supports optional service filter and date range.
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const service = url.searchParams.get('service');
    const from = url.searchParams.get('from');
    const limitStr = url.searchParams.get('limit');

    if (service && !VALID_SERVICES.includes(service as SpendService)) {
      return NextResponse.json({ error: 'invalid service' }, { status: 400 });
    }

    const limit = limitStr ? Math.max(1, Math.min(500, parseInt(limitStr, 10) || 100)) : 100;

    const rows = await recentLedger({
      service: (service as SpendService) || undefined,
      from: from || undefined,
      limit,
    });

    return NextResponse.json(rows);
  } catch (err) {
    console.error('GET /api/spend/ledger', err);
    return NextResponse.json({ error: 'ledger query failed' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify**

```bash
curl -s http://localhost:3000/api/spend/ledger
# Expected: array; should contain at least the elevenlabs row from the Task 2 smoke test

curl -s "http://localhost:3000/api/spend/ledger?service=elevenlabs&limit=5"
# Expected: filtered to elevenlabs only
```

- [ ] **Step 3: Commit**

```bash
git add app/api/spend/ledger/route.ts
git commit -m "feat(spend): GET /api/spend/ledger"
```

---

## Task 6: Railway usage spike + reconcile route

**Files:**
- Create: `lib/railway-usage.ts`
- Create: `app/api/spend/reconcile/route.ts`

The Railway integration is a spike — try the GraphQL API, gracefully degrade to manual entry if unavailable. The reconcile route is a thin wrapper that today is mostly a placeholder; it will grow once we have ElevenLabs / Railway reconciliation logic.

- [ ] **Step 1: Create the Railway spike helper**

```ts
// Railway provides a GraphQL API at https://backboard.railway.com/graphql/v2
// for project usage. This helper attempts to fetch this month's USD spend
// and returns null on any failure (auth missing, schema changed, network).
//
// Required env: RAILWAY_API_TOKEN (project-scoped or user-scoped)
//               RAILWAY_PROJECT_ID
//
// If this returns null, the budget tracker shows a "Set this month's bill"
// inline edit on the Railway row instead.

interface RailwayUsageResponse {
  data?: {
    project?: {
      usage?: { totalUsd?: number };
    };
  };
}

export async function fetchRailwayMtd(): Promise<number | null> {
  const token = process.env.RAILWAY_API_TOKEN;
  const projectId = process.env.RAILWAY_PROJECT_ID;
  if (!token || !projectId) return null;

  // Compute first-of-month + now in ISO
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const query = `
    query Usage($projectId: String!, $start: DateTime!, $end: DateTime!) {
      project(id: $projectId) {
        usage(measurements: [CPU_USAGE, MEMORY_USAGE, NETWORK_TX_GB], startDate: $start, endDate: $end) {
          totalUsd
        }
      }
    }
  `;

  try {
    const res = await fetch('https://backboard.railway.com/graphql/v2', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        query,
        variables: { projectId, start: startOfMonth, end: now.toISOString() },
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const json: RailwayUsageResponse = await res.json();
    const total = json.data?.project?.usage?.totalUsd;
    return typeof total === 'number' ? total : null;
  } catch (err) {
    console.error('fetchRailwayMtd failed:', err);
    return null;
  }
}
```

> **Note for the engineer:** the GraphQL schema above is a *guess* based on Railway's public docs. When you run the spike, expect a `400`/`200` with errors response on the first try. Adjust the field names from the actual error messages. If after 30 minutes of fiddling you can't get usage data out, flag it and ship with the manual-entry fallback (Task 8 has the UI for this).

- [ ] **Step 2: Create the reconcile route**

```ts
import { NextResponse } from 'next/server';
import { fetchRailwayMtd } from '@/lib/railway-usage';
import { record } from '@/lib/spend';

// POST /api/spend/reconcile — pulls authoritative usage from upstream APIs
// (Railway usage, ElevenLabs subscription) and inserts diff rows into the
// ledger. v1: Railway only. ElevenLabs reconciliation is a v1 follow-up
// once we have a real render history to diff against.
export async function POST() {
  try {
    const railway = await fetchRailwayMtd();
    let railwayInserted = 0;

    if (railway !== null && railway > 0) {
      // Naive: insert a single ledger row representing this month's total.
      // The widget will dedupe by displaying SUM, but on repeated reconciles
      // we'd double-count. v1 strategy: delete prior reconciliation rows for
      // the current month before inserting.
      const { query } = await import('@/lib/db');
      await query(
        `DELETE FROM raven_spend_ledger
         WHERE service = 'railway'
           AND ref_table = 'reconcile'
           AND occurred_at >= date_trunc('month', now())`,
      );
      await record({
        service: 'railway',
        amount_usd: railway,
        unit_kind: 'mtd_total',
        details: { source: 'railway-graphql' },
        ref: { table: 'reconcile', id: new Date().toISOString().slice(0, 7) },
      });
      railwayInserted = 1;
    }

    return NextResponse.json({
      ok: true,
      railway: railway === null ? 'unavailable (manual entry mode)' : railway,
      railway_rows_inserted: railwayInserted,
    });
  } catch (err) {
    console.error('POST /api/spend/reconcile', err);
    return NextResponse.json({ error: 'reconcile failed' }, { status: 500 });
  }
}
```

- [ ] **Step 3: Verify**

```bash
curl -s -X POST http://localhost:3000/api/spend/reconcile
# Expected (no Railway env vars): {"ok":true,"railway":"unavailable (manual entry mode)","railway_rows_inserted":0}
```

- [ ] **Step 4: Commit**

```bash
git add lib/railway-usage.ts app/api/spend/reconcile/route.ts
git commit -m "feat(spend): Railway usage spike + reconcile route"
```

---

## Task 7: The `CampaignSpendTracker` widget

**Files:**
- Create: `components/CampaignSpendTracker.tsx`

The main widget. Polls `/api/spend/mtd` every 60 seconds. Renders one meter row per service, a total row, and an action bar. The "Adjust caps" and "View ledger" buttons open modals (built in Task 8). The "Pause World AI" and "Pause SMS" buttons hit `PATCH /api/spend/caps` directly with `paused: true/false`.

- [ ] **Step 1: Create the component**

```tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import type { MtdSpend } from '@/lib/types';
import CampaignSpendCapsModal from './CampaignSpendCapsModal';
import CampaignSpendLedgerModal from './CampaignSpendLedgerModal';

const POLL_MS = 60_000;

const SERVICE_LABELS: Record<string, string> = {
  elevenlabs: 'ElevenLabs',
  anthropic:  'Anthropic',
  twilio:     'Twilio SMS',
  websearch:  'Web search',
  railway:    'Railway',
};

const SERVICE_ORDER = ['elevenlabs', 'anthropic', 'twilio', 'websearch', 'railway'];

function fmt(usd: number): string {
  if (usd === 0) return '$0';
  if (usd < 1) return `$${usd.toFixed(2)}`;
  return `$${usd.toFixed(2)}`;
}

function meterColor(mtd: number, cap: number): { fill: string; pct: number } {
  if (cap === 0) return { fill: '#3a2e22', pct: 0 };
  const pct = Math.min(100, (mtd / cap) * 100);
  if (pct < 80)  return { fill: '#4a7a5a', pct }; // green
  if (pct < 100) return { fill: '#c9a84c', pct }; // gold
  return { fill: '#7b1a1a', pct };               // red
}

export default function CampaignSpendTracker() {
  const [rows, setRows] = useState<MtdSpend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCapsModal, setShowCapsModal] = useState(false);
  const [showLedgerModal, setShowLedgerModal] = useState(false);

  const fetchMtd = useCallback(async () => {
    try {
      const res = await fetch('/api/spend/mtd', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: MtdSpend[] = await res.json();
      setRows(data);
      setError(null);
    } catch (err) {
      console.error('CampaignSpendTracker fetch:', err);
      setError('failed to load spend');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMtd();
    const t = setInterval(fetchMtd, POLL_MS);
    return () => clearInterval(t);
  }, [fetchMtd]);

  async function togglePause(service: string, paused: boolean) {
    await fetch('/api/spend/caps', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ service, paused }),
    });
    fetchMtd();
  }

  // Sort rows in canonical order
  const sortedRows = [...rows].sort(
    (a, b) => SERVICE_ORDER.indexOf(a.service) - SERVICE_ORDER.indexOf(b.service),
  );

  // Total = sum of mtd, total cap = sum of soft caps (excluding railway which is informational)
  const totalMtd = sortedRows.reduce((s, r) => s + r.mtd_usd, 0);
  const totalCap = sortedRows
    .filter(r => r.service !== 'railway')
    .reduce((s, r) => s + r.soft_cap_usd, 0);
  const totalColor = meterColor(totalMtd, totalCap);

  // Look up pause state for the kill switches
  const anthropicPaused = sortedRows.find(r => r.service === 'anthropic')?.paused ?? false;
  const twilioPaused    = sortedRows.find(r => r.service === 'twilio')?.paused ?? false;

  return (
    <div className="max-w-[1000px] mx-auto px-8 mt-12 mb-12">
      <div
        className="border border-[var(--color-border)] bg-[var(--color-surface)] p-6"
        style={{ borderRadius: 0 }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-serif text-[var(--color-gold)] text-lg">
            Raven Post — month-to-date spend
          </h3>
          {loading && <span className="text-xs text-[var(--color-text-muted)]">loading…</span>}
          {error && <span className="text-xs" style={{ color: '#c07a8a' }}>{error}</span>}
        </div>

        <div className="space-y-2">
          {sortedRows.map(r => {
            const label = SERVICE_LABELS[r.service] ?? r.service;
            const { fill, pct } = meterColor(r.mtd_usd, r.soft_cap_usd);
            const capLabel = r.soft_cap_usd === 0 ? '—' : `/ ${fmt(r.soft_cap_usd)}`;
            return (
              <div
                key={r.service}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '110px 1fr 110px',
                  gap: '12px',
                  alignItems: 'center',
                  fontSize: '0.85rem',
                }}
              >
                <span className="text-[var(--color-text)]">
                  {label}
                  {r.paused && <span className="ml-2 text-xs" style={{ color: '#c07a8a' }}>⏸</span>}
                </span>
                <div
                  style={{
                    background: '#2a1e18',
                    height: 8,
                    border: '1px solid var(--color-border)',
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ width: `${pct}%`, height: '100%', background: fill }} />
                </div>
                <span className="text-right tabular-nums" style={{ color: 'var(--color-gold)' }}>
                  {fmt(r.mtd_usd)} {capLabel}
                </span>
              </div>
            );
          })}
        </div>

        {/* Total row */}
        <div
          className="border-t border-[var(--color-border)] mt-4 pt-3"
          style={{
            display: 'grid',
            gridTemplateColumns: '110px 1fr 110px',
            gap: '12px',
            fontSize: '0.95rem',
            fontWeight: 700,
          }}
        >
          <span className="text-[var(--color-gold)] uppercase tracking-widest text-xs">
            Total MTD
          </span>
          <span />
          <span className="text-right tabular-nums" style={{ color: totalColor.fill }}>
            {fmt(totalMtd)} / {fmt(totalCap)}
          </span>
        </div>

        {/* Action bar */}
        <div className="mt-4 pt-3 border-t border-[var(--color-border)] flex flex-wrap gap-2">
          <button
            onClick={() => setShowCapsModal(true)}
            className="text-xs px-3 py-1.5 border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-gold)] hover:border-[var(--color-gold)] uppercase tracking-widest font-serif"
          >
            Adjust caps
          </button>
          <button
            onClick={() => setShowLedgerModal(true)}
            className="text-xs px-3 py-1.5 border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-gold)] hover:border-[var(--color-gold)] uppercase tracking-widest font-serif"
          >
            View ledger
          </button>
          <button
            onClick={() => togglePause('anthropic', !anthropicPaused)}
            className="text-xs px-3 py-1.5 border uppercase tracking-widest font-serif"
            style={{
              borderColor: anthropicPaused ? '#7ac28a' : '#7b2a2a',
              color: anthropicPaused ? '#7ac28a' : '#d8a8a8',
            }}
          >
            {anthropicPaused ? '▶ Resume World AI' : '⏸ Pause World AI'}
          </button>
          <button
            onClick={() => togglePause('twilio', !twilioPaused)}
            className="text-xs px-3 py-1.5 border uppercase tracking-widest font-serif"
            style={{
              borderColor: twilioPaused ? '#7ac28a' : '#7b2a2a',
              color: twilioPaused ? '#7ac28a' : '#d8a8a8',
            }}
          >
            {twilioPaused ? '▶ Resume SMS' : '⏸ Pause SMS push'}
          </button>
        </div>
      </div>

      {showCapsModal && (
        <CampaignSpendCapsModal
          onClose={() => { setShowCapsModal(false); fetchMtd(); }}
        />
      )}
      {showLedgerModal && (
        <CampaignSpendLedgerModal onClose={() => setShowLedgerModal(false)} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

`npx tsc --noEmit 2>&1 | grep -v ".next/types"` — expect "Cannot find module './CampaignSpendCapsModal'" — that's fine, those are built in Task 8.

- [ ] **Step 3: Commit**

```bash
git add components/CampaignSpendTracker.tsx
git commit -m "feat(spend): CampaignSpendTracker widget"
```

---

## Task 8: The two modals + wire into the campaign page

**Files:**
- Create: `components/CampaignSpendCapsModal.tsx`
- Create: `components/CampaignSpendLedgerModal.tsx`
- Modify: `components/CampaignPageClient.tsx`

- [ ] **Step 1: Create `CampaignSpendCapsModal.tsx`**

```tsx
'use client';

import { useState, useEffect } from 'react';
import type { BudgetCap, SpendService } from '@/lib/types';

const SERVICE_LABELS: Record<string, string> = {
  elevenlabs: 'ElevenLabs',
  anthropic:  'Anthropic',
  twilio:     'Twilio SMS',
  websearch:  'Web search',
  railway:    'Railway',
};

interface Props {
  onClose: () => void;
}

export default function CampaignSpendCapsModal({ onClose }: Props) {
  const [caps, setCaps] = useState<BudgetCap[]>([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch('/api/spend/caps')
      .then(r => r.json())
      .then((data: BudgetCap[]) => {
        setCaps(data);
        const d: Record<string, string> = {};
        data.forEach(c => { d[c.service] = c.soft_cap_usd.toFixed(2); });
        setDrafts(d);
      })
      .catch(err => console.error('caps fetch:', err))
      .finally(() => setLoading(false));
  }, []);

  async function saveCap(service: SpendService) {
    const value = parseFloat(drafts[service] ?? '0');
    if (!Number.isFinite(value) || value < 0 || value > 1000) return;
    const res = await fetch('/api/spend/caps', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ service, soft_cap_usd: value }),
    });
    if (res.ok) setCaps(await res.json());
  }

  async function togglePause(service: SpendService, paused: boolean) {
    const res = await fetch('/api/spend/caps', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ service, paused }),
    });
    if (res.ok) setCaps(await res.json());
  }

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
        className="bg-[var(--color-surface)] border border-[var(--color-border)] p-6 max-w-[520px] w-full"
        style={{ borderRadius: 0 }}
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-serif text-[var(--color-gold)] text-lg">Adjust soft caps</h3>
          <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-gold)] text-xl leading-none">×</button>
        </div>

        {loading && <p className="text-sm text-[var(--color-text-muted)]">loading…</p>}

        <div className="space-y-3">
          {caps.map(c => (
            <div key={c.service} className="flex items-center gap-3">
              <span className="text-sm text-[var(--color-text)] w-28">{SERVICE_LABELS[c.service] ?? c.service}</span>
              <span className="text-[var(--color-text-muted)]">$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                max="1000"
                value={drafts[c.service] ?? ''}
                onChange={e => setDrafts(prev => ({ ...prev, [c.service]: e.target.value }))}
                onBlur={() => saveCap(c.service)}
                className="w-24 bg-[var(--color-bg-card)] border border-[var(--color-border)] px-2 py-1 text-[var(--color-text)] text-sm"
              />
              <button
                onClick={() => togglePause(c.service, !c.paused)}
                className="text-xs px-2 py-1 border uppercase tracking-widest font-serif"
                style={{
                  borderColor: c.paused ? '#7ac28a' : '#7b2a2a',
                  color: c.paused ? '#7ac28a' : '#d8a8a8',
                }}
              >
                {c.paused ? '▶ resume' : '⏸ pause'}
              </button>
            </div>
          ))}
        </div>

        <p className="mt-4 text-xs text-[var(--color-text-muted)] italic">
          Soft cap = silent degrade when over 100%. Pause = hard kill switch — service is gated immediately.
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `CampaignSpendLedgerModal.tsx`**

```tsx
'use client';

import { useState, useEffect } from 'react';
import type { SpendLedgerRow, SpendService } from '@/lib/types';

const SERVICE_LABELS: Record<string, string> = {
  elevenlabs: 'ElevenLabs',
  anthropic:  'Anthropic',
  twilio:     'Twilio',
  websearch:  'Web search',
  railway:    'Railway',
};

interface Props {
  onClose: () => void;
}

export default function CampaignSpendLedgerModal({ onClose }: Props) {
  const [rows, setRows] = useState<SpendLedgerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<SpendService | 'all'>('all');

  useEffect(() => {
    const url = filter === 'all'
      ? '/api/spend/ledger?limit=100'
      : `/api/spend/ledger?service=${filter}&limit=100`;
    setLoading(true);
    fetch(url)
      .then(r => r.json())
      .then(setRows)
      .catch(err => console.error('ledger fetch:', err))
      .finally(() => setLoading(false));
  }, [filter]);

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
        className="bg-[var(--color-surface)] border border-[var(--color-border)] p-6 max-w-[820px] w-full"
        style={{ borderRadius: 0, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-serif text-[var(--color-gold)] text-lg">Spend ledger — most recent 100</h3>
          <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-gold)] text-xl leading-none">×</button>
        </div>

        <div className="flex gap-2 mb-3 flex-wrap">
          {(['all', 'elevenlabs', 'anthropic', 'twilio', 'websearch', 'railway'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="text-xs px-3 py-1 border font-serif uppercase tracking-widest"
              style={{
                borderColor: filter === f ? 'var(--color-gold)' : 'var(--color-border)',
                color: filter === f ? 'var(--color-gold)' : 'var(--color-text-muted)',
                background: filter === f ? 'rgba(201,168,76,0.08)' : 'transparent',
              }}
            >
              {f === 'all' ? 'All' : SERVICE_LABELS[f]}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading && <p className="text-sm text-[var(--color-text-muted)]">loading…</p>}
          {!loading && rows.length === 0 && (
            <p className="text-sm text-[var(--color-text-muted)] italic">no entries yet</p>
          )}
          <table style={{ width: '100%', fontSize: '0.78rem', borderCollapse: 'collapse' }}>
            <thead>
              <tr className="text-[var(--color-text-muted)] uppercase tracking-widest text-xs">
                <th style={{ textAlign: 'left', padding: '6px 8px' }}>When</th>
                <th style={{ textAlign: 'left', padding: '6px 8px' }}>Service</th>
                <th style={{ textAlign: 'right', padding: '6px 8px' }}>USD</th>
                <th style={{ textAlign: 'right', padding: '6px 8px' }}>Units</th>
                <th style={{ textAlign: 'left', padding: '6px 8px' }}>Kind</th>
                <th style={{ textAlign: 'left', padding: '6px 8px' }}>Ref</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-t border-[var(--color-border)] text-[var(--color-text)]">
                  <td style={{ padding: '6px 8px' }}>{new Date(r.occurred_at).toLocaleString()}</td>
                  <td style={{ padding: '6px 8px' }}>{SERVICE_LABELS[r.service] ?? r.service}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right' }} className="tabular-nums">${r.amount_usd.toFixed(4)}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right' }} className="tabular-nums">{r.units ?? '—'}</td>
                  <td style={{ padding: '6px 8px' }}>{r.unit_kind ?? '—'}</td>
                  <td style={{ padding: '6px 8px' }}>{r.ref_table ? `${r.ref_table}/${r.ref_id ?? ''}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Modify `components/CampaignPageClient.tsx` — remove Background textarea, render `<CampaignSpendTracker />`**

Find the existing Background block (around lines 133–143) and **delete it entirely**:

```tsx
<div>
  <label className="block text-sm text-[var(--color-text-muted)] mb-1.5">Background</label>
  <textarea
    rows={8}
    value={background}
    onChange={e => setBackground(e.target.value)}
    onBlur={handleBackgroundBlur}
    placeholder="The campaign backstory…"
    className="w-full bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded px-3 py-2 text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]/40 focus:outline-none focus:border-[var(--color-gold)] font-serif text-[0.95rem] leading-relaxed resize-y"
  />
</div>
```

Also delete the now-unused state and handler (around lines 32 and 70):

```tsx
const [background, setBackground] = useState(initial.background ?? '');
function handleBackgroundBlur() { if (background !== (initial.background ?? '')) save({ background }); }
```

**Note:** the DB column stays — we're just removing the field from the UI. The backstory is now expected to live in the journal.

Add the import at the top of the file (after the existing `HomeArtDropCircle` import):

```tsx
import CampaignSpendTracker from './CampaignSpendTracker';
```

Then find the closing `</div>` of the outer container (around line 261, the one matching the `max-w-[1000px]` div from line 111). **After** that closing `</div>`, but **before** the final `</div>` and `);`, the structure looks like:

```tsx
        ...left/right campaign columns...
      </div>
    </div>
  );
}
```

Change it to render the spend tracker as a sibling outside the columns container:

```tsx
        ...left/right campaign columns...
      </div>
      <CampaignSpendTracker />
    </div>
  );
}
```

This puts the tracker at the bottom of the page, page-width (it has its own `max-w-[1000px] mx-auto` wrapper inside the component).

- [ ] **Step 4: Type-check + build**

```bash
npx tsc --noEmit 2>&1 | grep -v ".next/types"
# Expected: clean

npm run build
# Expected: build succeeds
```

If you see "background is declared but never used" — make sure you removed both the `useState` line and the `handleBackgroundBlur` function. The `background` field on the `Campaign` type can stay; it's just not bound to UI anymore.

- [ ] **Step 5: Manual eyeball verification**

1. Restart the dev server (DDL was loaded in Task 1's restart, but if you skipped that, do it now: `npx next dev -p 3000`).
2. Open `http://localhost:3000/dm/campaign`.
3. **Verify:** the Background textarea is gone from the left column.
4. **Verify:** at the bottom of the page, the Raven Post spend tracker widget appears, page-width.
5. **Verify:** all 5 service rows show ($0 if you skipped the Task 2 smoke test, $0.012 on the elevenlabs row otherwise).
6. **Verify:** clicking "Adjust caps" opens a modal listing all 5 services with editable cap inputs and pause buttons.
7. **Verify:** clicking "View ledger" opens a modal with filter buttons for each service and a table.
8. **Verify:** clicking "⏸ Pause World AI" turns the button green and changes the label to "▶ Resume World AI"; same for SMS.

- [ ] **Step 6: Commit**

```bash
git add components/CampaignSpendCapsModal.tsx components/CampaignSpendLedgerModal.tsx components/CampaignPageClient.tsx
git commit -m "feat(spend): caps + ledger modals; wire into /dm/campaign; remove Background textarea"
```

---

## Task 9: Final smoke pass

- [ ] **Step 1: Type-check + build + lint clean**

```bash
npx tsc --noEmit 2>&1 | grep -v ".next/types"
npm run build
npm run lint
```

All three must produce no errors. (Lint warnings about unused vars are fixable inline.)

- [ ] **Step 2: Insert a few realistic test ledger rows so the meters are non-zero in production**

```bash
curl -s -X POST -H "content-type: application/json" \
  -d '{"service":"elevenlabs","soft_cap_usd":5.00}' \
  http://localhost:3000/api/spend/caps

# Manually insert a few rows via psql for the screenshot:
psql "$DATABASE_URL" <<'SQL'
INSERT INTO raven_spend_ledger (id, service, amount_usd, units, unit_kind)
VALUES
  (gen_random_uuid()::text, 'elevenlabs', 0.45, 60, 'chars'),
  (gen_random_uuid()::text, 'anthropic', 0.18, 8000, 'input_tok'),
  (gen_random_uuid()::text, 'twilio',    0.024, 3, 'sms');
SQL
```

Refresh `/dm/campaign` — the meters should show non-zero values and the colors should still be green.

- [ ] **Step 3: Final commit + push**

```bash
git status
# Expected: clean working tree (or only the splash PNGs)

# Don't push — ask the user first per their feedback_push_to_gh memory
```

- [ ] **Step 4: Notify the user that the budget tracker is built and ready for review**

Summarize what was built, what URL to look at, and offer to push.

---

## v1 follow-ups (in scope but listed for the engineer)

These are referenced by the Core spec; landing them after the budget tracker is in:

1. **Wire `lib/spend.assertCanSpend()` into `lib/elevenlabs.ts`** — when the Core plan creates that file, the very first thing it must do (before any HTTP call) is `await assertCanSpend('elevenlabs')` and catch `BudgetExceededError` to silently no-op.
2. **Same for `lib/twilio.ts`** with `assertCanSpend('twilio')`.
3. **Same for the inventory `/api/items/suggest` route** if it's still calling Anthropic — wrap it with `assertCanSpend('anthropic')` + `record(...)` after parsing the response. (The existing route at `app/api/items/suggest/route.ts` does this without the gate today; adding it is a 5-line change.)
4. **Railway cron job** for nightly reconciliation: target endpoint `POST /api/spend/reconcile`. Wire later when Railway Cron is set up — for now, manual trigger works fine.

---

## Self-review

**Spec coverage:**
- ✅ `raven_budget_caps` and `raven_spend_ledger` tables → Task 1
- ✅ `lib/spend.ts` with `record / mtdSpend / assertCanSpend / isOverCap` → Task 2
- ✅ `BudgetExceededError` → Task 2
- ✅ `/api/spend/mtd` → Task 3
- ✅ `/api/spend/caps` GET + PATCH → Task 4
- ✅ `/api/spend/ledger` → Task 5
- ✅ `/api/spend/reconcile` + Railway spike → Task 6
- ✅ `CampaignSpendTracker.tsx` widget with meters, total, action bar, kill switches → Task 7
- ✅ `CampaignSpendCapsModal.tsx` and `CampaignSpendLedgerModal.tsx` → Task 8
- ✅ Background textarea removal from `/dm/campaign` → Task 8 Step 3
- ✅ Page-width placement at bottom of `/dm/campaign` → Task 8 Step 3
- ✅ Soft-cap colors (green/gold/red) → Task 7
- ✅ Hard kill switches → Task 7 + Task 8 (modal also has per-service pause)
- ✅ Polls every 60s → Task 7
- ✅ No CSV export, no historical charts (v2)
- ✅ Schema gotcha (restart dev server) → Task 1 Step 3 + reminder in Task 8 Step 5

**Placeholder scan:** No "TODO", "TBD", or "implement later" outside the explicit Railway spike note where the engineer is told exactly what to do.

**Type consistency:** `MtdSpend`, `BudgetCap`, `SpendLedgerRow`, `SpendService`, `BudgetExceededError` are defined in Task 1/2 and used consistently in Tasks 3–8.

Plan ready.
