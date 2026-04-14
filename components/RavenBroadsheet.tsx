'use client';

/**
 * The Raven Post — Broadsheet Layout 1, v1
 *
 * Front-page broadsheet rendered as a 3-equal-column grid (1fr 1fr 1fr).
 * See DESIGN.md → "Raven Post Broadsheet — Layout 1 v1" for the section map
 * and slotting rules.
 *
 *   (1) Masthead (edition stamp, piercing arrow, title, tagline, date/price)
 *   ─────────────────────────────────
 *   (2) BIG HEADLINE (page-width, uppercase)
 *   ─────────────────────────────────
 *   Col 1             Col 2              Col 3
 *   (3) lorem         (4) image          (6) Crimson Moon
 *                     (5) caption
 *   (8) ad image      (7) Blood Moon     (11) Opinion
 *   (10) Q.o.t.Day    (9) Spot Prices
 *   ─────────────────────────────────
 *
 * Columns stretch to equal height. QOTD (10) and Spot Prices (9) use
 * `marginTop: auto` to pin to column bottoms so they always align.
 * Items slot into (6) / (7) by headline regex match on the `broadsheet`-
 * medium raven_items rows.
 */

import type { RavenItem, RavenWeatherRow } from '@/lib/types';
import Masthead from './raven/Masthead';
import SpotPrices from './raven/SpotPrices';

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
      <Masthead volume={volume} issue={issue} inFictionDate={inFictionDate} />

      {/* Section (2) — Big Headline, front-page page-width */}
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
        {/* Column 1: (3) lead text → (8) ad → (10) QOTD */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Section (3) — lead text */}
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

          {/* Section (8) — Chaos Engine dice ad */}
          <div
            style={{
              fontFamily: 'EB Garamond, serif',
              fontSize: '0.55rem',
              textTransform: 'uppercase',
              letterSpacing: '0.25em',
              textAlign: 'center',
              color: '#4a3723',
              marginBottom: -10,
            }}
          >
            Paid Advertisement
          </div>
          <a
            href="https://dnddice.com/products/chaos-engine-dice-set-limited-edition"
            target="_blank"
            rel="noopener noreferrer"
            title="Chaos Engine Dice Set — Limited Edition"
            style={{ display: 'block', position: 'relative' }}
          >
            <img
              src="/images/ads/dnddice_ad.jpg"
              alt="Chaos Engine Dice Set — Limited Edition"
              style={{
                display: 'block',
                width: '100%',
                height: 180,
                objectFit: 'cover',
                border: '1px solid #2b1f14',
                filter: 'brightness(0.8)',
              }}
            />
            <span
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                fontFamily: '"Playfair Display", "EB Garamond", serif',
                fontSize: '2.2rem',
                fontWeight: 900,
                letterSpacing: '0.02em',
                textShadow: '0 2px 6px rgba(0,0,0,0.7), 0 0 2px rgba(0,0,0,0.9)',
                transform: 'rotate(-15deg)',
                pointerEvents: 'none',
              }}
            >
              ONLY $15!!!
            </span>
          </a>

          {/* Section (10) — Quote of the Day — pinned to column bottom */}
          <aside
            style={{
              border: '1px solid #2b1f14',
              padding: '8px 10px',
              textAlign: 'center',
              background: 'rgba(139,90,30,0.05)',
              marginTop: 'auto',
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

        {/* Column 2: (4) image + (5) caption → (7) Blood Moon → (9) Spot Prices */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Section (4) image + (5) caption */}
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

          {/* Section (7) — Blood Moon */}
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

          {/* Section (9) — Spot Prices — pinned to column bottom */}
          <SpotPrices style={{ marginTop: 'auto' }} />

        </div>

        {/* Column 3: (6) Crimson Moon → (11) Opinion */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Section (6) — Crimson Moon */}
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
          {/* Section (11) — Opinion */}
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
