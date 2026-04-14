/**
 * Shire-calendar date formatter for the Raven Post masthead.
 *
 * Maps real-world months to Shire Reckoning months (Tolkien's hobbit calendar).
 * Day number and month slot track the real-world date so the in-fiction date
 * drifts naturally with the calendar. Year is fixed at CY 581 for now — the
 * campaign reckoning doesn't tick with wall time.
 */

const SHIRE_MONTHS = [
  'Afteryule',   // January
  'Solmath',     // February
  'Rethe',       // March
  'Astron',      // April
  'Thrimidge',   // May
  'Forelithe',   // June
  'Afterlithe',  // July
  'Wedmath',     // August
  'Halimath',    // September
  'Winterfilth', // October
  'Blotmath',    // November
  'Foreyule',    // December
] as const;

const CAMPAIGN_YEAR = 581;

function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

export function formatShireDate(date: Date = new Date()): string {
  const day = date.getDate();
  const month = SHIRE_MONTHS[date.getMonth()];
  return `${ordinal(day)} of ${month}, CY ${CAMPAIGN_YEAR}`;
}
