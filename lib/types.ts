// Shared TypeScript types used across the app

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
  species_traits: string;  // kept for DB compat, unused in UI
  player_notes: string;    // "Species Notes" in UI
  general_notes: string;   // "Background" in UI
  gear: WeaponItem[];      // "Weapons" in UI — stored as JSONB
  spells: SpellItem[];     // "Magic Spells or Items" — stored as JSONB
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
