// Shared TypeScript types used across the app

export interface Player {
  id: string;
  playerName: string;
  character: string;
  initial: string;
  img: string;
}

export interface WeaponItem {
  id: string;
  name: string;
  attack_bonus: string;
  damage: string;
}

export interface SpellItem {
  id: string;
  name: string;
  effect: string;
  action_type: string;
  range: string;
  components: string;
  duration: string;
}

export interface MarketplaceItem {
  id: string;                    // unique instance ID
  source_item_id: number;        // FK back to items table
  name: string;
  price: number;                 // purchase price (for resale/refund)
  image_path: string | null;
  stat_type: string | null;
  stat_value: number | null;
  purchased_at: string;          // ISO timestamp
}

// A player character sheet row in the DB
export interface PlayerSheet {
  id: string;              // e.g. 'levi'
  discord: string;
  species: string;
  class: string;
  level: string;
  hp: string;
  xp: string;
  speed: string;
  size: string;
  ac: string;
  gold: string;
  boons: string;
  class_features: string;
  species_traits: string;  // kept for DB compat, unused in UI
  player_notes: string;    // "Species Notes" in UI
  general_notes: string;   // "Background" in UI
  gear: WeaponItem[];      // "Weapons" in UI — stored as JSONB
  spells: SpellItem[];     // "Magic Spells or Items" — stored as JSONB
  items: MarketplaceItem[]; // Purchased marketplace items — stored as JSONB, transferable
  dm_notes: string;        // DM-only notes (not shown to player)
  status: string;          // 'active' | 'away' | 'removed'
}

export interface MenagerieEntry {
  npc_id: string;
  hp: number;
  maxHp?: number;
  label?: string;
}

export interface Session {
  id: string;
  number: number;
  title: string;
  date: string;
  goal: string;
  scenes: string;
  npcs: string;
  locations: string;
  loose_ends: string;
  notes: string;
  npc_ids: string[];
  menagerie: MenagerieEntry[];
  sort_order: number;
  last_modified: number;
}

export type GridType = 'square' | 'hex';
export type HexOrientation = 'flat' | 'pointy';

export interface DmNote {
  col: number;
  row: number;
  text: string;
}

export interface MapRow {
  id: string;
  session_id: string;
  name: string;
  image_path: string;
  grid_type: GridType;
  cols: number;
  rows: number;
  offset_x: number;
  offset_y: number;
  tile_px: number;
  hex_orientation: HexOrientation;
  revealed_tiles: [number, number][];
  dm_notes: DmNote[];
  sort_order: number;
  created_at: number;
}

// Player version — dm_notes omitted (never sent to client)
export type PlayerMapRow = Omit<MapRow, 'dm_notes'>;

export interface Npc {
  id: string;
  name: string;
  species: string;
  cr: string;
  hp: string;
  hp_roll: string;
  ac: string;
  speed: string;
  attacks: string;
  traits: string;
  actions: string;
  notes: string;
  image_path: string | null;
}
