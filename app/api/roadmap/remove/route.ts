import { NextResponse } from 'next/server';
import { removeItem } from '@/lib/roadmap';

export async function POST(req: Request) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const removed = await removeItem(id);
    if (!removed) return NextResponse.json({ error: 'item not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('POST /api/roadmap/remove', err);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
