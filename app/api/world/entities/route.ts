import { NextResponse } from 'next/server';
import { ensureSchema } from '@/lib/schema';
import { listEntities, createEntity, type WorldEntityKind } from '@/lib/world';

const VALID_KINDS: WorldEntityKind[] = ['storm', 'horde', 'caravan', 'army', 'other_party'];

// GET /api/world/entities — list all entities currently on the world map
export async function GET() {
  try {
    await ensureSchema();
    const entities = await listEntities();
    return NextResponse.json(entities);
  } catch (err) {
    console.error('GET /api/world/entities', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

// POST /api/world/entities
// Body: { kind, label?, q, r, waypoints?, secondsPerStep? }
export async function POST(req: Request) {
  try {
    await ensureSchema();
    const body = await req.json();
    const { kind, label, q, r, waypoints, secondsPerStep } = body;

    if (!VALID_KINDS.includes(kind)) {
      return NextResponse.json({ error: `kind must be one of ${VALID_KINDS.join(', ')}` }, { status: 400 });
    }
    if (typeof q !== 'number' || typeof r !== 'number') {
      return NextResponse.json({ error: 'q and r must be numbers' }, { status: 400 });
    }
    if (label != null && typeof label !== 'string') {
      return NextResponse.json({ error: 'label must be a string' }, { status: 400 });
    }
    if (waypoints != null && !Array.isArray(waypoints)) {
      return NextResponse.json({ error: 'waypoints must be an array' }, { status: 400 });
    }
    if (secondsPerStep != null && (typeof secondsPerStep !== 'number' || secondsPerStep <= 0)) {
      return NextResponse.json({ error: 'secondsPerStep must be > 0' }, { status: 400 });
    }

    const ent = await createEntity({ kind, label, q, r, waypoints, secondsPerStep });
    return NextResponse.json(ent);
  } catch (err) {
    console.error('POST /api/world/entities', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
