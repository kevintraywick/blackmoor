'use client';

import { useRef, useCallback, useState } from 'react';
import type { Player } from '@/lib/types';
import RavenWorldAiSuggestions, { type RavenWorldAiSuggestionsHandle } from './RavenWorldAiSuggestions';
import RavenManualCompose, { type RavenManualComposeHandle } from './RavenManualCompose';
import RavenBroadsheetPreview from './RavenBroadsheetPreview';

interface Props {
  players: Player[];
}

export default function RavenPostLayout({ players }: Props) {
  const aiRef = useRef<RavenWorldAiSuggestionsHandle>(null);
  const composeRef = useRef<RavenManualComposeHandle>(null);

  const [manualHeadline, setManualHeadline] = useState('');
  const [manualBody, setManualBody] = useState('');
  const [manualPublishing, setManualPublishing] = useState(false);

  const [aiHeadline, setAiHeadline] = useState('');
  const [aiBody, setAiBody] = useState('');
  const [aiPublishing, setAiPublishing] = useState(false);

  const handlePublished = useCallback(() => {
    aiRef.current?.refresh();
    setManualHeadline('');
    setManualBody('');
  }, []);

  const handleAiPreview = useCallback((headline: string, body: string) => {
    setAiHeadline(headline);
    setAiBody(body);
  }, []);

  async function publishManual() {
    setManualPublishing(true);
    try {
      await composeRef.current?.publish();
    } finally {
      setManualPublishing(false);
    }
  }

  async function publishAi() {
    setAiPublishing(true);
    try {
      await aiRef.current?.publishFocused();
    } finally {
      setAiPublishing(false);
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
      {/* R1C1: Manual Compose */}
      <div>
        <RavenManualCompose
          ref={composeRef}
          players={players.filter(p => p.id !== 'dm')}
          onPublished={handlePublished}
          onHeadlineChange={setManualHeadline}
          onBodyChange={setManualBody}
        />
      </div>

      {/* R1C2: Live preview + publish */}
      <div>
        <RavenBroadsheetPreview headline={manualHeadline} body={manualBody} />
        <button
          onClick={publishManual}
          disabled={manualPublishing || (!manualHeadline.trim() && !manualBody.trim())}
          className="font-serif"
          style={{
            marginTop: 8,
            background: 'transparent',
            border: 'none',
            color: '#ffffff',
            fontSize: '0.85rem',
            cursor: 'pointer',
            textTransform: 'uppercase' as const,
            letterSpacing: '0.12em',
            display: 'block',
            marginLeft: 'auto',
            opacity: (!manualHeadline.trim() && !manualBody.trim()) ? 0.3 : 1,
            padding: 0,
          }}
        >
          {manualPublishing ? 'Publishing…' : 'Publish →'}
        </button>
      </div>

      {/* R2C1: World AI Suggestions */}
      <div>
        <RavenWorldAiSuggestions ref={aiRef} onPreviewChange={handleAiPreview} />
      </div>

      {/* R2C2: Live preview + publish */}
      <div>
        <RavenBroadsheetPreview headline={aiHeadline} body={aiBody} />
        <button
          onClick={publishAi}
          disabled={aiPublishing || (!aiHeadline.trim() && !aiBody.trim())}
          className="font-serif"
          style={{
            marginTop: 8,
            background: 'transparent',
            border: 'none',
            color: '#ffffff',
            fontSize: '0.85rem',
            cursor: 'pointer',
            textTransform: 'uppercase' as const,
            letterSpacing: '0.12em',
            display: 'block',
            marginLeft: 'auto',
            opacity: (!aiHeadline.trim() && !aiBody.trim()) ? 0.3 : 1,
            padding: 0,
          }}
        >
          {aiPublishing ? 'Publishing…' : 'Publish →'}
        </button>
      </div>
    </div>
  );
}
