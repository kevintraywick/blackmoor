export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getIssueDraft, saveIssueDraft, type IssueDraftPatch } from '@/lib/raven-issue-draft';

export async function GET() {
  try {
    const draft = await getIssueDraft();
    return NextResponse.json(draft);
  } catch (err) {
    console.error('[issue-draft] GET failed', err);
    return NextResponse.json({ error: 'failed to load draft' }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }

  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: 'body must be an object' }, { status: 400 });
  }

  // Coerce unknown values to strings where the schema demands; allow null
  // for the nullable `ad_product_id` column.
  const patch = body as IssueDraftPatch;

  try {
    const draft = await saveIssueDraft(patch);
    return NextResponse.json(draft);
  } catch (err) {
    console.error('[issue-draft] PUT failed', err);
    return NextResponse.json({ error: 'failed to save draft' }, { status: 500 });
  }
}
