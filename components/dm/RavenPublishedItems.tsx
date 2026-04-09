'use client';

import { useEffect, useState, useCallback } from 'react';
import type { RavenItem } from '@/lib/types';

const MEDIUM_LABELS: Record<string, string> = {
  broadsheet: '📜 Broadsheet',
  raven:      '🕊 Raven',
  sending:    '✦ Sending',
  overheard:  '🍺 Overheard',
  ad:         '📋 Ad',
};

export default function RavenPublishedItems() {
  const [items, setItems] = useState<RavenItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch('/api/raven-post/items');
      if (!res.ok) return;
      const data: RavenItem[] = await res.json();
      setItems(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  async function deleteItem(id: string) {
    if (!confirm('Unpublish this item?')) return;
    await fetch(`/api/raven-post/items/${id}`, { method: 'DELETE' });
    fetchItems();
  }

  // Group by medium
  const grouped: Record<string, RavenItem[]> = {};
  for (const i of items) {
    (grouped[i.medium] ??= []).push(i);
  }

  return (
    <div className="border border-[var(--color-border)] bg-[var(--color-surface)] p-6" style={{ borderRadius: 0 }}>
      <h3 className="font-serif text-[var(--color-gold)] text-lg mb-4">Published Items</h3>

      {loading && <p className="text-sm text-[var(--color-text-muted)]">loading…</p>}
      {!loading && items.length === 0 && (
        <p className="text-sm text-[var(--color-text-muted)] italic">nothing published yet</p>
      )}

      {Object.entries(grouped).map(([medium, list]) => (
        <div key={medium} className="mb-6">
          <h4 className="text-xs uppercase tracking-widest text-[var(--color-gold)] mb-2">
            {MEDIUM_LABELS[medium] ?? medium}
          </h4>
          <div className="space-y-2">
            {list.map(item => (
              <div key={item.id} className="border border-[var(--color-border)] p-3 bg-[var(--color-bg-card)]">
                {item.headline && <div className="font-serif text-[var(--color-gold)] text-sm">{item.headline}</div>}
                {item.sender && <div className="text-xs italic text-[var(--color-text-muted)]">From: {item.sender}</div>}
                <p className="font-serif text-[var(--color-text)] text-sm mt-1">{item.body}</p>
                <div className="flex justify-between items-center mt-2 text-xs text-[var(--color-text-muted)]">
                  <span>
                    {item.tags.length > 0 && <span>tags: {item.tags.join(', ')} · </span>}
                    trust: {item.trust} · {new Date(item.published_at).toLocaleDateString()}
                  </span>
                  <button
                    onClick={() => deleteItem(item.id)}
                    className="hover:text-[#c07a8a]"
                  >
                    unpublish
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
