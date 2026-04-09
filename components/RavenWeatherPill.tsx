import type { WeatherCondition } from '@/lib/types';

const ICONS: Record<WeatherCondition, string> = {
  clear: '☀', drizzle: '🌦', light_rain: '🌦', rain: '🌧', heavy_rain: '🌧',
  sleet: '🌨', snow: '❄', hail: '🧊',
  windy: '💨', gale: '🌬', calm: '🍃',
  fog: '🌫', mist: '🌁', haze: '🌤',
  overcast: '☁', hot: '🔆', cold: '🥶',
  storm: '⛈', thunderstorm: '⛈', sandstorm: '🏜',
  dust: '🟫', embers: '🔥', fae: '✨', blood_moon: '🌕', aurora: '🌌',
};

const LABELS: Record<WeatherCondition, string> = {
  clear: 'Clear', drizzle: 'Drizzle', light_rain: 'Light Rain', rain: 'Rain', heavy_rain: 'Heavy Rain',
  sleet: 'Sleet', snow: 'Snow', hail: 'Hail',
  windy: 'Windy', gale: 'Gale', calm: 'Calm',
  fog: 'Fog', mist: 'Mist', haze: 'Haze',
  overcast: 'Overcast', hot: 'Hot', cold: 'Cold',
  storm: 'Storm', thunderstorm: 'Thunderstorm', sandstorm: 'Sandstorm',
  dust: 'Dust', embers: 'Embers', fae: 'Fae', blood_moon: 'Blood Moon', aurora: 'Aurora',
};

interface Props {
  condition: WeatherCondition;
  temp_c: number | null;
  wind_label: string | null;
}

export default function RavenWeatherPill({ condition, temp_c, wind_label }: Props) {
  const parts: string[] = [`${ICONS[condition]} ${LABELS[condition]}`];
  if (temp_c !== null) parts.push(`${temp_c}°C`);
  if (wind_label) parts.push(wind_label);
  return (
    <span
      style={{
        display: 'inline-block',
        background: 'rgba(20,30,50,0.85)',
        border: '1px solid rgba(160,200,255,0.4)',
        color: '#cce0ff',
        fontSize: '0.7rem',
        padding: '5px 10px',
        textTransform: 'uppercase',
        letterSpacing: '0.15em',
      }}
    >
      {parts.join(' · ')}
    </span>
  );
}
