import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import type { WorldAiTick } from '@/lib/types';

export async function GET() {
  try {
    await ensureSchema();
    const rows = await query<WorldAiTick>(
      `SELECT * FROM raven_world_ai_ticks
       ORDER BY ticked_at DESC
       LIMIT 20`,
    );
    return NextResponse.json(rows);
  } catch (err) {
    console.error('GET world-ai/ticks', err);
    return NextResponse.json({ error: 'ticks query failed' }, { status: 500 });
  }
}
