import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import type { WorldAiProposal } from '@/lib/types';

export async function GET() {
  try {
    await ensureSchema();
    const rows = await query<WorldAiProposal>(
      `SELECT * FROM raven_world_ai_proposals
       WHERE status = 'pending'
       ORDER BY confidence DESC
       LIMIT 50`,
    );
    return NextResponse.json(rows);
  } catch (err) {
    console.error('GET world-ai/proposals', err);
    return NextResponse.json({ error: 'proposals query failed' }, { status: 500 });
  }
}
