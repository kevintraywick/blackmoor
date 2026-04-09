// Moon phase calculation — Metonic cycle approximation.
// No API calls, no dependencies. Accurate to ±1 day, which is sufficient
// for in-fiction flavor ("the hunter's moon rises full tonight").

export type MoonPhase =
  | 'new_moon'
  | 'waxing_crescent'
  | 'first_quarter'
  | 'waxing_gibbous'
  | 'full_moon'
  | 'waning_gibbous'
  | 'last_quarter'
  | 'waning_crescent';

const PHASE_NAMES: Record<MoonPhase, string> = {
  new_moon:        'New Moon',
  waxing_crescent: 'Waxing Crescent',
  first_quarter:   'First Quarter',
  waxing_gibbous:  'Waxing Gibbous',
  full_moon:       'Full Moon',
  waning_gibbous:  'Waning Gibbous',
  last_quarter:    'Last Quarter',
  waning_crescent: 'Waning Crescent',
};

const PHASE_ORDER: MoonPhase[] = [
  'new_moon', 'waxing_crescent', 'first_quarter', 'waxing_gibbous',
  'full_moon', 'waning_gibbous', 'last_quarter', 'waning_crescent',
];

// Average synodic month (new moon to new moon) in days
const SYNODIC_MONTH = 29.53058770576;

// Known new moon reference: January 6, 2000 18:14 UTC
const KNOWN_NEW_MOON = new Date('2000-01-06T18:14:00Z').getTime();

export interface MoonInfo {
  phase: MoonPhase;
  name: string;
  illumination: number;  // 0–1, approximate
  daysSinceNewMoon: number;
  nextFullMoon: Date;
}

/**
 * Compute the moon phase for a given date using the synodic month cycle.
 * Accuracy: ±1 day — good enough for in-fiction flavor.
 */
export function getMoonPhase(date: Date = new Date()): MoonInfo {
  const diffMs = date.getTime() - KNOWN_NEW_MOON;
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  const cyclePosition = ((diffDays % SYNODIC_MONTH) + SYNODIC_MONTH) % SYNODIC_MONTH;

  // 8 phases, each spans ~3.69 days
  const phaseIndex = Math.floor((cyclePosition / SYNODIC_MONTH) * 8) % 8;
  const phase = PHASE_ORDER[phaseIndex];

  // Approximate illumination: 0 at new moon, 1 at full moon
  const illumination = (1 - Math.cos((cyclePosition / SYNODIC_MONTH) * 2 * Math.PI)) / 2;

  // Next full moon: full moon is at cyclePosition ≈ SYNODIC_MONTH / 2
  const halfCycle = SYNODIC_MONTH / 2;
  const daysToFull = cyclePosition < halfCycle
    ? halfCycle - cyclePosition
    : SYNODIC_MONTH - cyclePosition + halfCycle;
  const nextFullMoon = new Date(date.getTime() + daysToFull * 24 * 60 * 60 * 1000);

  return {
    phase,
    name: PHASE_NAMES[phase],
    illumination: Math.round(illumination * 100) / 100,
    daysSinceNewMoon: Math.round(cyclePosition * 10) / 10,
    nextFullMoon,
  };
}
