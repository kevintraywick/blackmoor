'use client';

import { useState, forwardRef, useImperativeHandle } from 'react';
import type { RavenMedium, Player } from '@/lib/types';

export interface RavenManualComposeHandle {
  publish: () => Promise<boolean>;
}

interface Props {
  players: Player[];
  onPublished?: () => void;
  onHeadlineChange?: (v: string) => void;
  onBodyChange?: (v: string) => void;
}

const RavenManualCompose = forwardRef<RavenManualComposeHandle, Props>(function RavenManualCompose({ players, onPublished, onHeadlineChange, onBodyChange }, ref) {
  const [medium] = useState<RavenMedium>('broadsheet');
  const [headline, setHeadline] = useState('');
  const [body, setBody] = useState('');
  const [targetPlayer, setTargetPlayer] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  function handleHeadline(v: string) {
    setHeadline(v);
    onHeadlineChange?.(v);
  }

  function handleBody(v: string) {
    setBody(v);
    onBodyChange?.(v);
  }

  async function publish(): Promise<boolean> {
    setError(null);
    if (!body.trim()) {
      setError('body is required');
      return false;
    }
    if (medium === 'broadsheet' && !headline.trim()) {
      setError('broadsheet items need a headline');
      return false;
    }
    if (medium === 'sending' && !targetPlayer) {
      setError('select a target player for sendings');
      return false;
    }

    const payload: Record<string, unknown> = {
      medium,
      body: body.trim(),
      trust: 'official',
    };
    if (medium === 'broadsheet') payload.headline = headline.trim();
    if (medium === 'sending') payload.target_player = targetPlayer;

    const res = await fetch('/api/raven-post/items', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setError(err.error ?? 'publish failed');
      return false;
    }
    setHeadline('');
    setBody('');
    setTargetPlayer('');
    onHeadlineChange?.('');
    onBodyChange?.('');
    onPublished?.();
    return true;
  }

  useImperativeHandle(ref, () => ({ publish }));

  return (
    <div
      className="border border-[var(--color-border)] bg-[var(--color-surface)] p-6"
      style={{ borderRadius: 0 }}
    >
      <h3 className="font-serif text-[var(--color-gold)] text-lg mb-4">Write a News Item</h3>

      <input
        type="text"
        value={headline}
        onChange={e => handleHeadline(e.target.value)}
        placeholder="Headline"
        className="w-full mb-3 bg-[var(--color-bg-card)] border border-[var(--color-border)] px-3 py-2 text-[var(--color-text)] font-serif"
      />

      <textarea
        rows={5}
        value={body}
        onChange={e => handleBody(e.target.value)}
        placeholder="Body — the in-fiction prose"
        className="w-full bg-[var(--color-bg-card)] border border-[var(--color-border)] px-3 py-2 text-[var(--color-text)] font-serif text-sm leading-relaxed mb-3"
      />

      {error && <p className="text-sm" style={{ color: '#c07a8a' }}>{error}</p>}
    </div>
  );
});

export default RavenManualCompose;
