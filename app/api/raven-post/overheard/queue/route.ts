import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import { LIBRARY_LOCATION } from '@/lib/raven-post';
import type { RavenOverheardQueueRow, RavenTrust } from '@/lib/types';

const VALID_TRUST: RavenTrust[] = ['official', 'whispered', 'rumored', 'prophesied'];

// GET /api/raven-post/overheard/queue
// Returns the FIFO queue + each row's delivery list
export async function GET() {
  try {
    await ensureSchema();
    const rows = await query<{
      id: string;
      location: string;
      body: string;
      trust: RavenTrust;
      position: number;
      created_at: string;
      delivered_to: string[] | null;
    }>(
      `SELECT q.id, q.location, q.body, q.trust, q.position, q.created_at,
              COALESCE(array_agg(d.player_id) FILTER (WHERE d.player_id IS NOT NULL), '{}') AS delivered_to
       FROM raven_overheard_queue q
       LEFT JOIN raven_overheard_deliveries d ON d.queue_id = q.id
       WHERE q.location = $1
       GROUP BY q.id
       ORDER BY q.position ASC, q.created_at ASC`,
      [LIBRARY_LOCATION],
    );

    const result: RavenOverheardQueueRow[] = rows.map(r => ({
      id: r.id,
      location: r.location,
      body: r.body,
      trust: r.trust,
      position: r.position,
      created_at: r.created_at,
      delivered_to: r.delivered_to ?? [],
    }));
    return NextResponse.json(result);
  } catch (err) {
    console.error('GET overheard queue', err);
    return NextResponse.json({ error: 'queue query failed' }, { status: 500 });
  }
}

// POST /api/raven-post/overheard/queue
// Body: { body: string, trust?: RavenTrust }
// Appends to the end of the library queue.
export async function POST(req: Request) {
  try {
    await ensureSchema();
    const body = await req.json();
    const { body: text, trust } = body as { body?: string; trust?: string };
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json({ error: 'body is required' }, { status: 400 });
    }
    if (text.length > 280) {
      return NextResponse.json({ error: 'body must be under 280 chars (SMS-safe)' }, { status: 400 });
    }
    if (trust !== undefined && !VALID_TRUST.includes(trust as RavenTrust)) {
      return NextResponse.json({ error: 'invalid trust' }, { status: 400 });
    }

    const maxPos = await query<{ max: number | null }>(
      `SELECT MAX(position) AS max FROM raven_overheard_queue WHERE location = $1`,
      [LIBRARY_LOCATION],
    );
    const nextPos = (maxPos[0]?.max ?? 0) + 1;

    const rows = await query(
      `INSERT INTO raven_overheard_queue (id, location, body, trust, position)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [randomUUID(), LIBRARY_LOCATION, text.trim(), trust ?? 'rumored', nextPos],
    );
    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) {
    console.error('POST overheard queue', err);
    return NextResponse.json({ error: 'queue insert failed' }, { status: 500 });
  }
}
