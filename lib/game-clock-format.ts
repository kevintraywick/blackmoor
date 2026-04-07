// Pure presentation helpers for the campaign game clock.
//
// Lives in its own module so client components can import without dragging
// in lib/db.ts (and pg) via the server-only side of lib/game-clock.ts.

// Turn game_time_seconds into an in-fiction string. v1 uses a simple
// Gregorian-equivalent day counter; richer calendars stay out of the schema.
export function formatGameTime(gameTimeSeconds: number): string {
  const totalMinutes = Math.floor(gameTimeSeconds / 60);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  return `Day ${days + 1}, ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

// Sunrise at 06:00, sunset at 18:00 in-fiction.
export function isNight(gameTimeSeconds: number): boolean {
  const secondsInDay = gameTimeSeconds % (60 * 60 * 24);
  const hour = Math.floor(secondsInDay / 3600);
  return hour < 6 || hour >= 18;
}
