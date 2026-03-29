'use client';

import { useState, useRef } from 'react';
import type { Campaign } from '@/lib/types';

export default function CampaignPageClient({ initial }: { initial: Campaign }) {
  const [name, setName] = useState(initial.name);
  const [world, setWorld] = useState(initial.world);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  async function save(newName: string, newWorld: string) {
    setSaving(true);
    setSaved(false);
    try {
      await fetch('/api/campaign', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, world: newWorld }),
      });
      setSaved(true);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  function handleNameBlur() {
    if (name !== initial.name) save(name, world);
  }

  function handleWorldBlur() {
    if (world !== initial.world) save(name, world);
  }

  return (
    <div className="max-w-2xl mx-auto px-8 py-12">
      <h1 className="font-[var(--font-display)] text-3xl text-[var(--color-gold)] mb-8">Campaign</h1>

      <div className="space-y-6">
        <div>
          <label className="block text-sm text-[var(--color-text-muted)] mb-1.5">Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            onBlur={handleNameBlur}
            placeholder="e.g. Shadow of the Wolf"
            className="w-full bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded px-3 py-2 text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]/40 focus:outline-none focus:border-[var(--color-gold)]"
          />
        </div>

        <div>
          <label className="block text-sm text-[var(--color-text-muted)] mb-1.5">World</label>
          <input
            type="text"
            value={world}
            onChange={e => setWorld(e.target.value)}
            onBlur={handleWorldBlur}
            placeholder="e.g. Blackmoor"
            className="w-full bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded px-3 py-2 text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]/40 focus:outline-none focus:border-[var(--color-gold)]"
          />
        </div>
      </div>

      <div className="mt-4 h-6 text-sm">
        {saving && <span className="text-[var(--color-text-muted)]">Saving...</span>}
        {saved && <span className="text-[var(--color-gold)]">Saved</span>}
      </div>
    </div>
  );
}
