'use client';

import { useState } from 'react';
import type { RavenItem, RavenWeatherRow } from '@/lib/types';
import RavenAdModal from './RavenAdModal';

interface Props {
  items: RavenItem[];
  weather: RavenWeatherRow;
  volume: number;
  issue: number;
  inFictionDate: string; // e.g. "14th of Mirtul, 1496 DR"
}

export default function RavenBroadsheet({ items, volume, issue, inFictionDate }: Props) {
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
      {/* Edition Stamp — circular wax stamp at top-right of sheet */}
      <div
        style={{
          position: 'absolute',
          top: -20,
          right: -6,
          width: 118,
          height: 118,
          transform: 'rotate(-6deg)',
          opacity: 0.8,
          zIndex: 2,
        }}
      >
        <svg viewBox="0 0 120 120" width="118" height="118" style={{ overflow: 'visible' }}>
          <defs>
            {/* Circular path for text — starts at top, runs clockwise */}
            <path id="stamp-curve" d="M 60,60 m -40,0 a 40,40 0 1,1 80,0 a 40,40 0 1,1 -80,0" fill="none" />
          </defs>
          {/* Inner ring (enclosing Vol/Issue) */}
          <circle cx="60" cy="60" r="36" fill="none" stroke="#7b1a1a" strokeWidth="1.5" />
          {/* Curved text — two halves separated by bullets */}
          <text
            fill="#7b1a1a"
            fontSize="8.4"
            fontWeight="700"
            letterSpacing="2"
            style={{ textTransform: 'uppercase', fontFamily: 'EB Garamond, serif' }}
          >
            <textPath href="#stamp-curve" startOffset="0%">
              · Published Fortnightly · Black Feather Press
            </textPath>
          </text>
          {/* Vol / Issue inside */}
          <text
            x="60"
            y="56"
            textAnchor="middle"
            fill="#7b1a1a"
            fontSize="9"
            fontWeight="700"
            letterSpacing="1.5"
            style={{ textTransform: 'uppercase', fontFamily: 'EB Garamond, serif' }}
          >
            Volume {volume}
          </text>
          <text
            x="60"
            y="70"
            textAnchor="middle"
            fill="#7b1a1a"
            fontSize="9"
            fontWeight="700"
            letterSpacing="1.5"
            style={{ textTransform: 'uppercase', fontFamily: 'EB Garamond, serif' }}
          >
            Issue {issue}
          </text>
        </svg>
      </div>

      {/* Masthead */}
      <div
        style={{
          textAlign: 'center',
          paddingBottom: 14,
          marginBottom: 18,
          borderBottom: '4px double #2b1f14',
          position: 'relative',
        }}
      >
        {/* Arrow — pierces the masthead; tip lands just below the double rule near column 1/2 gutter */}
        <img
          src="/images/raven-post/arrow.png"
          alt=""
          aria-hidden
          style={{
            position: 'absolute',
            width: 130,
            bottom: -6,
            // spot 1 reference: left: '72%'. Current nudged right from 58%.
            left: '68%',
            zIndex: 0,
            pointerEvents: 'none',
            opacity: 0.92,
            filter: 'drop-shadow(1px 2px 1px rgba(0,0,0,0.35))',
            transform: 'rotate(6deg)',
          }}
        />

        {/* Top hairline rule above the title */}
        <div style={{ position: 'relative', zIndex: 1, height: 1, background: '#2b1f14', margin: '0 auto 10px', width: '92%', opacity: 0.8 }} />

        <h1
          style={{
            position: 'relative',
            zIndex: 1,
            fontFamily: 'UnifrakturMaguntia, "EB Garamond", serif',
            fontSize: '4.2rem',
            lineHeight: 0.95,
            letterSpacing: '0.02em',
            margin: 0,
            color: '#1a0f08',
            textShadow: '0 1px 0 rgba(43,31,20,0.25)',
          }}
        >
          The Raven Post
        </h1>

        {/* Ornamental tagline with flanking rules */}
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 14,
            marginTop: 10,
          }}
        >
          <span style={{ flex: 1, height: 1, background: '#2b1f14', opacity: 0.55, maxWidth: 220 }} />
          <span
            style={{
              fontFamily: 'EB Garamond, serif',
              fontSize: '0.95rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.35em',
              color: '#2b1f14',
              whiteSpace: 'nowrap',
            }}
          >
            ❦&nbsp;&nbsp;News, Gossip and Tales of the Realm&nbsp;&nbsp;❦
          </span>
          <span style={{ flex: 1, height: 1, background: '#2b1f14', opacity: 0.55, maxWidth: 220 }} />
        </div>

        <div
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '1.05rem',
            fontStyle: 'italic',
            marginTop: 12,
            color: '#2b1f14',
            fontWeight: 600,
          }}
        >
          <span>{inFictionDate}</span>
          <span>One copper</span>
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
        {broadsheetItems.map((item, idx) => (
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
