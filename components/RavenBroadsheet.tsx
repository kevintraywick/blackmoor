'use client';

/**
 * The Raven Post — Broadsheet Layout 1, v1
 *
 * Front-page broadsheet rendered as a 3-equal-column grid (1fr 1fr 1fr).
 * See DESIGN.md → "Raven Post Broadsheet — Layout 1 v1" for the section map
 * and slotting rules.
 *
 *   Masthead (edition stamp, piercing arrow, title, tagline, date/price)
 *   ─────────────────────────────────
 *   BIG HEADLINE (page-width, uppercase)
 *   ─────────────────────────────────
 *   Col 1             Col 2                 Col 3
 *   (1) lorem         (2) image + (4) cap   (3) Crimson Moon
 *   (5) ad image      (6) Blood Moon        (8) Opinion
 *   (9) Quote o' Day  (7) Spot Prices
 *   ─────────────────────────────────
 *
 * Columns stretch to equal height. Last box in each column flex-grows to
 * keep bottoms aligned. Items slot into (3) / (6) by headline regex match
 * on the `broadsheet`-medium raven_items rows.
 */

import type { RavenItem, RavenWeatherRow } from '@/lib/types';

interface Props {
  items: RavenItem[];
  weather: RavenWeatherRow;
  volume: number;
  issue: number;
  inFictionDate: string; // e.g. "14th of Mirtul, 1496 DR"
}

export default function RavenBroadsheet({ items, volume, issue, inFictionDate }: Props) {
  const broadsheetItems = items.filter(i => i.medium === 'broadsheet');
  // Ravens and sendings are personal — they appear on the player's own page,
  // not on the public broadsheet. Slotted broadsheet items render in fixed
  // sections of the 3-column layout; unmatched items are currently unused.
  const bloodMoonItem = broadsheetItems.find(i => /blood\s*moon/i.test(i.headline ?? ''));
  const crimsonMoonItem = broadsheetItems.find(i => /crimson\s*moon/i.test(i.headline ?? ''));

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

      {/* Big headline — front-page, page-width */}
      <h2
        style={{
          fontFamily: '"Playfair Display", "EB Garamond", serif',
          fontSize: '3.4rem',
          fontWeight: 900,
          lineHeight: 0.95,
          letterSpacing: '0.01em',
          textAlign: 'center',
          textTransform: 'uppercase',
          margin: '0 0 14px',
          color: '#1a0f08',
          borderBottom: '1px solid #2b1f14',
          paddingBottom: 10,
        }}
      >
        Orc Invasion
      </h2>

      {/* Front page — traditional 3-column broadsheet, each column stacks sections */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: 18,
          marginBottom: 18,
          alignItems: 'stretch',
        }}
      >
        {/* Column 1: (1) lorem → (5) bone dice ad */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Section (1) */}
          <div style={{ fontSize: '0.88rem', lineHeight: 1.5, textAlign: 'justify' }}>
            <p style={{ margin: '0 0 8px' }}>
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do
              eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim
              ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut
              aliquip ex ea commodo consequat.
            </p>
            <p style={{ margin: '0 0 8px' }}>
              Duis aute irure dolor in reprehenderit in voluptate velit esse
              cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat
              cupidatat non proident, sunt in culpa qui officia deserunt mollit
              anim id est laborum.
            </p>
            <p style={{ margin: 0 }}>
              Sed ut perspiciatis unde omnis iste natus error sit voluptatem
              accusantium doloremque laudantium, totam rem aperiam, eaque ipsa
              quae ab illo inventore veritatis et quasi architecto beatae vitae
              dicta sunt explicabo.
            </p>
          </div>

          {/* Section (5) — bone dice ad */}
          <a
            href="https://www.etsy.com/search?q=bone+dice"
            target="_blank"
            rel="noopener noreferrer"
            title="Dwarf-cut Bone Dice"
            style={{ display: 'block' }}
          >
            <img
              src="/images/raven-post/ads/bone_dice.jpg"
              alt="Dwarf-cut Bone Dice — forged beneath the Iron Spine"
              style={{
                display: 'block',
                width: '100%',
                height: 'auto',
                border: '1px solid #2b1f14',
              }}
            />
          </a>

          {/* Section (9) — Quote of the Day — flex-grows to align column bottoms */}
          <aside
            style={{
              border: '1px solid #2b1f14',
              padding: '8px 10px',
              textAlign: 'center',
              background: 'rgba(139,90,30,0.05)',
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                fontFamily: 'EB Garamond, serif',
                fontSize: '0.65rem',
                textTransform: 'uppercase',
                letterSpacing: '0.2em',
                fontWeight: 700,
                color: '#2b1f14',
                marginBottom: 4,
              }}
            >
              Quote of the Day
            </div>
            <blockquote
              style={{
                margin: 0,
                fontFamily: 'EB Garamond, serif',
                fontStyle: 'italic',
                fontSize: '0.82rem',
                lineHeight: 1.35,
                color: '#2b1f14',
              }}
            >
              “All that we see or seem is but a dream within a dream.”
              <footer
                style={{
                  fontStyle: 'normal',
                  fontSize: '0.68rem',
                  marginTop: 4,
                  letterSpacing: '0.05em',
                  color: '#4a3723',
                }}
              >
                — Edgar Allan Poe
              </footer>
            </blockquote>
          </aside>
        </div>

        {/* Column 2: (2) image + (4) caption → (6) Blood Moon → (7) prices */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Section (2) image + (4) caption */}
          <figure style={{ margin: 0 }}>
            <img
              src="/images/raven-post/orc_fleet.jpg"
              alt="Orc fleet spotted in the Solnar"
              style={{
                display: 'block',
                width: '100%',
                height: 'auto',
                border: '1px solid #2b1f14',
                filter: 'sepia(0.15) contrast(1.05)',
              }}
            />
            <figcaption
              style={{
                fontSize: '0.8rem',
                fontStyle: 'italic',
                textAlign: 'center',
                borderTop: '1px solid #2b1f14',
                borderBottom: '1px solid #2b1f14',
                padding: '4px 0',
                marginTop: 4,
                color: '#2b1f14',
              }}
            >
              Orc fleet spotted in the Solnar, headed south.
            </figcaption>
          </figure>

          {/* Section (6) — Blood Moon */}
          {bloodMoonItem && (
            <article>
              <h3
                style={{
                  fontFamily: 'EB Garamond, serif',
                  fontWeight: 700,
                  fontSize: '1.2rem',
                  lineHeight: 1.15,
                  margin: '0 0 4px',
                  borderBottom: '1px solid #2b1f14',
                  paddingBottom: 3,
                }}
              >
                {bloodMoonItem.headline}
              </h3>
              <p style={{ fontSize: '0.85rem', lineHeight: 1.4, margin: 0, textAlign: 'justify' }}>
                {bloodMoonItem.body}
              </p>
            </article>
          )}

          {/* Section (7) — Spot Prices */}
          <aside
            style={{
              border: '1px solid #2b1f14',
              padding: '10px 12px',
              background: 'rgba(139,90,30,0.05)',
            }}
          >
            <div
              style={{
                fontFamily: 'EB Garamond, serif',
                fontSize: '0.72rem',
                textTransform: 'uppercase',
                letterSpacing: '0.22em',
                fontWeight: 700,
                color: '#2b1f14',
                textAlign: 'center',
                borderBottom: '1px solid #2b1f14',
                paddingBottom: 5,
                marginBottom: 8,
              }}
            >
              Spot Prices
            </div>
            {([
              { label: 'Gold',   unit: 'gp/oz', series: [52, 54, 53, 55, 58, 57, 60, 62, 61, 63, 65, 64], stroke: '#b08a1a' },
              { label: 'Silver', unit: 'sp/oz', series: [8, 9, 8, 10, 11, 10, 12, 11, 13, 12, 11, 12],     stroke: '#6a6a78' },
              { label: 'Copper', unit: 'cp/oz', series: [2, 3, 3, 2, 4, 3, 4, 5, 4, 4, 5, 6],              stroke: '#8a4a1a' },
            ] as const).map(({ label, unit, series, stroke }) => {
              const min = Math.min(...series);
              const max = Math.max(...series);
              const range = max - min || 1;
              const W = 100;
              const H = 24;
              const pts = series
                .map((v, i) => {
                  const x = (i / (series.length - 1)) * W;
                  const y = H - ((v - min) / range) * H;
                  return `${x.toFixed(1)},${y.toFixed(1)}`;
                })
                .join(' ');
              const last = series[series.length - 1];
              const prev = series[series.length - 2];
              const delta = ((last - prev) / prev) * 100;
              const deltaStr = `${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta).toFixed(1)}%`;
              const deltaColor = delta >= 0 ? '#2d6a3f' : '#8b1a1a';
              return (
                <div
                  key={label}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '48px 1fr auto',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 0',
                    fontSize: '0.72rem',
                    borderBottom: '1px dotted rgba(43,31,20,0.3)',
                  }}
                >
                  <div style={{ fontFamily: 'EB Garamond, serif', fontWeight: 700, color: '#2b1f14' }}>
                    {label}
                  </div>
                  <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" style={{ display: 'block' }}>
                    <polyline
                      points={pts}
                      fill="none"
                      stroke={stroke}
                      strokeWidth="1.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <div style={{ textAlign: 'right', color: '#2b1f14', whiteSpace: 'nowrap' }}>
                    <span style={{ fontWeight: 700 }}>{last}</span>{' '}
                    <span style={{ fontSize: '0.6rem', color: '#4a3723' }}>{unit}</span>{' '}
                    <span style={{ color: deltaColor, fontSize: '0.65rem' }}>{deltaStr}</span>
                  </div>
                </div>
              );
            })}
          </aside>

        </div>

        {/* Column 3: (3) Crimson Moon → (8) opinion placeholder */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Section (3) — Crimson Moon */}
          {crimsonMoonItem && (
            <article>
              <h3
                style={{
                  fontFamily: 'EB Garamond, serif',
                  fontWeight: 700,
                  fontSize: '1.15rem',
                  lineHeight: 1.15,
                  margin: '0 0 4px',
                  borderBottom: '1px solid #2b1f14',
                  paddingBottom: 3,
                }}
              >
                {crimsonMoonItem.headline}
              </h3>
              <p style={{ fontSize: '0.85rem', lineHeight: 1.4, margin: '0 0 6px', textAlign: 'justify' }}>
                {crimsonMoonItem.body}
              </p>
              <p style={{ fontSize: '0.85rem', lineHeight: 1.4, margin: 0, textAlign: 'justify' }}>
                Hedge-witches along the Whispering Coast report hearing the
                moon &#x201C;sing in a voice like cracking ice&#x201D; each
                midnight since the turning. Livestock have refused water drawn
                after dusk; a cooper in Threshwick swears his barrels hum when
                the crimson light touches them.
              </p>
            </article>
          )}
          {/* Section (8) — Opinion */}
          <article>
            <h3
              style={{
                fontFamily: 'EB Garamond, serif',
                fontWeight: 700,
                fontSize: '1.15rem',
                fontStyle: 'italic',
                lineHeight: 1.15,
                margin: '0 0 4px',
                borderBottom: '1px solid #2b1f14',
                paddingBottom: 3,
              }}
            >
              Opinion
            </h3>
            <p style={{ fontSize: '0.85rem', lineHeight: 1.4, margin: '0 0 6px', textAlign: 'justify' }}>
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Praesent
              egestas tristique nibh, nec condimentum lectus vulputate sed.
              Integer a lorem vitae mauris porta venenatis.
            </p>
            <p style={{ fontSize: '0.85rem', lineHeight: 1.4, margin: 0, textAlign: 'justify' }}>
              Curabitur non nulla sit amet nisl tempus convallis quis ac lectus.
              Donec sollicitudin molestie malesuada. Vivamus magna justo, lacinia
              eget consectetur sed, convallis at tellus. Cras ultricies ligula
              sed magna dictum porta. Pellentesque in ipsum id orci porta
              dapibus. Vestibulum ac diam sit amet quam vehicula elementum
              sed sit amet dui.
            </p>
          </article>
        </div>
      </div>

      {/* Bottom rule — echoes the masthead border */}
      <div style={{ marginTop: 4, borderTop: '4px double #2b1f14' }} />
    </div>
  );
}
