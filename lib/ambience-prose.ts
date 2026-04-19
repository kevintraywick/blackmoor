/**
 * Prose-as-presentation for weather (Ambience v1 R4).
 *
 * Given a WeatherState + biome + time-of-day, returns a short DM-voice
 * sentence keyed on biome family + condition bucket + diurnal slot.
 *
 * PURE. Client-safe. No DB imports — client components import directly.
 *
 * For MVP, this is a deterministic template library. The broadsheet
 * 3-day forecast column uses Haiku (lib/ambience-forecast-prose.ts)
 * where variety benefits from generation.
 *
 * See docs/plans/2026-04-19-001-feat-ambience-v1-plan.md Unit 5.
 */

import type { KoppenZone, WeatherCondition, WeatherState } from './types';

type BiomeFamily = 'marine' | 'humid' | 'desert' | 'boreal' | 'tundra' | 'tropical';
type Slot = 'dawn' | 'day' | 'dusk' | 'night';

/** Map a Köppen zone to a coarse biome family for prose selection. */
function biomeFamily(koppen: KoppenZone): BiomeFamily {
  if (koppen === 'Cfb' || koppen === 'Cfc' || koppen === 'Cwb' || koppen === 'Cwc') return 'marine';
  if (koppen.startsWith('A')) return 'tropical';
  if (koppen === 'BWh' || koppen === 'BSh') return 'desert';
  if (koppen === 'BWk' || koppen === 'BSk') return 'desert';
  if (koppen.startsWith('D')) return 'boreal';
  if (koppen === 'ET' || koppen === 'EF') return 'tundra';
  return 'humid';
}

function conditionBucket(c: WeatherCondition): 'clear' | 'cloud' | 'rain' | 'heavy' | 'snow' | 'wind' | 'fog' {
  switch (c) {
    case 'clear': case 'hot': case 'cold': return 'clear';
    case 'overcast': case 'mist': case 'haze': return 'cloud';
    case 'drizzle': case 'light_rain': return 'rain';
    case 'rain': return 'rain';
    case 'heavy_rain': case 'storm': case 'thunderstorm': case 'hail': return 'heavy';
    case 'sleet': case 'snow': return 'snow';
    case 'windy': case 'gale': return 'wind';
    case 'fog': return 'fog';
    default: return 'clear';
  }
}

function slotFor(hourOfDay: number): Slot {
  if (hourOfDay >= 5 && hourOfDay < 8) return 'dawn';
  if (hourOfDay >= 8 && hourOfDay < 18) return 'day';
  if (hourOfDay >= 18 && hourOfDay < 21) return 'dusk';
  return 'night';
}

// Templates — indexed by (biome-family, condition-bucket, slot).
// Missing (family, bucket, slot) combinations fall through to a same-family
// 'day' entry, then to the 'humid' family. Empty strings collapse to default.
type ConditionMap = Partial<Record<'clear' | 'cloud' | 'rain' | 'heavy' | 'snow' | 'wind' | 'fog', Partial<Record<Slot, string[]>>>>;

const TEMPLATES: Record<BiomeFamily, ConditionMap> = {
  marine: {
    clear: {
      dawn: ['Grey light, salt on the wind.', 'The sea exhales mist; it burns off by first watch.'],
      day:  ['Clear skies. Rare enough to mark.', 'Sun and cloud-shadow chase each other across the fields.', 'A rare bright day. Banners dry on the walls.'],
      dusk: ['Long gold light. Gulls wheel home.', 'The sea darkens; the sky holds its colour.'],
      night: ['Stars through the gaps in the cloud. Cold air off the water.'],
    },
    cloud: {
      dawn: ['Overcast. The sea and the sky agree to the same grey.'],
      day:  ['Cloud-ceiling low, steady.', 'Grey day. No rain, but no sun either.', 'The light is flat. Shadows barely exist.'],
      dusk: ['The cloud holds the day\'s warmth. The night will be milder than it should be.'],
      night: ['Cloud close overhead. The dark is soft, not black.'],
    },
    rain: {
      dawn: ['Light rain off the sea. Stones slick by noon.', 'A wet dawn. The eaves are already weeping.'],
      day:  ['Rain — steady, not driving.', 'Grey rain. Raincoats out.', 'The wind is off the sea and the rain comes with it.'],
      dusk: ['Rain at dusk. The lanterns blur.'],
      night: ['Rain on the slates all night.'],
    },
    heavy: {
      dawn: ['A storm came in off the sea in the night. Everything is running.'],
      day:  ['Storm. The sea is white. Boats are tied double.', 'Heavy rain. Every ditch is a river.'],
      dusk: ['The storm has broken, but the light is still wrong.'],
      night: ['Thunder somewhere out over the water. The wind shakes the doors.'],
    },
    snow: {
      dawn: ['Wet snow. By midday it will be rain again.'],
      day:  ['Snow turning to sleet. The streets are grey slush.'],
      dusk: ['Snow at dusk; the lanterns halo in it.'],
      night: ['Snow falling in the dark. No wind. Nothing moves.'],
    },
    wind: {
      day: ['A gale off the sea. Ropes creak. Slates lift and settle.'],
      night: ['The wind is up. The shutters knock all night.'],
    },
    fog: {
      dawn: ['Sea-fog. Not twenty paces visible.'],
      day:  ['The fog has not lifted. It may not.'],
      night: ['The fog holds the lanterns close.'],
    },
  },
  humid: {
    clear: {
      day: ['Clear and close. The air has weight.'],
      night: ['The heat hasn\'t gone out of the stone.'],
    },
    cloud: { day: ['Cloudy, warm, still.'] },
    rain:  { day: ['A warm rain. It doesn\'t cool anything.'] },
    heavy: { day: ['Heavy rain, all at once. Streets run full.'] },
    snow:  { day: ['Snow, unusual. It won\'t stick.'] },
    wind:  { day: ['Wind rising. The trees are loud.'] },
    fog:   { day: ['Haze over the fields. The sun is a pale coin.'] },
  },
  desert: {
    clear: {
      dawn: ['Dawn. The cold lifts off the stones.'],
      day:  ['The sun is a weight. Nothing moves that doesn\'t have to.', 'Dust thick on the tongue.', 'Bone-white noon.'],
      dusk: ['The heat steps back an hour after sundown.'],
      night: ['Cold, after the heat. Stars uncountable.'],
    },
    cloud: { day: ['A rare cloud. The old women watch it like a sign.'] },
    rain:  { day: ['Rain. The old say it\'s been twenty years.'] },
    heavy: { day: ['A storm — sand, not water. Shutters close by instinct.'] },
    snow:  { day: ['Snow at the oasis. The children have never seen it.'] },
    wind:  { day: ['The wind carries sand. Every corner of every house is full of it.'] },
    fog:   { day: ['Fog at the wadi. The first one of the year.'] },
  },
  boreal: {
    clear: {
      dawn: ['Sun coming up through the pines. Breath clouds before the face.'],
      day:  ['Cold and bright. The snow creaks.'],
      dusk: ['The sun sets early. The cold is already there.'],
      night: ['Stars, hard as nails. Every cracking branch is heard.'],
    },
    cloud: { day: ['Grey sky. The cold without the wind.'] },
    rain:  { day: ['Cold rain — half sleet by evening.'] },
    heavy: { day: ['Blizzard. You don\'t leave the fire.'] },
    snow:  { day: ['Snow, thick and quiet.', 'The snow is waist-deep in the drifts by the north wall.'] },
    wind:  { day: ['The wind has teeth.'] },
    fog:   { day: ['Ice-fog. Even the beards freeze.'] },
  },
  tundra: {
    clear: {
      day: ['Sun low on the horizon. Nothing to break it.'],
      night: ['The stars are the only thing not frozen.'],
    },
    cloud: { day: ['Grey over white. Only the wind tells you which way is down.'] },
    rain:  { day: ['Sleet. The ground refuses to thaw.'] },
    heavy: { day: ['A whiteout. Rope yourself to the door if you must go out.'] },
    snow:  { day: ['Fine snow, blown sideways.'] },
    wind:  { day: ['The wind never stops. It only gets louder.'] },
    fog:   { day: ['Fog in the morning. It won\'t lift.'] },
  },
  tropical: {
    clear: { day: ['Heat. No shade that isn\'t bought.', 'The cicadas are in every tree.'] },
    cloud: { day: ['Cloud, sticky. A storm sometime in the afternoon.'] },
    rain:  { day: ['A warm squall. Over in minutes. The steam comes up after.'] },
    heavy: { day: ['A typhoon at sea. You feel it before you see it.'] },
    snow:  { day: ['Hail on the palms. An unkindness.'] },
    wind:  { day: ['The wind is in the leaves all day.'] },
    fog:   { day: ['Mist in the uplands. The tea fields are invisible.'] },
  },
};

/** DJB2 hash for deterministic template selection. */
function hash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return h >>> 0;
}

/** Render a short DM-voice prose line for a weather state. */
export function renderProse(opts: {
  koppen: KoppenZone;
  state: WeatherState;
  gameHour: number; // absolute in-fiction hour (used for hour-of-day + determinism)
}): string {
  const family = biomeFamily(opts.koppen);
  const bucket = conditionBucket(opts.state.condition);
  const slot = slotFor(((opts.gameHour % 24) + 24) % 24);

  // Lookup chain: (family, bucket, slot) → (family, bucket, 'day') → ('humid', bucket, 'day')
  const options =
    TEMPLATES[family]?.[bucket]?.[slot] ??
    TEMPLATES[family]?.[bucket]?.day ??
    TEMPLATES.humid[bucket]?.day ??
    TEMPLATES.humid.clear?.day ??
    ['The day holds. No weather worth the telling.'];

  const idx = hash(`${opts.koppen}:${opts.state.condition}:${Math.floor(opts.gameHour)}`) % options.length;
  return options[idx];
}
