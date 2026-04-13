import { NextResponse } from 'next/server';
import { toggleItem } from '@/lib/roadmap';

export async function POST(req: Request) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
    const newStatus = await toggleItem(id);
    return NextResponse.json({ ok: true, status: newStatus });
  } catch (err) {
    console.error('POST /api/roadmap/toggle', err);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
