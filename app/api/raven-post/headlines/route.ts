import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import type { RavenHeadlinesPayload } from '@/lib/types';

// GET /api/raven-post/headlines?playerId=X
// Returns the top 3 broadsheet headlines + the player's last_read_at
// + the newsie mp3 url. Used by NewsieCallout to decide whether to play.
export async function GET(req: Request) {
  try {
    await ensureSchema();
    const url = new URL(req.url);
    const playerId = url.searchParams.get('playerId');
    if (!playerId) {
      return NextResponse.json({ error: 'playerId required' }, { status: 400 });
    }

    const headlines = await query<{
      id: string;
      headline: string;
      published_at: string;
      newsie_mp3: string | null;
    }>(
      `SELECT id, headline, published_at, newsie_mp3
       FROM raven_items
       WHERE medium = 'broadsheet' AND headline IS NOT NULL
       ORDER BY published_at DESC
       LIMIT 3`,
    );

    const lastRead = await query<{ read_at: string | null }>(
      `SELECT MAX(r.read_at)::text AS read_at
       FROM raven_reads r
       JOIN raven_items i ON i.id = r.item_id
       WHERE r.player_id = $1 AND i.medium = 'broadsheet'`,
      [playerId],
    );

    const payload: RavenHeadlinesPayload = {
      headlines: headlines.map(h => ({
        id: h.id,
        headline: h.headline,
        published_at: h.published_at,
      })),
      newsie_mp3_url: headlines[0]?.newsie_mp3 ?? null,
      last_read_at: lastRead[0]?.read_at ?? null,
      newest_published_at: headlines[0]?.published_at ?? null,
    };

    return NextResponse.json(payload);
  } catch (err) {
    console.error('GET /api/raven-post/headlines', err);
    return NextResponse.json({ error: 'headlines query failed' }, { status: 500 });
  }
}
