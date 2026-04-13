'use client';

import { useRef, useCallback, useState } from 'react';
import type { Player } from '@/lib/types';
import RavenWorldAiSuggestions, { type RavenWorldAiSuggestionsHandle } from './RavenWorldAiSuggestions';
import RavenManualCompose from './RavenManualCompose';
import RavenOverheardQueue from './RavenOverheardQueue';
import RavenPublishedItems from './RavenPublishedItems';

interface Props {
  players: Player[];
}

export default function RavenPostLayout({ players }: Props) {
  const aiRef = useRef<RavenWorldAiSuggestionsHandle>(null);
  const [publishedKey, setPublishedKey] = useState(0);

  const handlePublished = useCallback(() => {
    aiRef.current?.refresh();
    setPublishedKey(k => k + 1);
  }, []);

  return (
    <div className="space-y-6">
      {/* Row 1: World AI Suggestions | Manual Compose */}
      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <RavenWorldAiSuggestions ref={aiRef} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <RavenManualCompose
            players={players.filter(p => p.id !== 'dm')}
            onPublished={handlePublished}
          />
        </div>
      </div>

      {/* Row 2: Library Overheard Queue | Published Items */}
      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <RavenOverheardQueue />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <RavenPublishedItems key={publishedKey} />
        </div>
      </div>
    </div>
  );
}
