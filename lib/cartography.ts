/**
 * Common World cartography — canonical list of named places.
 *
 * Source of truth for code. `docs/cartography.md` mirrors this file for
 * human reading/editing. Keep them in sync by hand for now; once the list
 * grows, this will migrate to a DB table and the MD will be generated.
 */

export type TerrainKind =
  | 'forest'
  | 'plains'
  | 'mountain'
  | 'hills'
  | 'coast'
  | 'marsh'
  | 'river'
  | 'ocean'
  | 'urban'
  | 'cliff'
  | 'other';

export type InFictionKind =
  | 'city'
  | 'town'
  | 'village'
  | 'port'
  | 'fortress'
  | 'dungeon'
  | 'mine'
  | 'ruin'
  | 'shrine'
  | 'camp'
  | 'wilderness'
  | 'landmark'
  | 'other';

export type LocationStatus = 'active' | 'named' | 'visited' | 'past';

export interface Location {
  id: string;
  name: string;
  lat: number;
  lng: number;
  realWorld: string;
  campaigns: string[];
  kinds: InFictionKind[];
  terrain: TerrainKind[];
  polity?: string;
  status: LocationStatus;
  notes?: string;
}

export const CARTOGRAPHY: Location[] = [
  {
    id: 'blaen-hafren',
    name: 'Blaen Hafren',
    lat: 52.4833,
    lng: -3.7333,
    realWorld: 'source of the River Severn, Plynlimon, Wales',
    campaigns: ['shadow'],
    kinds: ['dungeon', 'mine', 'wilderness'],
    terrain: ['forest', 'cliff', 'mountain', 'river'],
    status: 'active',
    notes: 'Dungeon, forested wilderness, clifftop, pirate mine. Shadow party is here now. Canonical world origin.',
  },
  {
    id: 'machynlleth',
    name: 'Machynlleth',
    lat: 52.5903,
    lng: -3.8510,
    realWorld: 'market town in Powys, Wales — ~14 km NW of Blaen Hafren',
    campaigns: ['shadow'],
    kinds: ['village'],
    terrain: ['hills', 'river'],
    status: 'named',
    notes: 'Nearest settlement to the Blaen Hafren dungeon. Small village in fiction.',
  },
  {
    id: 'aberystwyth',
    name: 'Aberystwyth',
    lat: 52.4153,
    lng: -4.0829,
    realWorld: 'port on the Welsh coast — ~30 km WNW of Blaen Hafren',
    campaigns: ['shadow'],
    kinds: ['city', 'port'],
    terrain: ['coast', 'urban'],
    status: 'named',
    notes: 'Large port city. Major trade hub, sea access.',
  },
];
