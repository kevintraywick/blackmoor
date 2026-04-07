import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';

// GET /api/map-builder/assets — list all assets (built-in + custom)
export async function GET() {
  try {
    await ensureSchema();
    const rows = await query(
      'SELECT * FROM map_build_assets ORDER BY is_builtin DESC, name ASC'
    );
    return NextResponse.json(rows);
  } catch (err) {
    console.error('GET /api/map-builder/assets', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

// POST /api/map-builder/assets — create a custom asset
export async function POST(req: Request) {
  try {
    await ensureSchema();
    const body = await req.json();
    const { name, category = 'custom' } = body;

    if (typeof name !== 'string' || !name.trim() || name.length > 200) {
      return NextResponse.json({ error: 'Invalid name' }, { status: 400 });
    }

    const VALID_CATEGORIES = ['wall', 'door', 'stairs', 'water', 'custom'];
    if (!VALID_CATEGORIES.includes(category)) {
      return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
    }

    const id = crypto.randomUUID();
    await query(
      `INSERT INTO map_build_assets (id, name, category, is_builtin)
       VALUES ($1, $2, $3, false)`,
      [id, name.trim(), category]
    );

    const [asset] = await query('SELECT * FROM map_build_assets WHERE id = $1', [id]);
    return NextResponse.json(asset);
  } catch (err) {
    console.error('POST /api/map-builder/assets', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
