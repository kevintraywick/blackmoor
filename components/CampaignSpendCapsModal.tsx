'use client';

import { useState, useEffect } from 'react';
import type { BudgetCap, SpendService } from '@/lib/types';

const SERVICE_LABELS: Record<string, string> = {
  elevenlabs: 'ElevenLabs',
  anthropic:  'Anthropic',
  twilio:     'Twilio SMS',
  websearch:  'Web search',
  railway:    'Railway',
};

interface Props {
  onClose: () => void;
}

export default function CampaignSpendCapsModal({ onClose }: Props) {
  const [caps, setCaps] = useState<BudgetCap[]>([]);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch('/api/spend/caps')
      .then(r => r.json())
      .then((data: BudgetCap[]) => {
        setCaps(data);
        const d: Record<string, string> = {};
        data.forEach(c => { d[c.service] = c.soft_cap_usd.toFixed(2); });
        setDrafts(d);
      })
      .catch(err => console.error('caps fetch:', err))
      .finally(() => setLoading(false));
  }, []);

  async function saveCap(service: SpendService) {
    const value = parseFloat(drafts[service] ?? '0');
    if (!Number.isFinite(value) || value < 0 || value > 1000) return;
    const res = await fetch('/api/spend/caps', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ service, soft_cap_usd: value }),
    });
    if (res.ok) setCaps(await res.json());
  }

  async function togglePause(service: SpendService, paused: boolean) {
    const res = await fetch('/api/spend/caps', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ service, paused }),
    });
    if (res.ok) setCaps(await res.json());
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="bg-[var(--color-surface)] border border-[var(--color-border)] p-6 max-w-[520px] w-full"
        style={{ borderRadius: 0 }}
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-serif text-[var(--color-gold)] text-lg">Adjust soft caps</h3>
          <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-gold)] text-xl leading-none">×</button>
        </div>

        {loading && <p className="text-sm text-[var(--color-text-muted)]">loading…</p>}

        <div className="space-y-3">
          {caps.map(c => (
            <div key={c.service} className="flex items-center gap-3">
              <span className="text-sm text-[var(--color-text)] w-28">{SERVICE_LABELS[c.service] ?? c.service}</span>
              <span className="text-[var(--color-text-muted)]">$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                max="1000"
                value={drafts[c.service] ?? ''}
                onChange={e => setDrafts(prev => ({ ...prev, [c.service]: e.target.value }))}
                onBlur={() => saveCap(c.service)}
                className="w-24 bg-[var(--color-bg-card)] border border-[var(--color-border)] px-2 py-1 text-[var(--color-text)] text-sm"
              />
              <button
                onClick={() => togglePause(c.service, !c.paused)}
                className="text-xs px-2 py-1 border uppercase tracking-widest font-serif"
                style={{
                  borderColor: c.paused ? '#7ac28a' : '#7b2a2a',
                  color: c.paused ? '#7ac28a' : '#d8a8a8',
                }}
              >
                {c.paused ? '▶ resume' : '⏸ pause'}
              </button>
            </div>
          ))}
        </div>

        <p className="mt-4 text-xs text-[var(--color-text-muted)] italic">
          Soft cap = silent degrade when over 100%. Pause = hard kill switch — service is gated immediately.
        </p>
      </div>
    </div>
  );
}
