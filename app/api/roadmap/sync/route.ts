import { NextResponse } from 'next/server';
import { syncMarkdownFile } from '@/lib/roadmap';

export async function POST() {
  try {
    await syncMarkdownFile();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('POST /api/roadmap/sync', err);
    return NextResponse.json({ error: 'sync failed' }, { status: 500 });
  }
}
