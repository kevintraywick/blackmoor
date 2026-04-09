'use client';

import { useState, useEffect } from 'react';
import type { SpendLedgerRow, SpendService } from '@/lib/types';

const SERVICE_LABELS: Record<string, string> = {
  elevenlabs: 'ElevenLabs',
  anthropic:  'Anthropic',
  twilio:     'Twilio',
  websearch:  'Web search',
  railway:    'Railway',
};

interface Props {
  onClose: () => void;
}

export default function CampaignSpendLedgerModal({ onClose }: Props) {
  const [rows, setRows] = useState<SpendLedgerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<SpendService | 'all'>('all');

  useEffect(() => {
    const url = filter === 'all'
      ? '/api/spend/ledger?limit=100'
      : `/api/spend/ledger?service=${filter}&limit=100`;
    setLoading(true);
    fetch(url)
      .then(r => r.json())
      .then(setRows)
      .catch(err => console.error('ledger fetch:', err))
      .finally(() => setLoading(false));
  }, [filter]);

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
        className="bg-[var(--color-surface)] border border-[var(--color-border)] p-6 max-w-[820px] w-full"
        style={{ borderRadius: 0, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-serif text-[var(--color-gold)] text-lg">Spend ledger — most recent 100</h3>
          <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-gold)] text-xl leading-none">×</button>
        </div>

        <div className="flex gap-2 mb-3 flex-wrap">
          {(['all', 'elevenlabs', 'anthropic', 'twilio', 'websearch', 'railway'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="text-xs px-3 py-1 border font-serif uppercase tracking-widest"
              style={{
                borderColor: filter === f ? 'var(--color-gold)' : 'var(--color-border)',
                color: filter === f ? 'var(--color-gold)' : 'var(--color-text-muted)',
                background: filter === f ? 'rgba(201,168,76,0.08)' : 'transparent',
              }}
            >
              {f === 'all' ? 'All' : SERVICE_LABELS[f]}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading && <p className="text-sm text-[var(--color-text-muted)]">loading…</p>}
          {!loading && rows.length === 0 && (
            <p className="text-sm text-[var(--color-text-muted)] italic">no entries yet</p>
          )}
          <table style={{ width: '100%', fontSize: '0.78rem', borderCollapse: 'collapse' }}>
            <thead>
              <tr className="text-[var(--color-text-muted)] uppercase tracking-widest text-xs">
                <th style={{ textAlign: 'left', padding: '6px 8px' }}>When</th>
                <th style={{ textAlign: 'left', padding: '6px 8px' }}>Service</th>
                <th style={{ textAlign: 'right', padding: '6px 8px' }}>USD</th>
                <th style={{ textAlign: 'right', padding: '6px 8px' }}>Units</th>
                <th style={{ textAlign: 'left', padding: '6px 8px' }}>Kind</th>
                <th style={{ textAlign: 'left', padding: '6px 8px' }}>Ref</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className="border-t border-[var(--color-border)] text-[var(--color-text)]">
                  <td style={{ padding: '6px 8px' }}>{new Date(r.occurred_at).toLocaleString()}</td>
                  <td style={{ padding: '6px 8px' }}>{SERVICE_LABELS[r.service] ?? r.service}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right' }} className="tabular-nums">${r.amount_usd.toFixed(4)}</td>
                  <td style={{ padding: '6px 8px', textAlign: 'right' }} className="tabular-nums">{r.units ?? '—'}</td>
                  <td style={{ padding: '6px 8px' }}>{r.unit_kind ?? '—'}</td>
                  <td style={{ padding: '6px 8px' }}>{r.ref_table ? `${r.ref_table}/${r.ref_id ?? ''}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
