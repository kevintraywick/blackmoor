export const dynamic = 'force-dynamic';

import DmNav from '@/components/DmNav';
import RavenPostLayout from '@/components/dm/RavenPostLayout';
import { getPlayers } from '@/lib/getPlayers';

export default async function DmRavenPostPage() {
  const players = await getPlayers();

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
      <DmNav current="raven-post" />

      <div className="max-w-[1000px] mx-auto px-8 py-10">
        <RavenPostLayout players={players} />
      </div>
    </div>
  );
}
