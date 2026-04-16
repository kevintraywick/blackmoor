import { NextResponse } from 'next/server';
import { draftBeat } from '@/lib/raven-draft';
import type { RavenMedium } from '@/lib/types';

const VALID_MEDIA: RavenMedium[] = ['broadsheet', 'raven', 'sending', 'overheard', 'ad'];

// POST /api/raven-post/draft
// Body: { medium: RavenMedium, oneLineBeat: string }
// Returns: { headline: string | null, body: string }
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { medium, oneLineBeat, targetWords } = body as {
      medium?: string;
      oneLineBeat?: string;
      targetWords?: number;
    };

    if (!medium || !VALID_MEDIA.includes(medium as RavenMedium)) {
      return NextResponse.json({ error: 'invalid medium' }, { status: 400 });
    }
    if (!oneLineBeat || typeof oneLineBeat !== 'string' || oneLineBeat.trim().length < 3) {
      return NextResponse.json({ error: 'oneLineBeat required (min 3 chars)' }, { status: 400 });
    }

    const result = await draftBeat({
      medium: medium as RavenMedium,
      oneLineBeat,
      targetWords: typeof targetWords === 'number' && targetWords > 0 ? targetWords : undefined,
    });
    if (!result) {
      return NextResponse.json({ error: 'AI draft unavailable' }, { status: 503 });
    }
    return NextResponse.json(result);
  } catch (err) {
    console.error('POST /api/raven-post/draft', err);
    return NextResponse.json({ error: 'draft failed' }, { status: 500 });
  }
}
