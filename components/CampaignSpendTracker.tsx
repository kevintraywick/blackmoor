'use client';

import { useState, useEffect, useCallback } from 'react';
import type { MtdSpend } from '@/lib/types';
import CampaignSpendCapsModal from './CampaignSpendCapsModal';
import CampaignSpendLedgerModal from './CampaignSpendLedgerModal';

const POLL_MS = 60_000;

const SERVICE_LABELS: Record<string, string> = {
  elevenlabs: 'ElevenLabs',
  anthropic:  'Anthropic',
  twilio:     'Twilio SMS',
  websearch:  'Web search',
  railway:    'Railway',
};

const SERVICE_ORDER = ['elevenlabs', 'anthropic', 'twilio', 'websearch', 'railway'];

function fmt(usd: number): string {
  if (usd === 0) return '$0';
  if (usd < 1) return `$${usd.toFixed(2)}`;
  return `$${usd.toFixed(2)}`;
}

function meterColor(mtd: number, cap: number): { fill: string; pct: number } {
  if (cap === 0) return { fill: '#3a2e22', pct: 0 };
  const pct = Math.min(100, (mtd / cap) * 100);
  if (pct < 80)  return { fill: '#4a7a5a', pct }; // green
  if (pct < 100) return { fill: '#c9a84c', pct }; // gold
  return { fill: '#7b1a1a', pct };               // red
}

export default function CampaignSpendTracker() {
  const [rows, setRows] = useState<MtdSpend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCapsModal, setShowCapsModal] = useState(false);
  const [showLedgerModal, setShowLedgerModal] = useState(false);

  const fetchMtd = useCallback(async () => {
    try {
      const res = await fetch('/api/spend/mtd', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: MtdSpend[] = await res.json();
      setRows(data);
      setError(null);
    } catch (err) {
      console.error('CampaignSpendTracker fetch:', err);
      setError('failed to load spend');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMtd();
    const t = setInterval(fetchMtd, POLL_MS);
    return () => clearInterval(t);
  }, [fetchMtd]);

  async function togglePause(service: string, paused: boolean) {
    await fetch('/api/spend/caps', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ service, paused }),
    });
    fetchMtd();
  }

  // Sort rows in canonical order
  const sortedRows = [...rows].sort(
    (a, b) => SERVICE_ORDER.indexOf(a.service) - SERVICE_ORDER.indexOf(b.service),
  );

  // Total = sum of mtd, total cap = sum of soft caps (excluding railway which is informational)
  const totalMtd = sortedRows.reduce((s, r) => s + r.mtd_usd, 0);
  const totalCap = sortedRows
    .filter(r => r.service !== 'railway')
    .reduce((s, r) => s + r.soft_cap_usd, 0);
  const totalColor = meterColor(totalMtd, totalCap);

  // Look up pause state for the kill switches
  const anthropicPaused = sortedRows.find(r => r.service === 'anthropic')?.paused ?? false;
  const twilioPaused    = sortedRows.find(r => r.service === 'twilio')?.paused ?? false;

  return (
    <div className="max-w-[1000px] mx-auto px-8 mt-12 mb-12">
      <div
        className="border border-[var(--color-border)] bg-[var(--color-surface)] p-6"
        style={{ borderRadius: 0 }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-serif text-[var(--color-gold)] text-lg">
            Raven Post — month-to-date spend
          </h3>
          {loading && <span className="text-xs text-[var(--color-text-muted)]">loading…</span>}
          {error && <span className="text-xs" style={{ color: '#c07a8a' }}>{error}</span>}
        </div>

        <div className="space-y-2">
          {sortedRows.map(r => {
            const label = SERVICE_LABELS[r.service] ?? r.service;
            const { fill, pct } = meterColor(r.mtd_usd, r.soft_cap_usd);
            const capLabel = r.soft_cap_usd === 0 ? '—' : `/ ${fmt(r.soft_cap_usd)}`;
            return (
              <div
                key={r.service}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '110px 1fr 110px',
                  gap: '12px',
                  alignItems: 'center',
                  fontSize: '0.85rem',
                }}
              >
                <span className="text-[var(--color-text)]">
                  {label}
                  {r.paused && <span className="ml-2 text-xs" style={{ color: '#c07a8a' }}>⏸</span>}
                </span>
                <div
                  style={{
                    background: '#2a1e18',
                    height: 8,
                    border: '1px solid var(--color-border)',
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ width: `${pct}%`, height: '100%', background: fill }} />
                </div>
                <span className="text-right tabular-nums" style={{ color: 'var(--color-gold)' }}>
                  {fmt(r.mtd_usd)} {capLabel}
                </span>
              </div>
            );
          })}
        </div>

        {/* Total row */}
        <div
          className="border-t border-[var(--color-border)] mt-4 pt-3"
          style={{
            display: 'grid',
            gridTemplateColumns: '110px 1fr 110px',
            gap: '12px',
            fontSize: '0.95rem',
            fontWeight: 700,
          }}
        >
          <span className="text-[var(--color-gold)] uppercase tracking-widest text-xs">
            Total MTD
          </span>
          <span />
          <span className="text-right tabular-nums" style={{ color: totalColor.fill }}>
            {fmt(totalMtd)} / {fmt(totalCap)}
          </span>
        </div>

        {/* Action bar */}
        <div className="mt-4 pt-3 border-t border-[var(--color-border)] flex flex-wrap gap-2">
          <button
            onClick={() => setShowCapsModal(true)}
            className="text-xs px-3 py-1.5 border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-gold)] hover:border-[var(--color-gold)] uppercase tracking-widest font-serif"
          >
            Adjust caps
          </button>
          <button
            onClick={() => setShowLedgerModal(true)}
            className="text-xs px-3 py-1.5 border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-gold)] hover:border-[var(--color-gold)] uppercase tracking-widest font-serif"
          >
            View ledger
          </button>
          <button
            onClick={() => togglePause('anthropic', !anthropicPaused)}
            className="text-xs px-3 py-1.5 border uppercase tracking-widest font-serif"
            style={{
              borderColor: anthropicPaused ? '#7ac28a' : '#7b2a2a',
              color: anthropicPaused ? '#7ac28a' : '#d8a8a8',
            }}
          >
            {anthropicPaused ? '▶ Resume World AI' : '⏸ Pause World AI'}
          </button>
          <button
            onClick={() => togglePause('twilio', !twilioPaused)}
            className="text-xs px-3 py-1.5 border uppercase tracking-widest font-serif"
            style={{
              borderColor: twilioPaused ? '#7ac28a' : '#7b2a2a',
              color: twilioPaused ? '#7ac28a' : '#d8a8a8',
            }}
          >
            {twilioPaused ? '▶ Resume SMS' : '⏸ Pause SMS push'}
          </button>
        </div>
      </div>

      {showCapsModal && (
        <CampaignSpendCapsModal
          onClose={() => { setShowCapsModal(false); fetchMtd(); }}
        />
      )}
      {showLedgerModal && (
        <CampaignSpendLedgerModal onClose={() => setShowLedgerModal(false)} />
      )}
    </div>
  );
}
