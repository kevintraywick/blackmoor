// Notable astronomical events — hardcoded for 2026–2027.
// The World AI triage context uses these to seed omen-style beats
// ("a red star crosses the sky", "the longest night approaches").
// Replace with a real almanac API when one is worth the dependency.

export interface AstronomicalEvent {
  date: string;      // ISO date, e.g. '2026-06-21'
  event: string;     // short label
  description: string; // in-fiction-ready flavor text
}

const EVENTS: AstronomicalEvent[] = [
  // 2026 — solstices and equinoxes
  { date: '2026-03-20', event: 'Vernal Equinox', description: 'Day and night stand equal. The old year turns.' },
  { date: '2026-06-21', event: 'Summer Solstice', description: 'The longest day. The sun stands still at its highest reach.' },
  { date: '2026-09-22', event: 'Autumnal Equinox', description: 'The scales balance again. Harvest fires burn low.' },
  { date: '2026-12-21', event: 'Winter Solstice', description: 'The longest night. What sleeps beneath the frost stirs.' },

  // 2026 — eclipses
  { date: '2026-02-17', event: 'Annular Solar Eclipse', description: 'A ring of fire crowns the sun. The birds fall silent.' },
  { date: '2026-03-03', event: 'Total Lunar Eclipse', description: 'The moon bleeds. The wolves of the Spine will not stop their crying.' },
  { date: '2026-08-12', event: 'Partial Solar Eclipse', description: 'A shadow bites the sun. The wyrd-women sing.' },
  { date: '2026-08-28', event: 'Total Lunar Eclipse', description: 'The blood moon rises again. Old men bar their doors.' },

  // 2026 — meteor showers
  { date: '2026-01-03', event: 'Quadrantids Peak', description: 'Stars fall from the northern sky like sparks from a forge.' },
  { date: '2026-04-22', event: 'Lyrids Peak', description: 'The sky weeps silver threads. A sign, say the hedge-witches.' },
  { date: '2026-05-06', event: 'Eta Aquariids Peak', description: 'Swift streaks cross the dawn sky — Halley\'s ancient dust.' },
  { date: '2026-08-12', event: 'Perseids Peak', description: 'The midsummer sky blazes with falling stars. Wishes are cheap tonight.' },
  { date: '2026-10-21', event: 'Orionids Peak', description: 'The Hunter\'s stars shed their fire. Something watches from the east.' },
  { date: '2026-11-17', event: 'Leonids Peak', description: 'The Lion roars across the heavens.' },
  { date: '2026-12-14', event: 'Geminids Peak', description: 'Twin lights fall from the sky. The old stories call them omens.' },

  // 2027 — solstices and equinoxes
  { date: '2027-03-20', event: 'Vernal Equinox', description: 'The wheel turns again. Seeds stir in frozen ground.' },
  { date: '2027-06-21', event: 'Summer Solstice', description: 'The sun king reigns at his zenith.' },
  { date: '2027-09-23', event: 'Autumnal Equinox', description: 'The harvest lord bows. Darkness gains an inch.' },
  { date: '2027-12-22', event: 'Winter Solstice', description: 'The year dies. What new thing will be born in the dark?' },

  // 2027 — eclipses
  { date: '2027-02-06', event: 'Penumbral Lunar Eclipse', description: 'The moon dims, as if a hand were laid across its face.' },
  { date: '2027-02-20', event: 'Partial Solar Eclipse', description: 'The sun wavers. A sliver of shadow crosses its eye.' },
  { date: '2027-07-18', event: 'Penumbral Lunar Eclipse', description: 'A grey veil falls across the moon. The tides pull strange.' },
  { date: '2027-08-02', event: 'Total Solar Eclipse', description: 'The sun goes dark. Day becomes night. The animals lie down.' },
];

/**
 * Return notable astronomical events within the next N days from the given date.
 * Returns an empty array when no events fall in the window.
 */
export function getAstronomicalEvents(windowDays: number, from: Date = new Date()): AstronomicalEvent[] {
  const fromMs = from.getTime();
  const toMs = fromMs + windowDays * 24 * 60 * 60 * 1000;

  return EVENTS.filter(e => {
    const eventMs = new Date(e.date + 'T00:00:00Z').getTime();
    return eventMs >= fromMs && eventMs <= toMs;
  });
}
