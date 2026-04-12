import { NextResponse } from 'next/server';
import { ensureSchema } from '@/lib/schema';
import { setHexTerrain } from '@/lib/world';

export async function POST(req: Request) {
  try {
    await ensureSchema();
    const { q, r, terrain_type, rotation } = await req.json();

    if (typeof q !== 'number' || typeof r !== 'number') {
      return NextResponse.json({ error: 'q and r must be numbers' }, { status: 400 });
    }

    const rot = typeof rotation === 'number' ? Math.max(0, Math.min(5, Math.round(rotation))) : 0;
    const hex = await setHexTerrain(q, r, terrain_type ?? null, rot);
    return NextResponse.json(hex);
  } catch (err) {
    console.error('POST /api/world/terrain', err);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
