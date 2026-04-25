export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import DmNav from '@/components/DmNav';
import RegionalMapEditor from '@/components/dm/RegionalMapEditor';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import type { RegionalMapAnchor } from '@/lib/types';

interface BuildRow {
  id: string;
  name: string;
  image_path: string | null;
  image_width_px: number | null;
  image_height_px: number | null;
  mirror_horizontal: boolean;
}

export default async function RegionalMapPage({ params }: { params: Promise<{ id: string }> }) {
  await ensureSchema();
  const { id } = await params;

  const [build] = await query<BuildRow>(
    `SELECT id, name, image_path, image_width_px, image_height_px, mirror_horizontal
       FROM map_builds WHERE id = $1 AND map_role = 'regional'`,
    [id],
  );
  if (!build) notFound();

  const anchors = await query<RegionalMapAnchor>(
    `SELECT id, build_id, feature_name, image_px_x, image_px_y,
            real_lat, real_lng, sort_order, created_at
       FROM regional_map_anchors
      WHERE build_id = $1
      ORDER BY sort_order, created_at`,
    [id],
  );

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
      <DmNav current="regional-maps" />
      <RegionalMapEditor build={build} initialAnchors={anchors} />
    </div>
  );
}
