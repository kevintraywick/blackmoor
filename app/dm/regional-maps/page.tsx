export const dynamic = 'force-dynamic';

import Link from 'next/link';
import DmNav from '@/components/DmNav';
import RegionalMapsListClient from '@/components/dm/RegionalMapsListClient';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';

interface RegionalRow {
  id: string;
  name: string;
  image_path: string | null;
  image_width_px: number | null;
  image_height_px: number | null;
  mirror_horizontal: boolean;
  updated_at: number;
  anchor_count: number;
}

export default async function RegionalMapsPage() {
  await ensureSchema();
  const rows = await query<RegionalRow>(
    `SELECT b.id, b.name, b.image_path, b.image_width_px, b.image_height_px,
            b.mirror_horizontal, b.updated_at,
            (SELECT COUNT(*)::int FROM regional_map_anchors WHERE build_id = b.id) AS anchor_count
       FROM map_builds b
      WHERE b.map_role = 'regional'
      ORDER BY b.updated_at DESC`,
  );

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
      <DmNav current="regional-maps" />
      <div className="max-w-[1000px] mx-auto px-8 py-10">
        <div
          className="text-[0.7rem] uppercase tracking-[0.15em] font-sans"
          style={{ color: '#7ac2ff', marginBottom: 4 }}
        >
          Regional Maps — {rows.length}
        </div>
        <p
          className="font-serif"
          style={{ color: 'var(--color-text-muted)', fontSize: 14, marginBottom: 18 }}
        >
          The intermediate tier between a world hex (~45 km) and a room map (5 ft).
          Anchored to the real world by two named features.
        </p>

        <RegionalMapsListClient />

        {rows.length === 0 ? (
          <div
            className="font-serif italic mt-6"
            style={{ color: 'var(--color-text-muted)' }}
          >
            No regional maps yet. Drop one above to get started.
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: 16,
              marginTop: 20,
            }}
          >
            {rows.map(r => (
              <Link
                key={r.id}
                href={`/dm/regional-maps/${r.id}`}
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
                }}
                className="hover:border-[#7ac2ff]"
              >
                <div
                  style={{
                    width: '100%',
                    aspectRatio: '11 / 17',
                    background: '#0d1220',
                    border: '1px solid #1a2540',
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
                    <span className="font-sans uppercase tracking-[0.15em]" style={{ color: '#3a4a70', fontSize: 10 }}>
                      no image
                    </span>
                  )}
                </div>
                <div className="font-serif" style={{ fontSize: 14, lineHeight: 1.2 }}>
                  {r.name || 'Untitled Regional Map'}
                </div>
                <div
                  className="font-sans uppercase tracking-[0.12em]"
                  style={{ color: 'var(--color-text-muted)', fontSize: 10 }}
                >
                  {r.anchor_count} {r.anchor_count === 1 ? 'anchor' : 'anchors'}
                  {r.mirror_horizontal ? ' · mirrored' : ''}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
