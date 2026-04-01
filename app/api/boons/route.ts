import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';

// GET /api/boons — templates + active player boons
export async function GET(req: NextRequest) {
  try {
    await ensureSchema();
    const playerId = req.nextUrl.searchParams.get('player_id');

    const templates = await query('SELECT * FROM boon_templates ORDER BY category, name');

    let active: unknown[] = [];
    if (playerId) {
      active = await query(
        'SELECT * FROM player_boons WHERE player_id = $1 AND active = true ORDER BY started_at DESC',
        [playerId]
      );
    } else {
      active = await query('SELECT * FROM player_boons WHERE active = true ORDER BY started_at DESC');
    }

    return NextResponse.json({ templates, active });
  } catch (err) {
    console.error('GET /api/boons', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

// POST /api/boons — grant a boon template to a player
export async function POST(req: NextRequest) {
  try {
    await ensureSchema();
    const { template_id, player_id, expiry_type = 'permanent', expiry_minutes = 0 } = await req.json();

    if (!template_id || !player_id) {
      return NextResponse.json({ error: 'template_id and player_id required' }, { status: 400 });
    }

    // Fetch template
    const [template] = await query('SELECT * FROM boon_templates WHERE id = $1', [template_id]);
    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    const t = template as Record<string, unknown>;
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

    await query(
      `INSERT INTO player_boons (id, player_id, template_id, name, category, description, effect, action_type, range, components, duration_text, grants_advantage, expiry_type, expiry_minutes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
      [id, player_id, template_id, t.name, t.category, t.description, t.effect, t.action_type, t.range, t.components, t.duration, t.grants_advantage, expiry_type, expiry_minutes]
    );

    return NextResponse.json({ ok: true, id });
  } catch (err) {
    console.error('POST /api/boons', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

// PATCH /api/boons — cancel a boon or mark as seen
export async function PATCH(req: NextRequest) {
  try {
    await ensureSchema();
    const { id, action, player_id } = await req.json();

    if (action === 'cancel' && id) {
      await query('UPDATE player_boons SET active = false WHERE id = $1', [id]);
    } else if (action === 'seen' && player_id) {
      await query('UPDATE player_boons SET seen = true WHERE player_id = $1 AND active = true AND seen = false', [player_id]);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('PATCH /api/boons', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
