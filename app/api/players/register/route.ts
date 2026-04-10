import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';

export async function POST(req: Request) {
  try {
    await ensureSchema();
    const { playerName, character } = await req.json();

    if (typeof playerName !== 'string' || playerName.trim().length === 0) {
      return NextResponse.json({ error: 'Player name is required' }, { status: 400 });
    }
    if (typeof character !== 'string' || character.trim().length === 0) {
      return NextResponse.json({ error: 'Character name is required' }, { status: 400 });
    }
    if (playerName.trim().length > 50 || character.trim().length > 50) {
      return NextResponse.json({ error: 'Names must be under 50 characters' }, { status: 400 });
    }

    const name = playerName.trim();
    const char = character.trim();
    const initial = char.charAt(0).toUpperCase();

    // Generate ID from player name (lowercase, first word, deduplicated)
    const baseId = name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20) || 'player';
    let id = baseId;
    let suffix = 2;
    while (true) {
      const existing = await query<{ id: string }>(
        'SELECT id FROM players WHERE id = $1',
        [id],
      );
      if (existing.length === 0) break;
      id = `${baseId}${suffix}`;
      suffix++;
    }

    // Get next sort_order
    const [{ max_sort }] = await query<{ max_sort: number | null }>(
      'SELECT MAX(sort_order) as max_sort FROM players',
    );
    const sortOrder = (max_sort ?? 0) + 1;

    // Create player row
    await query(
      `INSERT INTO players (id, player_name, character, initial, img, sort_order)
       VALUES ($1, $2, $3, $4, '', $5)`,
      [id, name, char, initial, sortOrder],
    );

    // Create empty player sheet
    await query(
      `INSERT INTO player_sheets (id, discord, species, class, level, hp, xp, speed, size, ac,
         boons, class_features, species_traits, player_notes, general_notes, gear, spells)
       VALUES ($1, '', '', '', '1', '10', '0', '30', 'Medium', '10',
         '', '', '', '', '', '[]', '[]')
       ON CONFLICT (id) DO NOTHING`,
      [id],
    );

    return NextResponse.json({ id, playerName: name, character: char, initial }, { status: 201 });
  } catch (err) {
    console.error('POST /api/players/register', err);
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 });
  }
}
