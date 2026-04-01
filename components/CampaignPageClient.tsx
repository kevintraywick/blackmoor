'use client';

import { useState, useRef } from 'react';
import type { Campaign } from '@/lib/types';

export default function CampaignPageClient({ initial }: { initial: Campaign }) {
  const [name, setName] = useState(initial.name);
  const [world, setWorld] = useState(initial.world);
  const [dmEmail, setDmEmail] = useState(initial.dm_email ?? '');
  const [description, setDescription] = useState(initial.description ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  async function save(fields: Record<string, unknown>) {
    setSaving(true);
    setSaved(false);
    try {
      await fetch('/api/campaign', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, world, dm_email: dmEmail, ...fields }),
      });
      setSaved(true);
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  function handleNameBlur() {
    if (name !== initial.name) save({ name });
  }

  function handleWorldBlur() {
    if (world !== initial.world) save({ world });
  }

  function handleDmEmailBlur() {
    if (dmEmail !== (initial.dm_email ?? '')) save({ dm_email: dmEmail });
  }

  function handleDescriptionBlur() {
    if (description !== (initial.description ?? '')) save({ description });
  }

  return (
    <div className="max-w-[1000px] mx-auto px-8 py-12">
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

        <div>
          <label className="block text-sm text-[var(--color-text-muted)] mb-1.5">DM Email</label>
          <input
            type="email"
            value={dmEmail}
            onChange={e => setDmEmail(e.target.value)}
            onBlur={handleDmEmailBlur}
            placeholder="you@example.com — for quorum notifications"
            className="w-full bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded px-3 py-2 text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]/40 focus:outline-none focus:border-[var(--color-gold)]"
          />
          <p className="text-xs text-[var(--color-text-muted)] mt-1">Get an email when enough players confirm a Saturday</p>
        </div>

        <div>
          <label className="block text-sm text-[var(--color-text-muted)] mb-1.5">Site Description</label>
          <input
            type="text"
            value={description}
            onChange={e => setDescription(e.target.value)}
            onBlur={handleDescriptionBlur}
            placeholder="Shown in Discord embeds when sharing links"
            className="w-full bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded px-3 py-2 text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]/40 focus:outline-none focus:border-[var(--color-gold)]"
          />
          <p className="text-xs text-[var(--color-text-muted)] mt-1">Appears in Discord/social previews when someone shares a link</p>
        </div>
      </div>

      <div className="mt-4 h-6 text-sm">
        {saving && <span className="text-[var(--color-text-muted)]">Saving...</span>}
        {saved && <span className="text-[var(--color-gold)]">Saved</span>}
      </div>
    </div>
  );
}
