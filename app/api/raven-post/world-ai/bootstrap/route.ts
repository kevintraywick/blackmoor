import { NextResponse } from 'next/server';
import { bootstrapCorpus } from '@/lib/embeddings';

// POST /api/raven-post/world-ai/bootstrap
// One-time (or on-demand) full-corpus embedding. Call after first deploy
// or whenever the DM wants to re-index everything.
export async function POST() {
  try {
    await bootstrapCorpus();
    return NextResponse.json({ ok: true, message: 'corpus bootstrap complete' });
  } catch (err) {
    console.error('POST world-ai/bootstrap', err);
    return NextResponse.json({ error: 'bootstrap failed' }, { status: 500 });
  }
}
