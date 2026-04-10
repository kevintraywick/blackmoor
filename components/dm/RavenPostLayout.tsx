'use client';

import { useRef } from 'react';
import type { Player } from '@/lib/types';
import RavenWorldAiSuggestions, { type RavenWorldAiSuggestionsHandle } from './RavenWorldAiSuggestions';
import RavenManualCompose from './RavenManualCompose';

interface Props {
  players: Player[];
}

export default function RavenPostLayout({ players }: Props) {
  const aiRef = useRef<RavenWorldAiSuggestionsHandle>(null);

  return (
    <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <RavenWorldAiSuggestions ref={aiRef} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <RavenManualCompose
          players={players.filter(p => p.id !== 'dm')}
          onPublished={() => aiRef.current?.refresh()}
        />
      </div>
    </div>
  );
}
