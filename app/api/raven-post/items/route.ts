import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import { publishItem } from '@/lib/raven-post';
import type { RavenItem, RavenMedium, RavenTrust } from '@/lib/types';

const VALID_MEDIA: RavenMedium[] = ['broadsheet', 'raven', 'sending', 'overheard', 'ad'];
const VALID_TRUST: RavenTrust[] = ['official', 'whispered', 'rumored', 'prophesied'];

// GET /api/raven-post/items?playerId=X
// Returns published items. Personal items (raven, sending) filter to the
// requested player; broadsheet/ad/overheard items are universal.
export async function GET(req: Request) {
  try {
    await ensureSchema();
    const url = new URL(req.url);
    const playerId = url.searchParams.get('playerId');

    let rows: RavenItem[];
    if (playerId) {
      rows = await query<RavenItem>(
        `SELECT * FROM raven_items
         WHERE medium IN ('broadsheet', 'ad', 'overheard')
            OR (medium IN ('raven', 'sending') AND target_player = $1)
         ORDER BY published_at DESC
         LIMIT 200`,
        [playerId],
      );
    } else {
      rows = await query<RavenItem>(
        `SELECT * FROM raven_items
         WHERE medium IN ('broadsheet', 'ad', 'overheard')
         ORDER BY published_at DESC
         LIMIT 200`,
      );
    }
    return NextResponse.json(rows);
  } catch (err) {
    console.error('GET /api/raven-post/items', err);
    return NextResponse.json({ error: 'fetch failed' }, { status: 500 });
  }
}

// POST /api/raven-post/items — publish a new item (DM)
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { medium, body: text, headline, sender, target_player, trust, tags,
            ad_image_url, ad_real_link, ad_real_copy } = body as Record<string, unknown>;

    if (typeof medium !== 'string' || !VALID_MEDIA.includes(medium as RavenMedium)) {
      return NextResponse.json({ error: 'medium must be: ' + VALID_MEDIA.join(', ') }, { status: 400 });
    }
    if (typeof text !== 'string' || text.trim().length === 0) {
      return NextResponse.json({ error: 'body is required' }, { status: 400 });
    }
    if (text.length > 2000) {
      return NextResponse.json({ error: 'body must be under 2000 chars' }, { status: 400 });
    }
    if (medium === 'sending') {
      const words = text.trim().split(/\s+/);
      if (words.length > 25) {
        return NextResponse.json({ error: 'sendings must be 25 words or fewer' }, { status: 400 });
      }
    }
    if (medium === 'broadsheet' && (!headline || typeof headline !== 'string')) {
      return NextResponse.json({ error: 'broadsheet items require a headline' }, { status: 400 });
    }
    if ((medium === 'raven' || medium === 'sending') && (!target_player || typeof target_player !== 'string')) {
      return NextResponse.json({ error: 'raven and sending require target_player' }, { status: 400 });
    }
    if (trust !== undefined && !VALID_TRUST.includes(trust as RavenTrust)) {
      return NextResponse.json({ error: 'invalid trust tier' }, { status: 400 });
    }

    const tagsArray: string[] = Array.isArray(tags)
      ? tags.filter((t): t is string => typeof t === 'string').slice(0, 30)
      : [];

    const item = await publishItem({
      medium: medium as RavenMedium,
      body: text.trim(),
      headline: typeof headline === 'string' ? headline.trim() : null,
      sender: typeof sender === 'string' ? sender.trim() : null,
      target_player:
        typeof target_player === 'string' && target_player.trim().length > 0
          ? target_player.trim()
          : null,
      trust: (trust as RavenTrust) ?? 'official',
      tags: tagsArray,
      ad_image_url: typeof ad_image_url === 'string' ? ad_image_url : null,
      ad_real_link: typeof ad_real_link === 'string' ? ad_real_link : null,
      ad_real_copy: typeof ad_real_copy === 'string' ? ad_real_copy : null,
    });

    return NextResponse.json(item, { status: 201 });
  } catch (err) {
    console.error('POST /api/raven-post/items', err);
    return NextResponse.json({ error: 'publish failed' }, { status: 500 });
  }
}
