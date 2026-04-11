/** Parse a text HP value to a number. Returns fallback (or 0) if empty/NaN. */
export function parseHp(val: string | undefined | null, fallback?: string): number {
  const n = parseInt(val || fallback || '0', 10);
  return isNaN(n) ? 0 : n;
}
