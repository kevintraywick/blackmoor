'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import type { WorldAiState, WorldAiProposal, WorldAiTick } from '@/lib/types';

const POLL_MS = 30_000;

const MEDIUM_LABELS: Record<string, string> = {
  broadsheet: 'Broadsheet',
  raven: 'Raven',
  sending: 'Sending',
  overheard: 'Overheard',
  ad: 'Ad',
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function countdown(iso: string | null): string {
  if (!iso) return 'not scheduled';
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return 'imminent';
  const mins = Math.floor(diff / 60_000);
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (hrs > 0) return `~${hrs}h ${remMins}m`;
  return `~${remMins}m`;
}

export default function RavenWorldAiSuggestions() {
  const [proposals, setProposals] = useState<WorldAiProposal[]>([]);
  const [state, setState] = useState<WorldAiState | null>(null);
  const [ticks, setTicks] = useState<WorldAiTick[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState<Record<string, boolean>>({});

  // Draft state for inline editing
  const [bodyDrafts, setBodyDrafts] = useState<Record<string, string>>({});
  const [headlineDrafts, setHeadlineDrafts] = useState<Record<string, string>>({});

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [pRes, sRes, tRes] = await Promise.all([
        fetch('/api/raven-post/world-ai/proposals'),
        fetch('/api/raven-post/world-ai/state'),
        fetch('/api/raven-post/world-ai/ticks?limit=5'),
      ]);
      if (pRes.ok) {
        const p: WorldAiProposal[] = await pRes.json();
        setProposals(p);
        // Sync drafts — only set values that aren't already being edited
        setBodyDrafts(prev => {
          const next: Record<string, string> = {};
          p.forEach(r => { next[r.id] = prev[r.id] ?? r.body; });
          return next;
        });
        setHeadlineDrafts(prev => {
          const next: Record<string, string> = {};
          p.forEach(r => { next[r.id] = prev[r.id] ?? (r.headline ?? ''); });
          return next;
        });
      }
      if (sRes.ok) {
        const s: WorldAiState | null = await sRes.json();
        setState(s);
      }
      if (tRes.ok) {
        const t: WorldAiTick[] = await tRes.json();
        setTicks(t);
      }
    } catch (err) {
      console.error('RavenWorldAiSuggestions fetch', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    intervalRef.current = setInterval(fetchAll, POLL_MS);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchAll]);

  async function saveBody(id: string) {
    const draft = bodyDrafts[id];
    if (draft === undefined) return;
    const original = proposals.find(p => p.id === id);
    if (original && draft === original.body) return;
    await fetch(`/api/raven-post/world-ai/proposals/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ body: draft }),
    });
    fetchAll();
  }

  async function saveHeadline(id: string) {
    const draft = headlineDrafts[id];
    if (draft === undefined) return;
    const original = proposals.find(p => p.id === id);
    if (original && draft === (original.headline ?? '')) return;
    await fetch(`/api/raven-post/world-ai/proposals/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ headline: draft }),
    });
    fetchAll();
  }

  async function publishProposal(id: string) {
    setPublishing(prev => ({ ...prev, [id]: true }));
    try {
      const res = await fetch(`/api/raven-post/world-ai/proposals/${id}/publish`, {
        method: 'POST',
      });
      if (res.ok) {
        fetchAll();
      }
    } catch (err) {
      console.error('publish proposal', err);
    } finally {
      setPublishing(prev => ({ ...prev, [id]: false }));
    }
  }

  async function generateNow() {
    setGenerating(true);
    try {
      await fetch('/api/raven-post/world-ai/tick', { method: 'POST' });
      fetchAll();
    } catch (err) {
      console.error('generate tick', err);
    } finally {
      setGenerating(false);
    }
  }

  async function togglePause() {
    if (!state) return;
    await fetch('/api/raven-post/world-ai/state', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ paused: !state.paused }),
    });
    fetchAll();
  }

  // Derived stats
  const pendingCount = proposals.length;
  const lastTick = ticks[0] ?? null;
  const lastTickAgo = lastTick ? relativeTime(lastTick.ticked_at) : 'never';
  const loopActive = state ? !state.paused : false;

  // Aggregate stats from recent ticks
  const totalProposed = ticks.reduce((s, t) => s + t.proposals_generated, 0);

  return (
    <div style={{ border: '1px solid #3d2e22', borderRadius: 0, overflow: 'hidden' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '11px 16px',
          borderBottom: '1px solid #3d2e22',
          background: 'linear-gradient(90deg, #2a1e18 0%, #2a3a4a 100%)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              display: 'inline-block',
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: loopActive ? '#6ab0ff' : '#5a5a5a',
              boxShadow: loopActive ? '0 0 8px #6ab0ff' : 'none',
              animation: loopActive ? 'worldai-pulse 2s ease-in-out infinite' : 'none',
              flexShrink: 0,
            }}
          />
          <h3 className="font-serif" style={{ margin: 0, fontSize: '0.95rem', color: '#a8c8e8' }}>
            World AI — Suggested Beats
          </h3>
        </div>
        <span style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.15em', color: '#6ab0ff' }}>
          {pendingCount} new · streamed {lastTickAgo}
        </span>
      </div>

      {/* Action bar */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          padding: '10px 16px',
          background: '#1a1410',
          borderBottom: '1px solid #3d2e22',
          fontSize: '0.7rem',
          alignItems: 'center',
        }}
      >
        <button
          onClick={generateNow}
          disabled={generating}
          className="font-serif"
          style={{
            background: '#c9a84c',
            color: '#1a1410',
            border: 'none',
            padding: '6px 14px',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            cursor: generating ? 'wait' : 'pointer',
            fontWeight: 700,
            opacity: generating ? 0.5 : 1,
          }}
        >
          {generating ? 'Generating...' : '\u27F3 Generate now'}
        </button>
        <button
          onClick={togglePause}
          className="font-serif"
          style={{
            background: 'transparent',
            color: '#8b7a5a',
            border: '1px solid #4a3a2a',
            padding: '6px 12px',
            cursor: 'pointer',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}
        >
          {loopActive ? '\u23F8 Pause loop' : '\u25B6 Resume loop'}
        </button>
        <span style={{ marginLeft: 'auto', color: '#6a8aaa', fontSize: '0.65rem' }}>
          next auto-tick in {countdown(state?.next_tick_at ?? null)}
        </span>
      </div>

      {/* Proposals list */}
      <div style={{ padding: '14px 16px', background: '#221814' }}>
        {loading && (
          <p className="font-serif" style={{ fontSize: '0.9rem', color: '#8b7a5a' }}>loading...</p>
        )}

        {!loading && proposals.length === 0 && (
          <p className="font-serif" style={{ fontSize: '0.9rem', color: '#8b7a5a', fontStyle: 'italic' }}>
            No suggestions yet. Hit &#x27F3; Generate now to trigger a tick.
          </p>
        )}

        {proposals.map(proposal => {
          const isPublishing = publishing[proposal.id] ?? false;
          return (
            <div
              key={proposal.id}
              style={{
                display: 'flex',
                gap: 14,
                padding: 14,
                border: '1px solid #2a3a4a',
                background: '#1a2028',
                marginBottom: 10,
              }}
            >
              {/* Checkbox — publish on click */}
              <button
                onClick={() => publishProposal(proposal.id)}
                disabled={isPublishing}
                aria-label="Publish this suggestion"
                style={{
                  width: 22,
                  height: 22,
                  border: '1.5px solid #6ab0ff',
                  flexShrink: 0,
                  marginTop: 4,
                  background: '#0a1420',
                  cursor: isPublishing ? 'wait' : 'pointer',
                  position: 'relative',
                  padding: 0,
                  opacity: isPublishing ? 0.5 : 1,
                }}
              />

              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Medium + confidence label row */}
                <div
                  style={{
                    fontSize: '0.65rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.15em',
                    color: '#6ab0ff',
                    marginBottom: 6,
                    display: 'flex',
                    gap: 10,
                    alignItems: 'center',
                    flexWrap: 'wrap',
                  }}
                >
                  <span>{MEDIUM_LABELS[proposal.medium] ?? proposal.medium}</span>
                  <span style={{ color: '#4a6a8a' }}>conf {proposal.confidence}</span>
                  {proposal.tags.map(tag => (
                    <span
                      key={tag}
                      style={{
                        background: 'rgba(106,176,255,0.1)',
                        padding: '1px 6px',
                        fontSize: '0.6rem',
                        color: '#6ab0ff',
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Headline (broadsheet only) */}
                {proposal.medium === 'broadsheet' && (
                  <input
                    type="text"
                    value={headlineDrafts[proposal.id] ?? (proposal.headline ?? '')}
                    onChange={e =>
                      setHeadlineDrafts(prev => ({ ...prev, [proposal.id]: e.target.value }))
                    }
                    onBlur={() => saveHeadline(proposal.id)}
                    className="font-serif"
                    style={{
                      width: '100%',
                      fontSize: '1rem',
                      fontWeight: 700,
                      color: '#d8e8ff',
                      background: 'transparent',
                      border: '1px dashed transparent',
                      padding: '2px 6px',
                      marginBottom: 4,
                      outline: 'none',
                    }}
                    onFocus={e => { e.currentTarget.style.borderColor = '#6ab0ff'; }}
                    onBlurCapture={e => { e.currentTarget.style.borderColor = 'transparent'; }}
                  />
                )}

                {/* Body textarea */}
                <textarea
                  rows={3}
                  value={bodyDrafts[proposal.id] ?? proposal.body}
                  onChange={e =>
                    setBodyDrafts(prev => ({ ...prev, [proposal.id]: e.target.value }))
                  }
                  onBlur={() => saveBody(proposal.id)}
                  className="font-serif"
                  style={{
                    width: '100%',
                    fontSize: '0.95rem',
                    lineHeight: 1.45,
                    color: '#d8e8ff',
                    fontStyle: 'italic',
                    background: 'transparent',
                    border: '1px dashed transparent',
                    padding: '4px 6px',
                    resize: 'none',
                    outline: 'none',
                  }}
                  onFocus={e => {
                    e.currentTarget.style.borderColor = '#6ab0ff';
                    e.currentTarget.style.background = 'rgba(106,176,255,0.05)';
                  }}
                  onBlurCapture={e => {
                    e.currentTarget.style.borderColor = 'transparent';
                    e.currentTarget.style.background = 'transparent';
                  }}
                />

                {/* Reasoning (read-only) */}
                {proposal.reasoning && (
                  <p style={{ fontSize: '0.7rem', color: '#4a6a8a', fontStyle: 'italic', margin: '4px 0 0' }}>
                    because: {proposal.reasoning}
                  </p>
                )}

                {/* Pushdown note */}
                {proposal.pushdown_count === 0 && (
                  <p style={{ fontSize: '0.65rem', color: '#6a5a4a', fontStyle: 'italic', marginTop: 4 }}>
                    &#x2193; will push down for next loop
                  </p>
                )}
                {proposal.pushdown_count > 0 && (
                  <p style={{ fontSize: '0.65rem', color: '#6a5a4a', fontStyle: 'italic', marginTop: 4 }}>
                    &#x2193; pushed down {proposal.pushdown_count}x
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Loop status footer */}
      <div
        style={{
          background: '#1a1612',
          border: '1px solid #3d2e22',
          borderTop: 'none',
          padding: '12px 16px',
          fontSize: '0.75rem',
          color: '#8b7a5a',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: loopActive ? '#6ab0ff' : '#5a5a5a',
              boxShadow: loopActive ? '0 0 8px #6ab0ff' : 'none',
              animation: loopActive ? 'worldai-pulse 2s ease-in-out infinite' : 'none',
              flexShrink: 0,
            }}
          />
          <span>
            proposed: <strong style={{ color: '#c9a84c' }}>{totalProposed}</strong>
            {' · '}
            pending: <strong style={{ color: '#c9a84c' }}>{pendingCount}</strong>
          </span>
        </div>
        <span>
          last tick: {lastTickAgo}
        </span>
      </div>

      {/* CSS keyframes for pulse animation */}
      <style>{`
        @keyframes worldai-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.7); }
        }
      `}</style>
    </div>
  );
}
