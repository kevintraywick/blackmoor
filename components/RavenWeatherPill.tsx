import type { WeatherCondition } from '@/lib/types';

const ICONS: Record<WeatherCondition, string> = {
  clear:  '☀',
  rain:   '🌧',
  snow:   '❄',
  fog:    '🌫',
  storm:  '⛈',
  mist:   '🌁',
  dust:   '🟫',
  embers: '🔥',
};

const LABELS: Record<WeatherCondition, string> = {
  clear:  'Clear',
  rain:   'Rain',
  snow:   'Snow',
  fog:    'Fog',
  storm:  'Storm',
  mist:   'Mist',
  dust:   'Dust',
  embers: 'Embers',
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
