import { NextResponse } from 'next/server';
import { addItem } from '@/lib/roadmap';

export async function POST(req: Request) {
  try {
    const { version, text } = await req.json();
    if (!version || !text) {
      return NextResponse.json({ error: 'version and text required' }, { status: 400 });
    }
    const item = await addItem(version, text.trim());
    return NextResponse.json({ ok: true, item });
  } catch (err) {
    console.error('POST /api/roadmap/add', err);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
