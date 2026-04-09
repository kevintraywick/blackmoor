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
