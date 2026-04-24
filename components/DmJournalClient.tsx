'use client';

import Image from 'next/image';
import { useState, useRef, useCallback, useEffect } from 'react';
import type { Session, Campaign } from '@/lib/types';
import type { SessionStats } from '@/lib/journal-stats';

const AUTOSAVE_MS = 800;
type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

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
  initialPublic?: string;
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

function JournalEntry({ kind, title, subtitle, summaryText, stats, initialNotes, initialPublic = '', saveUrl }: EntryProps) {
  const [notes, setNotes] = useState(initialNotes);
  const [pubText, setPubText] = useState(initialPublic);
  const [summary, setSummary] = useState(summaryText);
  const [status, setStatus] = useState<SaveStatus>('idle');
  const lastNotesRef = useRef(initialNotes);
  const lastPubRef = useRef(initialPublic);
  const lastSummaryRef = useRef(summaryText);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedFadeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ref-based save avoids stale closures — see the RP editor's autosave pattern.
  const flushSaveRef = useRef<() => Promise<void>>(async () => {});

  const flushSave = useCallback(async () => {
    const isDirty = kind === 'campaign'
      ? summary !== lastSummaryRef.current
      : notes !== lastNotesRef.current || pubText !== lastPubRef.current;
    if (!isDirty) return;
    setStatus('saving');
    try {
      if (kind === 'campaign') {
        const res = await fetch(saveUrl, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ background: summary }),
        });
        if (!res.ok) throw new Error(String(res.status));
        lastSummaryRef.current = summary;
      } else {
        const patch: Record<string, string> = {};
        if (notes !== lastNotesRef.current) patch.journal = notes;
        if (pubText !== lastPubRef.current) patch.journal_public = pubText;
        const res = await fetch(saveUrl, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        });
        if (!res.ok) throw new Error(String(res.status));
        if (patch.journal !== undefined) lastNotesRef.current = notes;
        if (patch.journal_public !== undefined) lastPubRef.current = pubText;
      }
      setStatus('saved');
      if (savedFadeRef.current) clearTimeout(savedFadeRef.current);
      savedFadeRef.current = setTimeout(() => setStatus('idle'), 1800);
    } catch (err) {
      console.error('[journal] save failed', err);
      setStatus('error');
    }
  }, [kind, notes, pubText, summary, saveUrl]);
  flushSaveRef.current = flushSave;

  function scheduleSave() {
    setStatus('dirty');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => { flushSaveRef.current(); }, AUTOSAVE_MS);
  }

  function saveNow() {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    flushSaveRef.current();
  }

  // Flush pending edits before the tab is hidden / closed.
  useEffect(() => {
    const onHide = () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
        flushSaveRef.current();
      }
    };
    window.addEventListener('beforeunload', onHide);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('beforeunload', onHide);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, []);

  const statusLabel: Record<SaveStatus, string> = {
    idle: '', dirty: 'Unsaved', saving: 'Saving…', saved: 'Saved ✓', error: 'Save failed',
  };
  const statusColor: Record<SaveStatus, string> = {
    idle: 'transparent', dirty: '#c9a84c', saving: '#8a7a60', saved: '#6ab07a', error: '#dc2626',
  };

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
        <div className="flex items-baseline gap-3">
          {(status === 'dirty' || status === 'error') && (
            <button
              type="button"
              onClick={saveNow}
              className="text-[0.6rem] uppercase tracking-[0.1em] font-sans cursor-pointer"
              style={{
                background: status === 'error' ? '#dc2626' : '#c9a84c',
                border: 'none',
                borderRadius: 3,
                color: '#111111',
                padding: '3px 12px',
                fontWeight: 700,
              }}
            >
              {status === 'error' ? 'Retry Save' : 'Save'}
            </button>
          )}
          {(status === 'saving' || status === 'saved') && (
            <span
              className="text-[0.6rem] uppercase tracking-[0.15em] font-sans"
              style={{ color: statusColor[status], transition: 'color 200ms ease' }}
            >
              {statusLabel[status]}
            </span>
          )}
        </div>
      </div>

      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-4 py-3">
        {kind === 'campaign' ? (
          <textarea
            rows={6}
            value={summary}
            onChange={e => { setSummary(e.target.value); scheduleSave(); }}
            placeholder="The campaign backstory…"
            className="w-full bg-transparent font-serif text-[var(--color-text)] text-[0.95rem] leading-relaxed resize-none focus:outline-none placeholder:text-[var(--color-text-muted)]/40"
          />
        ) : (
          <>
            {stats && <StatsBlock stats={stats} />}

            <div className="text-[0.6rem] uppercase tracking-[0.15em] text-[var(--color-text-muted)] font-sans mb-2">Private Notes</div>
            <textarea
              rows={6}
              value={notes}
              onChange={e => { setNotes(e.target.value); scheduleSave(); }}
              placeholder="Themes, foreshadowing, things to bring back later…"
              className="w-full bg-transparent text-[var(--color-text)] text-[0.95rem] leading-relaxed resize-y outline-none font-serif placeholder:text-[var(--color-text-muted)]"
            />

            <div
              className="mt-3 rounded px-3 py-3"
              style={{ backgroundColor: 'rgba(220, 38, 38, 0.10)', border: '1px solid rgba(220, 38, 38, 0.25)' }}
            >
              <div className="text-[0.6rem] uppercase tracking-[0.15em] text-[var(--color-text-muted)] font-sans mb-2">
                Journal — <span style={{ color: '#ff3b3b', fontWeight: 600 }}>Public</span>
              </div>
              <textarea
                rows={6}
                value={pubText}
                onChange={e => { setPubText(e.target.value); scheduleSave(); }}
                placeholder="What players see on the Journey page…"
                className="w-full bg-transparent text-[var(--color-text)] text-[0.95rem] leading-relaxed resize-y outline-none font-serif placeholder:text-[var(--color-text-muted)]"
              />
            </div>
          </>
        )}
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
          summaryText=""
          stats={statsMap[s.id]}
          initialNotes={s.journal || ''}
          initialPublic={s.journal_public || ''}
          saveUrl={`/api/sessions/${s.id}`}
        />
      ))}

      {campaign && (
        <JournalEntry
          kind="campaign"
          title={campaign.name || 'Campaign'}
          subtitle=""
          summaryText={campaign.background || ''}
          initialNotes={campaign.narrative_notes || ''}
          saveUrl="/api/campaign"
        />
      )}
      </div>
    </>
  );
}
