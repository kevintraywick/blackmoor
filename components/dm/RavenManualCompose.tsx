'use client';

import { useState } from 'react';
import type { RavenMedium, RavenTrust, Player } from '@/lib/types';

const MEDIA: { value: RavenMedium; label: string }[] = [
  { value: 'broadsheet', label: '📜 Broadsheet' },
  { value: 'raven',      label: '🕊 Raven' },
  { value: 'sending',    label: '✦ Sending' },
  { value: 'overheard',  label: '🍺 Overheard' },
  { value: 'ad',         label: '📋 Ad' },
];

interface Props {
  players: Player[];
  onPublished?: () => void;
}

export default function RavenManualCompose({ players, onPublished }: Props) {
  const [medium, setMedium] = useState<RavenMedium>('broadsheet');
  const [oneLineBeat, setOneLineBeat] = useState('');
  const [headline, setHeadline] = useState('');
  const [body, setBody] = useState('');
  const [sender, setSender] = useState('');
  const [targetPlayer, setTargetPlayer] = useState<string>('');
  const [trust, setTrust] = useState<RavenTrust>('official');
  const [adImage, setAdImage] = useState('');
  const [adRealLink, setAdRealLink] = useState('');
  const [adRealCopy, setAdRealCopy] = useState('');
  const [drafting, setDrafting] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function draftWithAI() {
    if (!oneLineBeat.trim()) return;
    setDrafting(true);
    setError(null);
    try {
      const res = await fetch('/api/raven-post/draft', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ medium, oneLineBeat }),
      });
      if (!res.ok) {
        setError(res.status === 503 ? 'AI unavailable (no API key or budget paused)' : 'draft failed');
        return;
      }
      const data: { headline: string | null; body: string } = await res.json();
      if (data.headline) setHeadline(data.headline);
      setBody(data.body);
    } catch (err) {
      console.error(err);
      setError('draft failed');
    } finally {
      setDrafting(false);
    }
  }

  async function publish() {
    setError(null);
    if (!body.trim()) {
      setError('body is required');
      return;
    }
    if (medium === 'broadsheet' && !headline.trim()) {
      setError('broadsheet items need a headline');
      return;
    }
    if ((medium === 'raven' || medium === 'sending') && !targetPlayer) {
      setError('select a target player for ravens and sendings');
      return;
    }

    setPublishing(true);
    try {
      const payload: Record<string, unknown> = {
        medium,
        body: body.trim(),
        trust,
      };
      if (medium === 'broadsheet') payload.headline = headline.trim();
      if (medium === 'raven') {
        payload.sender = sender.trim();
        payload.target_player = targetPlayer;
      }
      if (medium === 'sending') payload.target_player = targetPlayer;
      if (medium === 'ad') {
        if (adImage.trim()) payload.ad_image_url = adImage.trim();
        if (adRealLink.trim()) payload.ad_real_link = adRealLink.trim();
        if (adRealCopy.trim()) payload.ad_real_copy = adRealCopy.trim();
      }

      const res = await fetch('/api/raven-post/items', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.error ?? 'publish failed');
        return;
      }
      // Clear the form
      setOneLineBeat('');
      setHeadline('');
      setBody('');
      setSender('');
      setTargetPlayer('');
      setAdImage('');
      setAdRealLink('');
      setAdRealCopy('');
      onPublished?.();
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div
      className="border border-[var(--color-border)] bg-[var(--color-surface)] p-6"
      style={{ borderRadius: 0 }}
    >
      <h3 className="font-serif text-[var(--color-gold)] text-lg mb-4">✍️ Write a News Item</h3>

      {/* Medium tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {MEDIA.map(m => (
          <button
            key={m.value}
            onClick={() => setMedium(m.value)}
            className="text-xs px-3 py-1.5 border font-serif uppercase tracking-widest"
            style={{
              borderColor: medium === m.value ? 'var(--color-gold)' : 'var(--color-border)',
              color: medium === m.value ? 'var(--color-gold)' : 'var(--color-text-muted)',
              background: medium === m.value ? 'rgba(201,168,76,0.08)' : 'transparent',
            }}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* One-line beat + AI draft */}
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={oneLineBeat}
          onChange={e => setOneLineBeat(e.target.value)}
          placeholder="One-line beat — e.g. 'Stonecutters guild walks out over the new tax'"
          className="flex-1 bg-[var(--color-bg-card)] border border-[var(--color-border)] px-3 py-2 text-[var(--color-text)] font-serif text-sm"
        />
        <button
          onClick={draftWithAI}
          disabled={drafting || !oneLineBeat.trim()}
          className="px-4 py-2 bg-[var(--color-gold)] text-[#1a1410] font-serif text-sm uppercase tracking-widest disabled:opacity-40"
        >
          {drafting ? 'Drafting…' : 'Draft with AI'}
        </button>
      </div>

      {/* Per-medium fields */}
      {medium === 'broadsheet' && (
        <input
          type="text"
          value={headline}
          onChange={e => setHeadline(e.target.value)}
          placeholder="Headline"
          className="w-full mb-3 bg-[var(--color-bg-card)] border border-[var(--color-border)] px-3 py-2 text-[var(--color-text)] font-serif"
        />
      )}

      {(medium === 'raven' || medium === 'sending') && (
        <div className="mb-3">
          <label className="block text-xs text-[var(--color-text-muted)] uppercase tracking-widest mb-2">Target player</label>
          <div className="flex gap-2 flex-wrap">
            {players.map(p => (
              <button
                key={p.id}
                onClick={() => setTargetPlayer(p.id)}
                className="px-3 py-1.5 border text-xs font-serif"
                style={{
                  borderColor: targetPlayer === p.id ? 'var(--color-gold)' : 'var(--color-border)',
                  color: targetPlayer === p.id ? 'var(--color-gold)' : 'var(--color-text-muted)',
                  background: targetPlayer === p.id ? 'rgba(201,168,76,0.08)' : 'transparent',
                }}
              >
                {p.playerName}
              </button>
            ))}
          </div>
        </div>
      )}

      {medium === 'raven' && (
        <input
          type="text"
          value={sender}
          onChange={e => setSender(e.target.value)}
          placeholder="Sender (e.g. 'Warden Cedric of the Hollow Oak')"
          className="w-full mb-3 bg-[var(--color-bg-card)] border border-[var(--color-border)] px-3 py-2 text-[var(--color-text)] font-serif text-sm"
        />
      )}

      <textarea
        rows={5}
        value={body}
        onChange={e => setBody(e.target.value)}
        placeholder={
          medium === 'sending'
            ? 'Sending body — exactly 25 words or fewer, cryptic'
            : 'Body — the in-fiction prose'
        }
        className="w-full bg-[var(--color-bg-card)] border border-[var(--color-border)] px-3 py-2 text-[var(--color-text)] font-serif text-sm leading-relaxed mb-3"
      />

      {medium === 'ad' && (
        <div className="space-y-2 mb-3">
          <input
            type="text"
            value={adImage}
            onChange={e => setAdImage(e.target.value)}
            placeholder="Real-world image URL (optional)"
            className="w-full bg-[var(--color-bg-card)] border border-[var(--color-border)] px-3 py-2 text-[var(--color-text)] font-serif text-xs"
          />
          <input
            type="text"
            value={adRealLink}
            onChange={e => setAdRealLink(e.target.value)}
            placeholder="Real-world product link (revealed on click)"
            className="w-full bg-[var(--color-bg-card)] border border-[var(--color-border)] px-3 py-2 text-[var(--color-text)] font-serif text-xs"
          />
          <input
            type="text"
            value={adRealCopy}
            onChange={e => setAdRealCopy(e.target.value)}
            placeholder="Real-world copy (revealed on click)"
            className="w-full bg-[var(--color-bg-card)] border border-[var(--color-border)] px-3 py-2 text-[var(--color-text)] font-serif text-xs"
          />
        </div>
      )}

      {/* Trust tier */}
      <div className="flex gap-2 mb-4">
        {(['official', 'whispered', 'rumored', 'prophesied'] as RavenTrust[]).map(t => (
          <button
            key={t}
            onClick={() => setTrust(t)}
            className="px-3 py-1 text-xs font-serif uppercase tracking-widest border"
            style={{
              borderColor: trust === t ? 'var(--color-gold)' : 'var(--color-border)',
              color: trust === t ? 'var(--color-gold)' : 'var(--color-text-muted)',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {error && <p className="text-sm mb-3" style={{ color: '#c07a8a' }}>{error}</p>}

      <button
        onClick={publish}
        disabled={publishing}
        className="px-6 py-2 bg-[var(--color-gold)] text-[#1a1410] font-serif uppercase tracking-widest disabled:opacity-40"
      >
        {publishing ? 'Publishing…' : 'Publish'}
      </button>
    </div>
  );
}
