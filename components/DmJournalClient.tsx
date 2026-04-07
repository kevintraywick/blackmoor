'use client';

import Image from 'next/image';
import { useState, useRef, useCallback } from 'react';
import type { Session, Campaign } from '@/lib/types';
import type { SessionStats } from '@/lib/journal-stats';

interface Props {
  sessions: Session[];
  campaign: Campaign | null;
  statsMap: Record<string, SessionStats>;
  initialJournalBg: string | null;
}

type EntryKind = 'session' | 'campaign';

interface EntryProps {
  kind: EntryKind;
  title: string;
  subtitle?: string;
  summaryText: string;
  stats?: SessionStats;
  initialNotes: string;
  saveUrl: string;
}

function StatsBlock({ stats }: { stats: SessionStats }) {
  const hasAny = stats.players.length > 0 || stats.boons.length > 0 || stats.poisons.length > 0 || stats.killed.length > 0;
  if (!hasAny) return null;
  return (
    <div className="text-[0.85rem] font-serif text-[var(--color-text-muted)] mb-3 space-y-0.5">
      {stats.players.length > 0 && (
        <div><span className="text-[var(--color-gold)]">Players:</span> {stats.players.join(', ')}</div>
      )}
      {stats.boons.length > 0 && (
        <div><span className="text-[var(--color-gold)]">Boons:</span> {stats.boons.map(b => `${b.name} → ${b.player}`).join(', ')}</div>
      )}
      {stats.poisons.length > 0 && (
        <div><span className="text-[var(--color-gold)]">Poisons:</span> {stats.poisons.map(p => `${p.type} → ${p.player}`).join(', ')}</div>
      )}
      {stats.killed.length > 0 && (
        <div><span className="text-[var(--color-gold)]">Killed:</span> {stats.killed.join(', ')}</div>
      )}
    </div>
  );
}

function JournalEntry({ kind, title, subtitle, summaryText, stats, initialNotes, saveUrl }: EntryProps) {
  const [notes, setNotes] = useState(initialNotes);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const lastSavedRef = useRef(initialNotes);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const handleBlur = useCallback(async () => {
    if (notes === lastSavedRef.current) return;
    setSaving(true);
    setSaved(false);
    try {
      await fetch(saveUrl, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ narrative_notes: notes }),
      });
      lastSavedRef.current = notes;
      setSaved(true);
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = setTimeout(() => setSaved(false), 1800);
    } catch {
      // silent
    }
    setSaving(false);
  }, [notes, saveUrl]);

  return (
    <div className="mb-10">
      {/* Entry header */}
      <div className="flex items-baseline justify-between mb-2 pb-1.5 border-b border-[var(--color-border)]">
        <div className="flex items-baseline gap-3">
          <span className="font-serif italic text-[1.4rem] text-[var(--color-text)]">{title}</span>
          {subtitle && (
            <span className="text-[0.7rem] uppercase tracking-[0.15em] text-[var(--color-text-muted)] font-sans">{subtitle}</span>
          )}
        </div>
        <span className="text-[0.6rem] uppercase tracking-wider text-[var(--color-text-muted)] font-sans">
          {kind === 'campaign' ? 'Backstory' : 'Session'}
        </span>
      </div>

      {/* Two-column body */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Left: summary (stats + journal text) */}
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-4 py-3">
          <div className="text-[0.6rem] uppercase tracking-[0.15em] text-[var(--color-text-muted)] mb-2 font-sans">Summary</div>
          {stats && <StatsBlock stats={stats} />}
          {summaryText ? (
            <div className="font-serif text-[var(--color-text)] text-[0.95rem] leading-relaxed" style={{ whiteSpace: 'pre-wrap' }}>
              {summaryText}
            </div>
          ) : (
            <div className="font-serif italic text-[var(--color-text-dim)] text-[0.9rem]">No journal text yet.</div>
          )}
        </div>

        {/* Right: editable narrative notes */}
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[0.6rem] uppercase tracking-[0.15em] text-[var(--color-text-muted)] font-sans">Narrative Notes</div>
            <div className="text-[0.6rem] font-sans h-4">
              {saving && <span className="text-[var(--color-text-muted)]">Saving…</span>}
              {saved && <span className="text-[var(--color-gold)]">Saved</span>}
            </div>
          </div>
          <textarea
            rows={8}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            onBlur={handleBlur}
            placeholder="Themes, foreshadowing, things to bring back later…"
            className="w-full bg-transparent text-[var(--color-text)] text-[0.95rem] leading-relaxed resize-y outline-none font-serif placeholder:text-[var(--color-text-muted)]"
          />
        </div>
      </div>
    </div>
  );
}

export default function DmJournalClient({ sessions, campaign, statsMap, initialJournalBg }: Props) {
  const [journalBg, setJournalBg] = useState<string | null>(initialJournalBg);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDrop = useCallback(async (file: File) => {
    const formData = new FormData();
    formData.append('key', 'journal_bg');
    formData.append('image', file);
    try {
      const res = await fetch('/api/uploads/journey', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.path) setJournalBg(data.path + '?t=' + Date.now());
    } catch {
      // silent
    }
    setIsDragOver(false);
  }, []);

  const circleR = 60;

  return (
    <>
      {/* Banner with drop circle */}
      <div className="relative w-full h-[200px] overflow-hidden" style={{ display: 'flex', alignItems: 'center' }}>
        <Image
          src="/images/journey/journey_splash.png"
          alt="Journal"
          fill
          className="object-cover object-center"
          priority
        />
        <div
          className="absolute z-10 rounded-full overflow-hidden flex items-center justify-center"
          style={{
            left: 100 - circleR,
            width: circleR * 2,
            height: circleR * 2,
            border: isDragOver ? '3px solid #4a7a5a' : '3px solid #000000',
            background: 'rgba(200,200,220,0.4)',
            transform: isDragOver ? 'scale(1.1)' : undefined,
            transition: 'border 0.15s, transform 0.15s',
          }}
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true); }}
          onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(false); }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) {
              handleDrop(file);
            } else {
              setIsDragOver(false);
            }
          }}
        >
          <img
            src={journalBg || '/images/journal/journal_bg.png'}
            alt="Journal"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 75%', opacity: 0.9 }}
          />
          <span className="relative z-10 font-serif text-white text-[1.1rem] uppercase tracking-[0.1em] select-none" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
            Journal
          </span>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-8 py-8">
      {sessions.map(s => (
        <JournalEntry
          key={s.id}
          kind="session"
          title={s.title || `Session ${s.number}`}
          subtitle={s.date || `Session ${s.number}`}
          summaryText={s.journal || ''}
          stats={statsMap[s.id]}
          initialNotes={s.narrative_notes || ''}
          saveUrl={`/api/sessions/${s.id}`}
        />
      ))}

      {campaign && (
        <JournalEntry
          kind="campaign"
          title={campaign.name || 'Campaign'}
          subtitle="Before the story began"
          summaryText={campaign.background || ''}
          initialNotes={campaign.narrative_notes || ''}
          saveUrl="/api/campaign"
        />
      )}
      </div>
    </>
  );
}
