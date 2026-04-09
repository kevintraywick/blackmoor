'use client';

import { useState } from 'react';
import type { RavenItem, RavenWeatherRow } from '@/lib/types';
import RavenWeatherPill from './RavenWeatherPill';
import RavenAdModal from './RavenAdModal';

interface Props {
  items: RavenItem[];
  weather: RavenWeatherRow;
  volume: number;
  issue: number;
  inFictionDate: string; // e.g. "14th of Mirtul, 1496 DR"
}

export default function RavenBroadsheet({ items, weather, volume, issue, inFictionDate }: Props) {
  const [adModal, setAdModal] = useState<RavenItem | null>(null);

  const broadsheetItems = items.filter(i => i.medium === 'broadsheet');
  // Ravens and sendings are personal — they appear on the player's own page,
  // not on the public broadsheet. Only broadsheet headlines and ads here.
  const ads = items.filter(i => i.medium === 'ad');

  return (
    <div
      className="font-serif"
      style={{
        background: '#efe3c4',
        backgroundImage:
          'radial-gradient(circle at 20% 10%, rgba(139,90,30,0.08), transparent 50%),' +
          'radial-gradient(circle at 80% 90%, rgba(139,90,30,0.10), transparent 55%)',
        border: '1px solid #d9c89a',
        padding: '28px 30px',
        color: '#2b1f14',
        boxShadow: '0 8px 24px rgba(43,31,20,0.35), inset 0 0 80px rgba(139,90,30,0.08)',
        position: 'relative',
      }}
    >
      {/* Volume / Issue stamp */}
      <div
        style={{
          position: 'absolute',
          top: 40,
          right: 30,
          fontSize: '0.58rem',
          textTransform: 'uppercase',
          letterSpacing: '0.2em',
          color: '#7b1a1a',
          border: '1.5px solid #7b1a1a',
          padding: '4px 8px',
          transform: 'rotate(-6deg)',
          fontWeight: 700,
          opacity: 0.75,
        }}
      >
        Volume {volume}<br />Issue {issue}
      </div>

      {/* Masthead */}
      <div style={{ textAlign: 'center', borderBottom: '2px double #2b1f14', paddingBottom: 10, marginBottom: 14 }}>
        <h1 style={{
          fontFamily: 'UnifrakturMaguntia, "EB Garamond", serif',
          fontSize: '2.4rem',
          letterSpacing: '0.04em',
          margin: 0,
        }}>
          The Raven Post
        </h1>
        <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.3em', color: '#4a3723', marginTop: 2 }}>
          Published fortnightly at the sign of the black feather
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', fontStyle: 'italic', marginTop: 6, color: '#4a3723' }}>
          <span>{inFictionDate}</span>
          <RavenWeatherPill condition={weather.condition} temp_c={weather.temp_c} wind_label={weather.wind_label} />
          <span>One copper · three if bloodied</span>
        </div>
      </div>

      {/* Broadsheet headlines — 3 columns desktop, 1 column mobile via auto-fit */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '18px',
        }}
      >
        {broadsheetItems.length === 0 && (
          <p style={{ fontStyle: 'italic', color: '#4a3723' }}>
            The press is silent today. The Editor is doubtless drinking.
          </p>
        )}
        {broadsheetItems.slice(0, 6).map((item, idx) => (
          <article key={item.id}>
            <h3
              style={{
                fontFamily: 'EB Garamond, serif',
                fontWeight: 700,
                fontSize: idx === 0 ? '1.6rem' : '1.15rem',
                lineHeight: 1.15,
                margin: '0 0 4px',
                borderBottom: '1px solid #2b1f14',
                paddingBottom: 3,
              }}
            >
              {item.headline}
            </h3>
            <p style={{
              fontSize: '0.85rem',
              lineHeight: 1.4,
              margin: '0 0 8px',
              textAlign: 'justify',
            }}>
              {item.body}
            </p>
          </article>
        ))}
      </div>

      {/* Ravens and sendings are personal — they will appear on each
          player's own sheet page, not on the public broadsheet. */}

      {/* Classifieds + ads */}
      {ads.length > 0 && (
        <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #2b1f14', fontSize: '0.72rem', color: '#4a3723' }}>
          <span style={{ textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 700, color: '#2b1f14', display: 'block', marginBottom: 6 }}>
            Classifieds
          </span>
          {ads.map(ad => (
            <div
              key={ad.id}
              onClick={() => (ad.ad_real_link || ad.ad_real_copy) && setAdModal(ad)}
              style={{
                marginBottom: 6,
                cursor: (ad.ad_real_link || ad.ad_real_copy) ? 'pointer' : 'default',
                fontSize: '0.78rem',
              }}
            >
              {ad.body}
            </div>
          ))}
        </div>
      )}

      {adModal && <RavenAdModal item={adModal} onClose={() => setAdModal(null)} />}
    </div>
  );
}
