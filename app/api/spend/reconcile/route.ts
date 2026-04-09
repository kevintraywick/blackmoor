import { NextResponse } from 'next/server';
import { fetchRailwayMtd } from '@/lib/railway-usage';
import { query } from '@/lib/db';
import { record } from '@/lib/spend';

// POST /api/spend/reconcile — pulls Railway usage and inserts/replaces the MTD row.
export async function POST() {
  try {
    const railway = await fetchRailwayMtd();
    let railwayInserted = 0;

    if (railway !== null && railway > 0) {
      // Delete prior reconciliation rows for the current month to avoid double-count
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
