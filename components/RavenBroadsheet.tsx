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

      {/* Section (2) — Big Headline */}
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
        {bigHeadline}
      </h2>

      {/* 3-column grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: 18,
          marginBottom: 18,
          alignItems: 'stretch',
        }}
      >
        {/* Column 1 — (3) lead text → (8) ad → (10) QOTD */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Section (3) — lead text */}
          <div style={{ fontSize: '0.88rem', lineHeight: 1.5, textAlign: 'justify' }}>
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

          {/* Section (8) — ad */}
          {a.ad && (
            <>
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
            </>
          )}

          {/* Section (10) — QOTD — pinned to column bottom */}
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

        {/* Column 2 — (4) image + (5) caption → (7) Blood Moon → (9) Spot Prices */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Section (4) + (5) */}
          {a.heroImageUrl && (
            <figure style={{ margin: 0 }}>
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

          {/* Section (9) — Spot Prices */}
          <SpotPrices style={{ marginTop: 'auto' }} />
        </div>

        {/* Column 3 — (6) Crimson Moon → (11) Opinion */}
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
        </div>
      </div>

      {/* Bottom rule */}
      <div style={{ marginTop: 4, borderTop: '4px double #2b1f14' }} />
    </div>
  );
}
