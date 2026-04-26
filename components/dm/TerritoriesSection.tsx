import Link from 'next/link';
import { query } from '@/lib/db';

interface Row {
  id: string;
  name: string;
  image_path: string | null;
  h3_cell: string | null;
  updated_at: number;
  session_number: number | null;
  session_title: string | null;
}

export default async function TerritoriesSection() {
  const rows = await query<Row>(
    `SELECT b.id, b.name, b.image_path, b.h3_cell::text AS h3_cell, b.updated_at,
            s.number AS session_number, s.title AS session_title
     FROM map_builds b
     LEFT JOIN sessions s ON s.id = b.session_id
     WHERE b.h3_cell IS NOT NULL
     ORDER BY b.updated_at DESC`,
  );

  return (
    <div className="max-w-[1000px] mx-auto px-8 pb-12">
      <div
        className="text-[0.7rem] uppercase tracking-[0.15em] font-sans"
        style={{ color: '#c9a84c', marginBottom: 12 }}
      >
        Territories — {rows.length}
      </div>
      {rows.length === 0 ? (
        <div
          className="text-sm italic font-serif"
          style={{ color: 'var(--color-text-muted)' }}
        >
          No maps placed on the world yet. Drag a map onto a hex on the{' '}
          <Link href="/dm/globe" style={{ color: '#c9a84c', textDecoration: 'underline' }}>
            globe
          </Link>
          .
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: 16,
          }}
        >
          {rows.map(r => (
            <Link
              key={r.id}
              href={`/dm/map-builder?build=${r.id}&placement=1`}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                background: 'var(--color-bg-card)',
                border: '1px solid var(--color-border)',
                borderRadius: 4,
                padding: 10,
                textDecoration: 'none',
                color: 'var(--color-text)',
                transition: 'border-color 0.15s ease, transform 0.15s ease',
              }}
              className="hover:border-[#c9a84c]"
            >
              <div
                style={{
                  width: '100%',
                  aspectRatio: '1 / 1',
                  background: '#1a1614',
                  border: '1px solid #2a221d',
                  borderRadius: 2,
                  overflow: 'hidden',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {r.image_path ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/map-builder/${r.id}/image`}
                    alt={r.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <span
                    className="font-sans uppercase tracking-[0.15em]"
                    style={{ color: '#5a4f46', fontSize: 10 }}
                  >
                    no image
                  </span>
                )}
              </div>
              <div className="font-serif" style={{ fontSize: 14, lineHeight: 1.2 }}>
                {r.name || 'Untitled Map'}
              </div>
              {r.session_number !== null && (
                <div
                  className="font-sans uppercase tracking-[0.12em]"
                  style={{ color: 'var(--color-text-muted)', fontSize: 10 }}
                >
                  S{r.session_number}
                  {r.session_title ? ` — ${r.session_title}` : ''}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
