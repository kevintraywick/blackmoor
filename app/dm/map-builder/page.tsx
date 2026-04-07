export const dynamic = 'force-dynamic';

import DmNav from '@/components/DmNav';
import MapBuilderClient from '@/components/MapBuilderClient';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import type { MapBuild } from '@/lib/types';

export default async function MapBuilderPage() {
  await ensureSchema();
  const builds = await query<MapBuild>(
    'SELECT * FROM map_builds ORDER BY updated_at DESC'
  );

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
      <DmNav current="map-builder" />
      <MapBuilderClient initialBuilds={builds} />
    </div>
  );
}
