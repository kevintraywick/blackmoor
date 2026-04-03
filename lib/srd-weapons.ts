// D&D 5e SRD weapon prices
// Source: Systems Reference Document 5.1 (Open Game License)

const WEAPON_PRICES: Record<string, string> = {
  // Simple Melee Weapons
  'club':           '1sp',
  'dagger':         '2',
  'greatclub':      '2sp',
  'handaxe':        '5',
  'javelin':        '5sp',
  'light hammer':   '2',
  'mace':           '5',
  'quarterstaff':   '2sp',
  'sickle':         '1',
  'spear':          '1',

  // Simple Ranged Weapons
  'light crossbow': '25',
  'dart':           '5cp',
  'shortbow':       '25',
  'sling':          '1sp',

  // Martial Melee Weapons
  'battleaxe':      '10',
  'flail':          '10',
  'glaive':         '20',
  'greataxe':       '30',
  'greatsword':     '50',
  'halberd':        '20',
  'lance':          '10',
  'longsword':      '15',
  'maul':           '10',
  'morningstar':    '15',
  'pike':           '5',
  'rapier':         '25',
  'scimitar':       '25',
  'shortsword':     '10',
  'trident':        '5',
  'war pick':       '5',
  'warhammer':      '15',
  'whip':           '2',

  // Martial Ranged Weapons
  'blowgun':        '10',
  'hand crossbow':  '75',
  'heavy crossbow': '50',
  'longbow':        '50',
  'net':            '1',

  // Common aliases
  'great sword':    '50',
  'long sword':     '15',
  'short sword':    '10',
  'short bow':      '25',
  'long bow':       '50',
  'war hammer':     '15',
  'morning star':   '15',
  'hand axe':       '5',
  'great axe':      '30',
  'battle axe':     '10',
  'great club':     '2sp',
};

export function lookupWeaponPrice(name: string): string | null {
  const key = name.toLowerCase().trim();
  return WEAPON_PRICES[key] ?? null;
}
