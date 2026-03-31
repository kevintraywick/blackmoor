import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { character } = await req.json();
    if (typeof character !== 'string' || !character.trim()) {
      return NextResponse.json({ error: 'Invalid name' }, { status: 400 });
    }
    await query('UPDATE players SET character = $1 WHERE id = $2', [character.trim(), id]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('PATCH /api/players/[id]/name', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
