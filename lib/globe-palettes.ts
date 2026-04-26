/**
 * Named color palettes for the /dm/globe view.
 *
 * Kevin saves candidate palettes here by name so we can A/B them in the
 * globe client without re-litigating color choices in chat. Bring a
 * palette into play by importing it and pointing the relevant COLOR_*
 * constants (or the `<meshBasicMaterial>` props) at its swatches.
 */

export interface GlobePalette {
  /** Short name for chat + git references (e.g. "globe_col_A"). */
  name: string;
  /** Longer description — what makes the palette distinctive. */
  note: string;
  /** Ordered swatches, left-to-right as Kevin dropped them in. */
  swatches: readonly string[];
}

/**
 * Saved 2026-04-19. Nine-swatch ramp: cool dark navy → teal → aqua → sage →
 * warm cream yellow → peach → burnt orange → brick → dark rust. Reads as a
 * sunset-over-ocean progression; natural fit for a planetary view where
 * one hemisphere is "cool / shade" and the other is "warm / light."
 */
export const globe_col_A: GlobePalette = {
  name: 'globe_col_A',
  note: 'cool navy → teal → aqua → sage → cream → peach → burnt orange → brick → rust',
  swatches: [
    '#0c1a26', // deep navy (space / shadow side)
    '#2e615a', // dark teal
    '#5a93a0', // slate blue / aqua
    '#b3c998', // sage green
    '#f3e4a0', // pale warm yellow (sun / cream)
    '#efac7e', // peach
    '#dd7a3b', // warm orange
    '#a83a2a', // brick red
    '#6e2a18', // dark rust
  ],
};

export const GLOBE_PALETTES: Record<string, GlobePalette> = {
  globe_col_A,
};
