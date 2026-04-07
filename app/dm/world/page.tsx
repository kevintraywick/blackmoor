export const dynamic = 'force-dynamic';

import { ensureSchema } from '@/lib/schema';
import { getWorldMap, listHexes } from '@/lib/world';
import DmNav from '@/components/DmNav';
import WorldMapClient from '@/components/WorldMapClient';

export default async function WorldMapPage() {
  await ensureSchema();
  const [world, hexes] = await Promise.all([getWorldMap(), listHexes()]);

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
      <DmNav current="world" />
      <WorldMapClient world={world} initialHexes={hexes} />
    </div>
  );
}
