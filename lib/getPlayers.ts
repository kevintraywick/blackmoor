import { query } from './db';
import type { Player } from './types';

type PlayerRow = { id: string; player_name: string; character: string; initial: string; img: string };

export async function getPlayerById(id: string): Promise<Player | null> {
  const rows = await query<PlayerRow>(
    'SELECT id, player_name, character, initial, img FROM players WHERE id = $1',
    [id]
  );
  if (rows.length === 0) return null;
  const r = rows[0];
  return { id: r.id, playerName: r.player_name, character: r.character, initial: r.initial, img: r.img };
}

export async function getPlayers(): Promise<Player[]> {
  const rows = await query<PlayerRow>(
    `SELECT p.id, p.player_name, p.character, p.initial, p.img
     FROM players p
     LEFT JOIN player_sheets ps ON ps.id = p.id
     WHERE COALESCE(ps.status, 'active') = 'active'
     ORDER BY p.sort_order ASC`
  );
  return rows.map(r => ({
    id: r.id,
    playerName: r.player_name,
    character: r.character,
    initial: r.initial,
    img: r.img,
  }));
}
