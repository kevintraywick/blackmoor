import { NextResponse } from 'next/server';
import { addItem } from '@/lib/roadmap';

export async function POST(req: Request) {
  try {
    const { ladder, version, text } = await req.json();
    if (!ladder || !version || !text) {
      return NextResponse.json({ error: 'ladder, version, and text required' }, { status: 400 });
    }
    if (ladder !== 'shadow' && ladder !== 'common') {
      return NextResponse.json({ error: 'ladder must be shadow or common' }, { status: 400 });
    }
    const item = await addItem(ladder, version, text.trim());
    return NextResponse.json({ ok: true, item });
  } catch (err) {
    console.error('POST /api/roadmap/add', err);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
