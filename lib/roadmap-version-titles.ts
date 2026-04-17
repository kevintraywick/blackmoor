export const ROADMAP_VERSION_TITLES: Record<number, string> = {
  3: 'Map Builder',
  4: 'Spatial substrate (H3)',
  5: 'Housekeeping + ops',
  6: 'DM identity',
  7: 'Campaign scoping (multi-tenancy)',
  8: 'Cutover — campaign_id NOT NULL',
  9: 'Read-only Common World',
  10: 'Claim + publish (contributor flow)',
  11: 'Content lifecycle + canon',
  12: 'Living world + economy',
  13: 'News, weather, celestial',
  14: 'Creative destruction',
  15: 'Moderated comments',
  16: 'Crossover sessions',
  17: 'Internal battle-test (synthetic campaigns)',
  18: 'Closed beta (real DMs)',
  19: 'Public launch',
  20: 'Contributor portfolios',
  21: 'ERC-20 token bridge (planning only)',
};

export function titleForVersion(version: number): string | undefined {
  return ROADMAP_VERSION_TITLES[version];
}
