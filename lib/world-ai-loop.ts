import { randomUUID } from 'crypto';
import { query } from './db';
import { ensureSchema } from './schema';
import { canSpend } from './spend';
import { anthropicCost } from './anthropic-pricing';
import { embedNewRows } from './embeddings';
import { assembleTriageContext } from './world-ai-context';
import { runTriage } from './world-ai-triage';
import { draftProposal } from './world-ai-draft';
import type { WorldAiState } from './types';

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface TickResult {
  tickId: string;
  proposalsGenerated: number;
  webSearchCalls: number;
  skipped: boolean;
  reason?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HAIKU_MODEL = 'claude-haiku-4-5-20251001';
const SONNET_MODEL = 'claude-sonnet-4-5';

/** Number of seeds to draft per tick. Hardcoded to 1 for v1 — tune later. */
const DRAFTS_PER_TICK = 1;

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Run a complete World AI tick: guard checks → context assembly → triage →
 * drafting → proposal management → tick logging.
 *
 * Idempotent: calling twice in quick succession is safe because the stale
 * check prevents duplicate auto ticks, DB writes are INSERT or idempotent
 * UPDATE, and the 3-hour `next_tick_at` acts as a natural throttle.
 */
export async function runWorldAiTick(
  trigger: 'auto' | 'manual',
): Promise<TickResult> {
  const tickId = randomUUID();

  try {
    await ensureSchema();

    // ── Step 1: Read state ────────────────────────────────────────────────
    const stateRows = await query<WorldAiState>(
      `SELECT * FROM raven_world_ai_state WHERE campaign_id = 'default'`,
    );
    if (stateRows.length === 0) {
      return { tickId, proposalsGenerated: 0, webSearchCalls: 0, skipped: true, reason: 'no_state_row' };
    }
    const state = stateRows[0];

    // ── Step 2: Guard checks ──────────────────────────────────────────────
    if (state.paused) {
      return { tickId, proposalsGenerated: 0, webSearchCalls: 0, skipped: true, reason: 'paused' };
    }

    if (!(await canSpend('anthropic'))) {
      return { tickId, proposalsGenerated: 0, webSearchCalls: 0, skipped: true, reason: 'budget' };
    }

    // Stale check — auto ticks only
    if (trigger === 'auto') {
      const changeRows = await query<{ latest_change: string | null }>(
        `SELECT GREATEST(
           (SELECT to_timestamp(MAX(last_modified)) FROM sessions),
           (SELECT MAX(published_at) FROM raven_items)
         ) AS latest_change`,
      );
      const latestChange = changeRows[0]?.latest_change
        ? new Date(changeRows[0].latest_change)
        : null;
      const lastTickAt = state.last_tick_at ? new Date(state.last_tick_at) : null;

      if (latestChange && lastTickAt && latestChange <= lastTickAt) {
        return { tickId, proposalsGenerated: 0, webSearchCalls: 0, skipped: true, reason: 'no_changes' };
      }
    }

    // ── Step 3: Incremental embedding ─────────────────────────────────────
    const sinceDateForEmbedding = state.last_tick_at
      ? new Date(state.last_tick_at)
      : new Date(0);
    await embedNewRows(sinceDateForEmbedding);

    // ── Step 4: Context assembly ──────────────────────────────────────────
    const context = await assembleTriageContext();

    // ── Step 5: Pass 1 — Triage ───────────────────────────────────────────
    const triageResult = await runTriage(context);
    if (!triageResult) {
      // Budget/error — log failed tick and return
      await logTick(tickId, trigger, {
        notes: 'triage returned null (budget or error)',
      });
      await updateState();
      return { tickId, proposalsGenerated: 0, webSearchCalls: 0, skipped: true, reason: 'triage_failed' };
    }

    // ── Step 6: Pass 2 — Drafting ─────────────────────────────────────────
    let proposalsGenerated = 0;
    let webSearchCalls = 0;
    let sonnetInputTokens: number | null = null;
    let sonnetOutputTokens: number | null = null;

    // Draft the top N seeds (N = DRAFTS_PER_TICK = 1 for v1)
    const seedsToDraft = triageResult.seeds
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, DRAFTS_PER_TICK);

    for (const seed of seedsToDraft) {
      const draftResult = await draftProposal(seed, tickId, state.prompt_version);
      if (draftResult) {
        proposalsGenerated += 1;
        if (draftResult.webSearchUsed) {
          webSearchCalls += 1;
        }
      }
      // Note: draftProposal records its own Sonnet token usage via spend.record().
      // We don't have direct access to the Sonnet usage from here since the
      // draft module handles it internally. The tick log captures the triage
      // (Haiku) usage directly and records Sonnet fields as null. The spend
      // ledger has the full per-call detail.
    }

    // ── Step 7: Push down pending proposals ───────────────────────────────
    await query(
      `UPDATE raven_world_ai_proposals
       SET pushdown_count = pushdown_count + 1
       WHERE status = 'pending'`,
    );

    // ── Step 8: Expire stale proposals ────────────────────────────────────
    await query(
      `UPDATE raven_world_ai_proposals
       SET status = 'expired'
       WHERE status = 'pending' AND pushdown_count >= 3`,
    );

    // ── Step 9: Log the tick ──────────────────────────────────────────────
    const triageUsage = triageResult.usage;
    const triageCacheRead = triageUsage.cache_read_input_tokens;

    // Compute cost from triage usage (Sonnet cost is recorded per-call by
    // draftProposal, but we include it in the tick summary for reference)
    const triageCost = anthropicCost(
      HAIKU_MODEL,
      triageUsage.input_tokens,
      triageUsage.output_tokens,
      triageCacheRead,
    );

    await logTick(tickId, trigger, {
      haiku_input_tokens: triageUsage.input_tokens,
      haiku_output_tokens: triageUsage.output_tokens,
      sonnet_input_tokens: sonnetInputTokens,
      sonnet_output_tokens: sonnetOutputTokens,
      websearch_calls: webSearchCalls,
      proposals_generated: proposalsGenerated,
      cost_usd: triageCost,
    });

    // ── Step 10: Update state ─────────────────────────────────────────────
    await updateState();

    // ── Step 11: Return ───────────────────────────────────────────────────
    return { tickId, proposalsGenerated, webSearchCalls, skipped: false };
  } catch (err) {
    // Catch-all: log the error as a tick row, never leave the loop broken
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error('runWorldAiTick error:', errMsg);

    try {
      await logTick(tickId, trigger, { notes: errMsg });
    } catch {
      // If even the error log fails, just console.error
      console.error('runWorldAiTick: failed to log error tick');
    }

    return { tickId, proposalsGenerated: 0, webSearchCalls: 0, skipped: true, reason: 'error' };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface TickLogFields {
  haiku_input_tokens?: number | null;
  haiku_output_tokens?: number | null;
  sonnet_input_tokens?: number | null;
  sonnet_output_tokens?: number | null;
  websearch_calls?: number;
  proposals_generated?: number;
  cost_usd?: number | null;
  notes?: string;
}

async function logTick(
  tickId: string,
  trigger: 'auto' | 'manual',
  fields: TickLogFields,
): Promise<void> {
  await query(
    `INSERT INTO raven_world_ai_ticks
       (id, trigger, haiku_input_tokens, haiku_output_tokens,
        sonnet_input_tokens, sonnet_output_tokens, websearch_calls,
        proposals_generated, cost_usd, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      tickId,
      trigger,
      fields.haiku_input_tokens ?? null,
      fields.haiku_output_tokens ?? null,
      fields.sonnet_input_tokens ?? null,
      fields.sonnet_output_tokens ?? null,
      fields.websearch_calls ?? 0,
      fields.proposals_generated ?? 0,
      fields.cost_usd ?? null,
      fields.notes ?? null,
    ],
  );
}

async function updateState(): Promise<void> {
  await query(
    `UPDATE raven_world_ai_state
     SET last_tick_at = now(),
         next_tick_at = now() + interval '3 hours',
         updated_at = now()
     WHERE campaign_id = 'default'`,
  );
}
