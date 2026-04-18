export const ROADMAP_VERSION_TITLES: Record<number, string> = {
  3: 'Spatial substrate (H3)',
  4: 'Map Builder',
  5: 'Housekeeping + ops',
  6: 'DM identity',
  7: 'Campaign scoping (multi-tenancy)',
  8: 'Cutover — campaign_id NOT NULL',
  9: 'Read-only Common World',
  10: 'Claim + publish (contributor flow)',
  11: 'Content lifecycle + canon',
  12: 'Living world (entities + agents)',
  13: 'Economy — monetary',
  14: 'Magic system + MP economy',
  15: 'News, weather, celestial',
  16: 'Steampunk + airships',
  17: 'Creative destruction',
  18: 'Moderated comments',
  19: 'Crossover sessions',
  20: 'Internal battle-test (synthetic campaigns)',
  21: 'Closed beta (real DMs)',
  22: 'Public launch',
  23: 'Contributor portfolios',
  24: 'ERC-20 token bridge (planning only)',
};

export function titleForVersion(version: number): string | undefined {
  return ROADMAP_VERSION_TITLES[version];
}
