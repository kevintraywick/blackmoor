// Shared TypeScript types used across the app

// One gear item in a player's inventory
export interface GearItem {
  id: string;
  name: string;
  type: 'potion' | 'scroll' | 'gear' | 'weapon';
  qty: number;
  value: number;
  spellLevel: number | null;
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
  boons: string;
  class_features: string;
  species_traits: string;
  player_notes: string;
  general_notes: string;
  gear: GearItem[];        // stored as JSONB in postgres
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
  sort_order: number;
  last_modified: number;
}
