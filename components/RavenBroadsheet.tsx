'use client';

/**
 * The Raven Post — Broadsheet Layout 1, v1
 *
 * Front-page broadsheet rendered as a 3-equal-column grid (1fr 1fr 1fr).
 * See DESIGN.md → "Raven Post Broadsheet — Layout 1 v1" for the section map.
 *
 *   (1) Masthead (edition stamp, piercing arrow, title, tagline, date/price)
 *   ─────────────────────────────────
 *   (2) BIG HEADLINE (page-width, uppercase)
 *   ─────────────────────────────────
 *   Col 1             Col 2              Col 3
 *   (3) lead text     (4) image          (6) Crimson Moon
 *                     (5) caption
 *   (8) ad image      (7) Blood Moon     (11) Opinion
 *   (10) Q.o.t.Day    (9) Spot Prices
 *   ─────────────────────────────────
 *
 * Slotting:
 *   - Prose items (3, 6, 7, 11) come from `items` — filtered by
 *     `medium='broadsheet'`, slotted by `section_id` (primary) or by
 *     headline-regex match (legacy rows with section_id=null).
 *   - Big Headline (2), Hero image + caption (4/5), Ad (8), and QOTD (10)
 *     come from the `assembly` prop (the published issue's non-prose
 *     assembly record). When `assembly` is omitted, the component falls
 *     back to Layout 1 v1 hardcoded defaults so the page renders before
 *     the first publish.
 */

import type { RavenItem, RavenSectionId, RavenWeatherRow } from '@/lib/types';
import Masthead from './raven/Masthead';
import SpotPrices from './raven/SpotPrices';

// Non-prose assembly for one issue — what raven_issues stores.
export interface IssueAssembly {
  bigHeadline: string;
  heroImageUrl: string | null;
  heroCaption: string;
  ad: {
    imageUrl: string;
    link: string;
    overlay: string;
  } | null;
  qotd: {
    text: string;
    author: string;
  };
}

const DEFAULT_ASSEMBLY: IssueAssembly = {
  bigHeadline: 'Orc Invasion',
  heroImageUrl: '/images/raven-post/orc_fleet.jpg',
  heroCaption: 'Orc fleet spotted in the Solnar, headed south.',
  ad: {
    imageUrl: '/images/ads/dnddice_ad.jpg',
    link: 'https://dnddice.com/products/chaos-engine-dice-set-limited-edition',
    overlay: 'ONLY $15!!!',
  },
  qotd: {
    text: 'All that we see or seem is but a dream within a dream.',
    author: 'Edgar Allan Poe',
  },
};

const LEAD_LOREM = [
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.',
  'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.',
  'Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.',
];

const OPINION_LOREM = [
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Praesent egestas tristique nibh, nec condimentum lectus vulputate sed. Integer a lorem vitae mauris porta venenatis.',
  'Curabitur non nulla sit amet nisl tempus convallis quis ac lectus. Donec sollicitudin molestie malesuada. Vivamus magna justo, lacinia eget consectetur sed, convallis at tellus. Cras ultricies ligula sed magna dictum porta. Pellentesque in ipsum id orci porta dapibus. Vestibulum ac diam sit amet quam vehicula elementum sed sit amet dui.',
];

// Legacy headline regex — only consulted when section_id is null.
const LEGACY_HEADLINE_REGEX: Partial<Record<RavenSectionId, RegExp>> = {
  blood_moon: /blood\s*moon/i,
  crimson_moon: /crimson\s*moon/i,
};

/**
 * Layout CSS. Items are direct grid children; `grid-template-areas` places
 * them into the 3-column desktop layout regardless of DOM order. DOM order
 * matches the mobile reading order (hero → lead → crimson → blood → opinion
 * → spot → ad → QOTD), so on mobile we just collapse to a single column.
 *
 * `align-self: end` on QOTD and Spot Prices pins them to the bottom of the
 * stretched final row (mimicking the original `marginTop: auto`).
 */
const LAYOUT_CSS = `
.raven-bs__grid {
  grid-template-areas:
    "lead hero  crimson"
    "ad   blood opinion"
    "qotd spot  .";
  grid-template-rows: auto auto 1fr;
}
.raven-bs__lead        { grid-area: lead; }
.raven-bs__hero        { grid-area: hero; }
.raven-bs__crimsonmoon { grid-area: crimson; }
.raven-bs__ad          { grid-area: ad; }
.raven-bs__bloodmoon   { grid-area: blood; }
.raven-bs__opinion     { grid-area: opinion; }
.raven-bs__qotd        { grid-area: qotd; align-self: end; }
.raven-bs__spotprices  { grid-area: spot; align-self: end; }

@media (max-width: 640px) {
  .raven-bs__root {
    padding: 16px 14px !important;
    box-shadow: 0 4px 12px rgba(43,31,20,0.3), inset 0 0 60px rgba(139,90,30,0.08) !important;
  }
  .raven-bs__big-headline {
    font-size: 1.9rem !important;
    line-height: 1.0 !important;
    margin: 0 0 12px !important;
    padding-bottom: 8px !important;
    letter-spacing: 0 !important;
  }
  .raven-bs__grid {
    grid-template-columns: 1fr !important;
    grid-template-areas: none !important;
    grid-template-rows: none !important;
    gap: 16px !important;
    margin-bottom: 14px !important;
  }
  .raven-bs__lead, .raven-bs__hero, .raven-bs__crimsonmoon, .raven-bs__ad,
  .raven-bs__bloodmoon, .raven-bs__opinion, .raven-bs__qotd, .raven-bs__spotprices {
    grid-area: auto !important;
    align-self: auto !important;
  }
  .raven-bs__lead { font-size: 1rem !important; line-height: 1.55 !important; }
  .raven-bs__crimsonmoon p,
  .raven-bs__bloodmoon  p,
  .raven-bs__opinion    p {
    font-size: 0.98rem !important;
    line-height: 1.5 !important;
  }
  .raven-bs__crimsonmoon h3,
  .raven-bs__bloodmoon  h3,
  .raven-bs__opinion    h3 {
    font-size: 1.3rem !important;
  }

  /* Masthead shrink */
  .raven-mast__root {
    padding-bottom: 10px !important;
    margin-bottom: 12px !important;
  }
  .raven-mast__title {
    font-size: 2.4rem !important;
    line-height: 0.95 !important;
  }
  .raven-mast__stamp {
    width: 70px !important;
    height: 70px !important;
    top: -8px !important;
    right: -2px !important;
  }
  .raven-mast__arrow { display: none !important; }
  .raven-mast__tagline-text {
    font-size: 0.6rem !important;
    letter-spacing: 0.18em !important;
    white-space: normal !important;
  }
  .raven-mast__tagline-rule { display: none !important; }
  .raven-mast__daterow {
    font-size: 0.78rem !important;
    margin-top: 8px !important;
  }

  /* Mobile: shift the ad overlay down so it stops obscuring the image center */
  .raven-bs__ad-overlay {
    align-items: flex-end !important;
    padding-bottom: 14px !important;
  }
}
`;

function bySection(items: RavenItem[], id: RavenSectionId): RavenItem | undefined {
  const direct = items.find(i => i.section_id === id);
  if (direct) return direct;
  const legacy = LEGACY_HEADLINE_REGEX[id];
  if (!legacy) return undefined;
  return items.find(i => i.section_id == null && legacy.test(i.headline ?? ''));
}

interface Props {
  items: RavenItem[];
  weather: RavenWeatherRow;
  volume: number;
  issue: number;
  inFictionDate: string;
  /** The published issue's non-prose assembly. Omit to render hardcoded v1 defaults. */
  assembly?: IssueAssembly;
}

export default function RavenBroadsheet({ items, volume, issue, inFictionDate, assembly }: Props) {
  const broadsheetItems = items.filter(i => i.medium === 'broadsheet');

  const bigHeadlineItem = bySection(broadsheetItems, 'big_headline');
  const col1LeadItem = bySection(broadsheetItems, 'col1_lead');
  const bloodMoonItem = bySection(broadsheetItems, 'blood_moon');
  const crimsonMoonItem = bySection(broadsheetItems, 'crimson_moon');
  const opinionItem = bySection(broadsheetItems, 'opinion');

  const a = assembly ?? DEFAULT_ASSEMBLY;

  // Big headline: assembly overrides; item next; hardcoded last.
  const bigHeadline = (assembly?.bigHeadline || bigHeadlineItem?.headline || DEFAULT_ASSEMBLY.bigHeadline).trim();

  return (
    <div
      className="font-serif raven-bs__root"
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
      <style>{LAYOUT_CSS}</style>
      <Masthead volume={volume} issue={issue} inFictionDate={inFictionDate} />

      {/* Section (2) — Big Headline */}
      <h2
        className="raven-bs__big-headline"
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
        {bigHeadline}
      </h2>

      {/* Flat grid — items placed via grid-template-areas (LAYOUT_CSS) on
          desktop; collapse to single column in DOM order on mobile. DOM order
          here matches mobile reading order. */}
      <div
        className="raven-bs__grid"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: 18,
          marginBottom: 18,
          alignItems: 'stretch',
        }}
      >
        {/* Section (4) + (5) — hero image + caption */}
        {a.heroImageUrl && (
          <figure className="raven-bs__hero" style={{ margin: 0 }}>
            <img
              src={a.heroImageUrl}
              alt=""
              style={{
                display: 'block',
                width: '100%',
                height: 'auto',
                border: '1px solid #2b1f14',
                filter: 'sepia(0.15) contrast(1.05)',
              }}
            />
            {a.heroCaption && (
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
                {a.heroCaption}
              </figcaption>
            )}
          </figure>
        )}

        {/* Section (3) — lead text */}
        <div className="raven-bs__lead" style={{ fontSize: '0.88rem', lineHeight: 1.5, textAlign: 'justify' }}>
          {col1LeadItem ? (
            <>
              {col1LeadItem.headline && (
                <h3
                  style={{
                    fontFamily: 'EB Garamond, serif',
                    fontWeight: 700,
                    fontSize: '1.05rem',
                    lineHeight: 1.15,
                    margin: '0 0 4px',
                    borderBottom: '1px solid #2b1f14',
                    paddingBottom: 3,
                  }}
                >
                  {col1LeadItem.headline}
                </h3>
              )}
              {col1LeadItem.body.split(/\n{2,}/).map((para, idx) => (
                <p key={idx} style={{ margin: idx === 0 ? '0 0 8px' : '0 0 8px' }}>
                  {para}
                </p>
              ))}
            </>
          ) : (
            LEAD_LOREM.map((p, i) => (
              <p key={i} style={{ margin: i === LEAD_LOREM.length - 1 ? 0 : '0 0 8px' }}>{p}</p>
            ))
          )}
        </div>

        {/* Section (6) — Crimson Moon */}
        {crimsonMoonItem && (
          <article className="raven-bs__crimsonmoon">
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
            {crimsonMoonItem.body.split(/\n{2,}/).map((para, idx) => (
              <p
                key={idx}
                style={{
                  fontSize: '0.85rem',
                  lineHeight: 1.4,
                  margin: idx === 0 ? '0 0 6px' : '0 0 6px',
                  textAlign: 'justify',
                }}
              >
                {para}
              </p>
            ))}
          </article>
        )}

        {/* Section (7) — Blood Moon */}
        {bloodMoonItem && (
          <article className="raven-bs__bloodmoon">
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

        {/* Section (11) — Opinion */}
        <article className="raven-bs__opinion">
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
            {opinionItem?.headline || 'Opinion'}
          </h3>
          {opinionItem ? (
            opinionItem.body.split(/\n{2,}/).map((para, idx, arr) => (
              <p
                key={idx}
                style={{
                  fontSize: '0.85rem',
                  lineHeight: 1.4,
                  margin: idx === arr.length - 1 ? 0 : '0 0 6px',
                  textAlign: 'justify',
                }}
              >
                {para}
              </p>
            ))
          ) : (
            OPINION_LOREM.map((p, i) => (
              <p
                key={i}
                style={{
                  fontSize: '0.85rem',
                  lineHeight: 1.4,
                  margin: i === OPINION_LOREM.length - 1 ? 0 : '0 0 6px',
                  textAlign: 'justify',
                }}
              >
                {p}
              </p>
            ))
          )}
        </article>

        {/* Section (9) — Spot Prices */}
        <SpotPrices className="raven-bs__spotprices" />

        {/* Section (8) — ad */}
        {a.ad && (
          <div className="raven-bs__ad" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
              href={a.ad.link}
              target="_blank"
              rel="noopener noreferrer"
              title={a.ad.overlay || 'Sponsored'}
              style={{ display: 'block', position: 'relative' }}
            >
              <img
                src={a.ad.imageUrl}
                alt=""
                style={{
                  display: 'block',
                  width: '100%',
                  height: 180,
                  objectFit: 'cover',
                  border: '1px solid #2b1f14',
                  filter: 'brightness(0.8)',
                }}
              />
              {a.ad.overlay && (
                <span
                  className="raven-bs__ad-overlay"
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
                  {a.ad.overlay}
                </span>
              )}
            </a>
          </div>
        )}

        {/* Section (10) — QOTD */}
        <aside
          className="raven-bs__qotd"
          style={{
            border: '1px solid #2b1f14',
            padding: '8px 10px',
            textAlign: 'center',
            background: 'rgba(139,90,30,0.05)',
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
            “{a.qotd.text}”
            <footer
              style={{
                fontStyle: 'normal',
                fontSize: '0.68rem',
                marginTop: 4,
                letterSpacing: '0.05em',
                color: '#4a3723',
              }}
            >
              — {a.qotd.author}
            </footer>
          </blockquote>
        </aside>
      </div>

      {/* Bottom rule */}
      <div style={{ marginTop: 4, borderTop: '4px double #2b1f14' }} />
    </div>
  );
}
