import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import type { WorldAiState } from '@/lib/types';

export async function GET() {
  try {
    await ensureSchema();
    const rows = await query<WorldAiState>(
      `SELECT * FROM raven_world_ai_state WHERE campaign_id = 'default'`,
    );
    return NextResponse.json(rows[0] ?? null);
  } catch (err) {
    console.error('GET world-ai/state', err);
    return NextResponse.json({ error: 'state query failed' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    await ensureSchema();
    const body = await req.json();
    const sets: string[] = [];
    const vals: unknown[] = [];

    if (typeof body.paused === 'boolean') {
      sets.push(`paused = $${vals.length + 1}`);
      vals.push(body.paused);
    }
    if (typeof body.active_window_start === 'string') {
      sets.push(`active_window_start = $${vals.length + 1}`);
      vals.push(body.active_window_start);
    }
    if (typeof body.active_window_end === 'string') {
      sets.push(`active_window_end = $${vals.length + 1}`);
      vals.push(body.active_window_end);
    }
    for (const field of ['daily_cap_ticks', 'daily_cap_drafts', 'daily_cap_websearch'] as const) {
      if (typeof body[field] === 'number' && body[field] >= 0 && body[field] <= 100) {
        sets.push(`${field} = $${vals.length + 1}`);
        vals.push(Math.floor(body[field]));
      }
    }

    if (sets.length === 0) {
      return NextResponse.json({ error: 'no valid fields to update' }, { status: 400 });
    }
    sets.push(`updated_at = now()`);
    vals.push('default');
    await query(
      `UPDATE raven_world_ai_state SET ${sets.join(', ')} WHERE campaign_id = $${vals.length}`,
      vals,
    );
    const rows = await query<WorldAiState>(
      `SELECT * FROM raven_world_ai_state WHERE campaign_id = 'default'`,
    );
    return NextResponse.json(rows[0]);
  } catch (err) {
    console.error('PATCH world-ai/state', err);
    return NextResponse.json({ error: 'state update failed' }, { status: 500 });
  }
}
