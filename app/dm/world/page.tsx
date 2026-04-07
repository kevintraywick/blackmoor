export const dynamic = 'force-dynamic';

import { ensureSchema } from '@/lib/schema';
import { getWorldMap, listHexes, listEntities } from '@/lib/world';
import { getGameClock } from '@/lib/game-clock';
import DmNav from '@/components/DmNav';
import WorldMapClient from '@/components/WorldMapClient';

export default async function WorldMapPage() {
  await ensureSchema();
  const [world, hexes, entities, clock] = await Promise.all([
    getWorldMap(),
    listHexes(),
    listEntities(),
    getGameClock(),
  ]);

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
      <DmNav current="world" />
      <WorldMapClient
        world={world}
        initialHexes={hexes}
        initialEntities={entities}
        initialClock={clock}
      />
    </div>
  );
}
