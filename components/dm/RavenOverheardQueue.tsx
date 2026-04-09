'use client';

import { useEffect, useState, useCallback } from 'react';
import type { RavenOverheardQueueRow } from '@/lib/types';

export default function RavenOverheardQueue() {
  const [rows, setRows] = useState<RavenOverheardQueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [newBody, setNewBody] = useState('');
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const fetchQueue = useCallback(async () => {
    try {
      const res = await fetch('/api/raven-post/overheard/queue');
      if (!res.ok) return;
      const data: RavenOverheardQueueRow[] = await res.json();
      setRows(data);
      const d: Record<string, string> = {};
      data.forEach(r => { d[r.id] = r.body; });
      setDrafts(d);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchQueue(); }, [fetchQueue]);

  async function addRow() {
    if (!newBody.trim()) return;
    const res = await fetch('/api/raven-post/overheard/queue', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ body: newBody.trim() }),
    });
    if (res.ok) {
      setNewBody('');
      fetchQueue();
    }
  }

  async function saveRow(id: string) {
    const draft = drafts[id];
    if (draft === undefined) return;
    await fetch(`/api/raven-post/overheard/queue/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ body: draft }),
    });
    fetchQueue();
  }

  async function deleteRow(id: string) {
    if (!confirm('Delete this overheard?')) return;
    await fetch(`/api/raven-post/overheard/queue/${id}`, { method: 'DELETE' });
    fetchQueue();
  }

  return (
    <div className="border border-[var(--color-border)] bg-[var(--color-surface)] p-6" style={{ borderRadius: 0 }}>
      <h3 className="font-serif text-[var(--color-gold)] text-lg mb-1">Library Overheard Queue</h3>
      <p className="text-xs text-[var(--color-text-muted)] italic mb-4">
        FIFO · no replays · 100m radius @ Citadel Tree
      </p>

      {loading && <p className="text-sm text-[var(--color-text-muted)]">loading…</p>}

      <div className="space-y-2 mb-4">
        {rows.map((r, idx) => (
          <div
            key={r.id}
            className="border border-[var(--color-border)] bg-[var(--color-bg-card)] p-3"
            style={{ display: 'grid', gridTemplateColumns: '32px 1fr 100px 60px', gap: 12, alignItems: 'center' }}
          >
            <div
              className="rounded-full flex items-center justify-center text-xs font-bold"
              style={{ width: 24, height: 24, background: 'var(--color-gold)', color: '#1a1410' }}
            >
              {idx + 1}
            </div>
            <textarea
              rows={2}
              value={drafts[r.id] ?? r.body}
              onChange={e => setDrafts(prev => ({ ...prev, [r.id]: e.target.value }))}
              onBlur={() => saveRow(r.id)}
              className="bg-transparent border border-[var(--color-border)] px-2 py-1 text-[var(--color-text)] font-serif italic text-sm"
            />
            <span className="text-xs text-[var(--color-text-muted)] text-right">
              {r.delivered_to.length === 0 ? 'queued' : `delivered to ${r.delivered_to.length}`}
            </span>
            <button
              onClick={() => deleteRow(r.id)}
              className="text-[var(--color-text-muted)] hover:text-[#c07a8a] text-xs"
            >
              ×
            </button>
          </div>
        ))}
        {rows.length === 0 && !loading && (
          <p className="text-sm text-[var(--color-text-muted)] italic">queue is empty</p>
        )}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={newBody}
          onChange={e => setNewBody(e.target.value)}
          placeholder="Add a new overheard rumor (≤280 chars)"
          maxLength={280}
          className="flex-1 bg-[var(--color-bg-card)] border border-[var(--color-border)] px-3 py-2 text-[var(--color-text)] font-serif text-sm"
        />
        <button
          onClick={addRow}
          disabled={!newBody.trim()}
          className="px-4 py-2 border border-[var(--color-gold)] text-[var(--color-gold)] font-serif uppercase tracking-widest text-xs disabled:opacity-40"
        >
          Add
        </button>
      </div>
    </div>
  );
}
