'use client';

/**
 * Live mini-broadsheet preview — renders headline + body on parchment
 * as the DM types. Used in column 2 of the DM Raven Post page.
 */

interface Props {
  headline: string;
  body: string;
}

export default function RavenBroadsheetPreview({ headline, body }: Props) {
  const hasContent = headline.trim() || body.trim();

  return (
    <div
      className="font-serif"
      style={{
        background: '#efe3c4',
        backgroundImage:
          'radial-gradient(circle at 20% 10%, rgba(139,90,30,0.08), transparent 50%),' +
          'radial-gradient(circle at 80% 90%, rgba(139,90,30,0.10), transparent 55%)',
        border: '1px solid #d9c89a',
        padding: '20px 24px',
        color: '#2b1f14',
        boxShadow: '0 4px 16px rgba(43,31,20,0.25), inset 0 0 60px rgba(139,90,30,0.06)',
        minHeight: 180,
      }}
    >
      {/* Mini masthead */}
      <div style={{ textAlign: 'center', borderBottom: '2px double #2b1f14', paddingBottom: 8, marginBottom: 12 }}>
        <h2 style={{
          fontFamily: 'UnifrakturMaguntia, "EB Garamond", serif',
          fontSize: '1.4rem',
          letterSpacing: '0.04em',
          margin: 0,
        }}>
          The Raven Post
        </h2>
        <div style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.25em', color: '#4a3723', marginTop: 2 }}>
          Preview
        </div>
      </div>

      {!hasContent ? (
        <p style={{ fontStyle: 'italic', color: '#8a7a60', fontSize: '0.85rem', textAlign: 'center', marginTop: 24 }}>
          Start typing to see a preview...
        </p>
      ) : (
        <article>
          {headline.trim() && (
            <h3
              style={{
                fontFamily: 'EB Garamond, serif',
                fontWeight: 700,
                fontSize: '1.3rem',
                lineHeight: 1.15,
                margin: '0 0 6px',
                borderBottom: '1px solid #2b1f14',
                paddingBottom: 4,
              }}
            >
              {headline}
            </h3>
          )}
          {body.trim() && (
            <p style={{
              fontSize: '0.85rem',
              lineHeight: 1.45,
              margin: 0,
              textAlign: 'justify',
            }}>
              {body}
            </p>
          )}
        </article>
      )}
    </div>
  );
}
