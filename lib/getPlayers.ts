import { query } from './db';
import type { Player } from './types';

type PlayerRow = { id: string; player_name: string; character: string; initial: string; img: string };

export async function getPlayers(): Promise<Player[]> {
  const rows = await query<PlayerRow>(
    'SELECT id, player_name, character, initial, img FROM players ORDER BY sort_order ASC'
  );
  return rows.map(r => ({
    id: r.id,
    playerName: r.player_name,
    character: r.character,
    initial: r.initial,
    img: r.img,
  }));
}
