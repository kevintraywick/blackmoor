import NPC_IMAGE_MANIFEST from './npc-image-manifest';

/**
 * Normalize a creature name to a slug suitable for matching image filenames.
 * "Flame Skull" → "flameskull", "Giant Spider" → "giantspider"
 */
export function toCreatureSlug(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Look up an NPC image path by creature name.
 * Returns a path like "images/NPCs/orc.png" or undefined if no match.
 * Tries exact slug match first, then partial (startsWith/endsWith).
 */
export function lookupNpcImage(name: string): string | undefined {
  const slug = toCreatureSlug(name);
  if (!slug) return undefined;

  // Exact match
  if (NPC_IMAGE_MANIFEST[slug]) return NPC_IMAGE_MANIFEST[slug];

  // Partial match — e.g. "Goblin Archer" → "goblin"
  for (const [key, path] of Object.entries(NPC_IMAGE_MANIFEST)) {
    if (slug.startsWith(key) || slug.endsWith(key)) return path;
  }
  return undefined;
}
