import { NextResponse } from 'next/server';
import { ensureSchema } from '@/lib/schema';
import { listHexes, setHexReveal, setHexTerrainNote } from '@/lib/world';

// GET /api/world/hexes — list all hexes that have state (sparse)
export async function GET() {
  try {
    await ensureSchema();
    const hexes = await listHexes();
    return NextResponse.json(hexes);
  } catch (err) {
    console.error('GET /api/world/hexes', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

// POST /api/world/hexes — upsert reveal state and/or terrain note for a hex.
// Body: { q: number, r: number, reveal_state?: 'unrevealed' | 'revealed', terrain_note?: string }
export async function POST(req: Request) {
  try {
    await ensureSchema();
    const body = await req.json();
    const { q, r, reveal_state, terrain_note } = body;

    if (typeof q !== 'number' || typeof r !== 'number') {
      return NextResponse.json({ error: 'q and r must be numbers' }, { status: 400 });
    }

    if (reveal_state !== undefined) {
      if (reveal_state !== 'unrevealed' && reveal_state !== 'revealed') {
        return NextResponse.json(
          { error: "reveal_state must be 'unrevealed' or 'revealed'" },
          { status: 400 }
        );
      }
      const hex = await setHexReveal(q, r, reveal_state);
      return NextResponse.json(hex);
    }

    if (terrain_note !== undefined) {
      if (typeof terrain_note !== 'string') {
        return NextResponse.json({ error: 'terrain_note must be a string' }, { status: 400 });
      }
      const hex = await setHexTerrainNote(q, r, terrain_note);
      return NextResponse.json(hex);
    }

    return NextResponse.json(
      { error: 'Must provide reveal_state or terrain_note' },
      { status: 400 }
    );
  } catch (err) {
    console.error('POST /api/world/hexes', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
