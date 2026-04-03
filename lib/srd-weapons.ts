// D&D 5e SRD weapon data
// Source: Systems Reference Document 5.1 (Open Game License)

export type WeaponCategory = 'simple' | 'martial';
export type WeaponAbility = 'str' | 'dex' | 'finesse';

export interface SrdWeapon {
  price: string;
  damage: string;
  ability: WeaponAbility; // str = melee, dex = ranged, finesse = higher of str/dex
  category: WeaponCategory;
}

const WEAPONS: Record<string, SrdWeapon> = {
  // Simple Melee
  'club':           { price: '1sp',  damage: '1d4',  ability: 'str',     category: 'simple' },
  'dagger':         { price: '2',    damage: '1d4',  ability: 'finesse', category: 'simple' },
  'greatclub':      { price: '2sp',  damage: '1d8',  ability: 'str',     category: 'simple' },
  'handaxe':        { price: '5',    damage: '1d6',  ability: 'str',     category: 'simple' },
  'javelin':        { price: '5sp',  damage: '1d6',  ability: 'str',     category: 'simple' },
  'light hammer':   { price: '2',    damage: '1d4',  ability: 'str',     category: 'simple' },
  'mace':           { price: '5',    damage: '1d6',  ability: 'str',     category: 'simple' },
  'quarterstaff':   { price: '2sp',  damage: '1d6',  ability: 'str',     category: 'simple' },
  'sickle':         { price: '1',    damage: '1d4',  ability: 'str',     category: 'simple' },
  'spear':          { price: '1',    damage: '1d6',  ability: 'str',     category: 'simple' },

  // Simple Ranged
  'light crossbow': { price: '25',   damage: '1d8',  ability: 'dex',     category: 'simple' },
  'dart':           { price: '5cp',  damage: '1d4',  ability: 'finesse', category: 'simple' },
  'shortbow':       { price: '25',   damage: '1d6',  ability: 'dex',     category: 'simple' },
  'sling':          { price: '1sp',  damage: '1d4',  ability: 'dex',     category: 'simple' },

  // Martial Melee
  'battleaxe':      { price: '10',   damage: '1d8',  ability: 'str',     category: 'martial' },
  'flail':          { price: '10',   damage: '1d8',  ability: 'str',     category: 'martial' },
  'glaive':         { price: '20',   damage: '1d10', ability: 'str',     category: 'martial' },
  'greataxe':       { price: '30',   damage: '1d12', ability: 'str',     category: 'martial' },
  'greatsword':     { price: '50',   damage: '2d6',  ability: 'str',     category: 'martial' },
  'halberd':        { price: '20',   damage: '1d10', ability: 'str',     category: 'martial' },
  'lance':          { price: '10',   damage: '1d12', ability: 'str',     category: 'martial' },
  'longsword':      { price: '15',   damage: '1d8',  ability: 'str',     category: 'martial' },
  'maul':           { price: '10',   damage: '2d6',  ability: 'str',     category: 'martial' },
  'morningstar':    { price: '15',   damage: '1d8',  ability: 'str',     category: 'martial' },
  'pike':           { price: '5',    damage: '1d10', ability: 'str',     category: 'martial' },
  'rapier':         { price: '25',   damage: '1d8',  ability: 'finesse', category: 'martial' },
  'scimitar':       { price: '25',   damage: '1d6',  ability: 'finesse', category: 'martial' },
  'shortsword':     { price: '10',   damage: '1d6',  ability: 'finesse', category: 'martial' },
  'trident':        { price: '5',    damage: '1d6',  ability: 'str',     category: 'martial' },
  'war pick':       { price: '5',    damage: '1d8',  ability: 'str',     category: 'martial' },
  'warhammer':      { price: '15',   damage: '1d8',  ability: 'str',     category: 'martial' },
  'whip':           { price: '2',    damage: '1d4',  ability: 'finesse', category: 'martial' },

  // Martial Ranged
  'blowgun':        { price: '10',   damage: '1',    ability: 'dex',     category: 'martial' },
  'hand crossbow':  { price: '75',   damage: '1d6',  ability: 'dex',     category: 'martial' },
  'heavy crossbow': { price: '50',   damage: '1d10', ability: 'dex',     category: 'martial' },
  'longbow':        { price: '50',   damage: '1d8',  ability: 'dex',     category: 'martial' },
  'net':            { price: '1',    damage: '0',    ability: 'dex',     category: 'martial' },
};

// Common aliases
const ALIASES: Record<string, string> = {
  'great sword': 'greatsword', 'long sword': 'longsword', 'short sword': 'shortsword',
  'short bow': 'shortbow', 'long bow': 'longbow', 'war hammer': 'warhammer',
  'morning star': 'morningstar', 'hand axe': 'handaxe', 'great axe': 'greataxe',
  'battle axe': 'battleaxe', 'great club': 'greatclub',
};

export function lookupWeapon(name: string): SrdWeapon | null {
  const key = name.toLowerCase().trim();
  return WEAPONS[key] ?? WEAPONS[ALIASES[key]] ?? null;
}

export function lookupWeaponPrice(name: string): string | null {
  return lookupWeapon(name)?.price ?? null;
}

// ── D&D 5e calculations ──────────────────────────────────────────────────────

export function abilityMod(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function proficiencyBonus(level: number): number {
  if (level < 5) return 2;
  if (level < 9) return 3;
  if (level < 13) return 4;
  if (level < 17) return 5;
  return 6;
}

function formatMod(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

// ── Class weapon proficiencies ───────────────────────────────────────────────
// All classes are proficient with simple weapons.
// This table only tracks martial proficiency: 'all' or a list of specific weapons.

const MARTIAL_PROFICIENCY: Record<string, 'all' | string[]> = {
  barbarian: 'all',
  fighter:   'all',
  paladin:   'all',
  ranger:    'all',
  bard:      ['longsword', 'rapier', 'shortsword', 'hand crossbow'],
  cleric:    [],
  druid:     [],
  monk:      ['shortsword'],
  rogue:     ['hand crossbow', 'longsword', 'rapier', 'shortsword'],
  sorcerer:  [],
  warlock:   [],
  wizard:    [],
};

export function isProficient(className: string, weaponName: string): boolean {
  const weapon = lookupWeapon(weaponName);
  if (!weapon) return false;
  if (weapon.category === 'simple') return true;

  const key = className.toLowerCase().trim();
  const prof = MARTIAL_PROFICIENCY[key];
  if (!prof) return true; // unknown class — assume proficient
  if (prof === 'all') return true;
  return prof.includes(weaponName.toLowerCase().trim());
}

// ── Auto-fill a weapon's To Hit and Damage ───────────────────────────────────

export function autoFillWeapon(
  weaponName: string,
  scores: { str: string; dex: string },
  level: string,
  className: string,
): { toHit: string; damage: string; price: string } | null {
  const weapon = lookupWeapon(weaponName);
  if (!weapon) return null;

  const strMod = abilityMod(parseInt(scores.str) || 10);
  const dexMod = abilityMod(parseInt(scores.dex) || 10);

  let mod: number;
  if (weapon.ability === 'finesse') mod = Math.max(strMod, dexMod);
  else if (weapon.ability === 'dex') mod = dexMod;
  else mod = strMod;

  const prof = isProficient(className, weaponName) ? proficiencyBonus(parseInt(level) || 1) : 0;
  const toHit = formatMod(mod + prof);

  let damage: string;
  if (weapon.damage === '0' || weapon.damage === '1') {
    damage = weapon.damage;
  } else {
    damage = mod === 0 ? weapon.damage : `${weapon.damage}${formatMod(mod)}`;
  }

  return { toHit, damage, price: weapon.price };
}
