export const dynamic = 'force-dynamic';

import DmNav from '@/components/DmNav';
import RavenWorldAiSuggestions from '@/components/dm/RavenWorldAiSuggestions';
import RavenManualCompose from '@/components/dm/RavenManualCompose';
import RavenOverheardQueue from '@/components/dm/RavenOverheardQueue';
import RavenPublishedItems from '@/components/dm/RavenPublishedItems';
import { getPlayers } from '@/lib/getPlayers';

export default async function DmRavenPostPage() {
  const players = await getPlayers();

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
      <DmNav current="raven-post" />

      <div className="max-w-[1000px] mx-auto px-8 py-10 space-y-8">
        <header>
          <h1 className="font-serif text-2xl text-[var(--color-gold)]">The Raven Post</h1>
          <p className="text-sm text-[var(--color-text-muted)] italic mt-1">
            Compose a beat. Queue an overheard. Edit a published item.
          </p>
        </header>

        <RavenWorldAiSuggestions />
        <RavenManualCompose players={players.filter(p => p.id !== 'dm')} />
        <RavenOverheardQueue />
        <RavenPublishedItems />
      </div>
    </div>
  );
}
