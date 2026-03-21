// Shared TypeScript types used across the app

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
