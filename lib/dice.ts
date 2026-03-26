// Parse and roll dice notation like "3d6+3", "2d8-1", "1d10", "12"
const DICE_RE = /^(\d+)d(\d+)\s*([+-]\s*\d+)?$/i;

export function parseDice(notation: string): { count: number; sides: number; modifier: number } | null {
  const trimmed = notation.trim();
  // Plain number — no roll needed
  if (/^\d+$/.test(trimmed)) return null;

  const m = DICE_RE.exec(trimmed);
  if (!m) return null;
  return {
    count: parseInt(m[1], 10),
    sides: parseInt(m[2], 10),
    modifier: m[3] ? parseInt(m[3].replace(/\s/g, ''), 10) : 0,
  };
}

export function rollDice(notation: string): number | null {
  const parsed = parseDice(notation);
  if (!parsed) {
    // If it's just a plain number, return it
    const n = parseInt(notation.trim(), 10);
    return isNaN(n) ? null : n;
  }
  let total = parsed.modifier;
  for (let i = 0; i < parsed.count; i++) {
    total += Math.floor(Math.random() * parsed.sides) + 1;
  }
  return Math.max(1, total);
}
