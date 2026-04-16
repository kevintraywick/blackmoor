'use client';

/**
 * Raven Post masthead — Edition Stamp + arrow + title + tagline + date row.
 *
 * Shared between the player-facing `RavenBroadsheet` and the DM-facing
 * broadsheet editor. Renders visually identically; the editor just wraps it
 * in its own layout. See DESIGN.md → "Raven Post Broadsheet — Layout 1 v1".
 */

interface Props {
  volume: number;
  issue: number;
  inFictionDate: string;
  /** Optional price line — defaults to "One copper" */
  price?: string;
}

export default function Masthead({ volume, issue, inFictionDate, price = 'One copper' }: Props) {
  return (
    <div
      className="raven-mast__root"
      style={{
        position: 'relative',
        textAlign: 'center',
        paddingBottom: 14,
        marginBottom: 18,
        borderBottom: '4px double #2b1f14',
      }}
    >
      {/* Edition Stamp — circular wax stamp at top-right of sheet */}
      <div
        className="raven-mast__stamp"
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
        <svg viewBox="0 0 120 120" width="100%" height="100%" style={{ overflow: 'visible', display: 'block' }}>
          <defs>
            <path id="stamp-curve" d="M 60,60 m -40,0 a 40,40 0 1,1 80,0 a 40,40 0 1,1 -80,0" fill="none" />
          </defs>
          <circle cx="60" cy="60" r="36" fill="none" stroke="#7b1a1a" strokeWidth="1.5" />
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

      {/* Arrow piercing the masthead */}
      <img
        className="raven-mast__arrow"
        src="/images/raven-post/arrow.png"
        alt=""
        aria-hidden
        style={{
          position: 'absolute',
          width: 130,
          bottom: -6,
          left: '68%',
          zIndex: 0,
          pointerEvents: 'none',
          opacity: 0.92,
          filter: 'drop-shadow(1px 2px 1px rgba(0,0,0,0.35))',
          transform: 'rotate(6deg)',
        }}
      />

      <div style={{ position: 'relative', zIndex: 1, height: 1, background: '#2b1f14', margin: '0 auto 10px', width: '92%', opacity: 0.8 }} />

      <h1
        className="raven-mast__title"
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
        <span className="raven-mast__tagline-rule" style={{ flex: 1, height: 1, background: '#2b1f14', opacity: 0.55, maxWidth: 220 }} />
        <span
          className="raven-mast__tagline-text"
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
        <span className="raven-mast__tagline-rule" style={{ flex: 1, height: 1, background: '#2b1f14', opacity: 0.55, maxWidth: 220 }} />
      </div>

      <div
        className="raven-mast__daterow"
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
        <span>{price}</span>
      </div>
    </div>
  );
}
