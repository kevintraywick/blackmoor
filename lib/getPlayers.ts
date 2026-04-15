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

export async function getPlayers(opts: { publicOnly?: boolean } = {}): Promise<Player[]> {
  // 'test' status flags crash-test-dummy players (e.g. Ajax). They are full
  // players for DM/admin/internal purposes — they get sent items, can be in
  // initiative, can buy from the marketplace — so the default INCLUDES them.
  // Pass `publicOnly: true` from player-facing rosters (splash, /players,
  // can-you-play, World AI fiction) where canon party only is appropriate.
  const statuses = opts.publicOnly ? ['active'] : ['active', 'test'];
  const rows = await query<PlayerRow>(
    `SELECT p.id, p.player_name, p.character, p.initial, p.img
     FROM players p
     LEFT JOIN player_sheets ps ON ps.id = p.id
     WHERE COALESCE(ps.status, 'active') = ANY($1)
     ORDER BY p.sort_order ASC`,
    [statuses],
  );
  return rows.map(r => ({
    id: r.id,
    playerName: r.player_name,
    character: r.character,
    initial: r.initial,
    img: r.img,
  }));
}
