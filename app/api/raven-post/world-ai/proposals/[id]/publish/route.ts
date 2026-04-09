import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import { publishItem } from '@/lib/raven-post';
import type { WorldAiProposal, RavenMedium, RavenTrust } from '@/lib/types';

interface Props {
  params: Promise<{ id: string }>;
}

export async function POST(_req: Request, { params }: Props) {
  try {
    await ensureSchema();
    const { id } = await params;

    // Read the proposal
    const proposals = await query<WorldAiProposal>(
      `SELECT * FROM raven_world_ai_proposals WHERE id = $1 AND status = 'pending'`,
      [id],
    );
    if (proposals.length === 0) {
      return NextResponse.json({ error: 'proposal not found or already published' }, { status: 404 });
    }
    const proposal = proposals[0];

    // Publish the item through the existing publishItem orchestrator
    const item = await publishItem({
      medium: proposal.medium as RavenMedium,
      body: proposal.body,
      headline: proposal.headline,
      trust: 'official' as RavenTrust,
      tags: proposal.tags,
    });

    // Tag the raven_items row with source = 'world_ai'
    await query(
      `UPDATE raven_items SET source = 'world_ai' WHERE id = $1`,
      [item.id],
    );

    // Flip the proposal status
    await query(
      `UPDATE raven_world_ai_proposals
       SET status = 'published', published_item_id = $1
       WHERE id = $2`,
      [item.id, id],
    );

    return NextResponse.json({ proposal_id: id, item_id: item.id, ok: true });
  } catch (err) {
    console.error('POST world-ai/proposals/[id]/publish', err);
    return NextResponse.json({ error: 'publish failed' }, { status: 500 });
  }
}
