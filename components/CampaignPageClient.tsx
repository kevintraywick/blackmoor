'use client';

import { useState, useRef, useEffect } from 'react';
import type { Campaign, Invitation } from '@/lib/types';

// ── Calendar helpers ────────────────────────────────────────────────────────

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function toISO(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function formatMonthYear(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

// ── Component ───────────────────────────────────────────────────────────────

export default function CampaignPageClient({ initial }: { initial: Campaign }) {
  const [name, setName] = useState(initial.name);
  const [world, setWorld] = useState(initial.world);
  const [dmEmail, setDmEmail] = useState(initial.dm_email ?? '');
  const [description, setDescription] = useState(initial.description ?? '');
  const [background, setBackground] = useState(initial.background ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Invitation state
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth());
  const [calYear, setCalYear] = useState(() => new Date().getFullYear());
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/invitations').then(r => r.json()).then(setInvitations).catch(() => {});
  }, []);

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

  function handleNameBlur() { if (name !== initial.name) save({ name }); }
  function handleWorldBlur() { if (world !== initial.world) save({ world }); }
  function handleDmEmailBlur() { if (dmEmail !== (initial.dm_email ?? '')) save({ dm_email: dmEmail }); }
  function handleDescriptionBlur() { if (description !== (initial.description ?? '')) save({ description }); }
  function handleBackgroundBlur() { if (background !== (initial.background ?? '')) save({ background }); }

  function toggleDate(iso: string) {
    setSelectedDates(prev => {
      if (prev.includes(iso)) return prev.filter(d => d !== iso);
      if (prev.length >= 5) return prev;
      return [...prev, iso];
    });
  }

  async function createInvitation() {
    if (selectedDates.length === 0) return;
    const res = await fetch('/api/invitations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dates: selectedDates }),
    });
    if (res.ok) {
      const inv: Invitation = await res.json();
      setInvitations(prev => [inv, ...prev]);
      setShowCalendar(false);
      setSelectedDates([]);
    }
  }

  function copyLink(slug: string) {
    const url = `${window.location.origin}/canyouplay/${slug}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(slug);
      setTimeout(() => setCopied(null), 2000);
    }).catch(() => {});
  }

  // Calendar grid
  const daysInMonth = getDaysInMonth(calYear, calMonth);
  const firstDay = getFirstDayOfWeek(calYear, calMonth);
  const todayISO = new Date().toISOString().slice(0, 10);

  const inputClass = "w-1/2 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded px-3 py-2 text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]/40 focus:outline-none focus:border-[var(--color-gold)]";

  return (
    <div className="max-w-[1000px] mx-auto px-8 py-12">
      <div className="flex gap-12 items-start">
        {/* Left: campaign fields */}
        <div className="flex-1 space-y-4">
          <div>
            <label className="block text-sm text-[var(--color-text-muted)] mb-1.5">Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} onBlur={handleNameBlur} placeholder="e.g. Shadow of the Wolf" className={inputClass} />
          </div>
          <div>
            <label className="block text-sm text-[var(--color-text-muted)] mb-1.5">World</label>
            <input type="text" value={world} onChange={e => setWorld(e.target.value)} onBlur={handleWorldBlur} placeholder="e.g. Blackmoor" className={inputClass} />
          </div>
          <div>
            <label className="block text-sm text-[var(--color-text-muted)] mb-1.5">DM Email</label>
            <input type="email" value={dmEmail} onChange={e => setDmEmail(e.target.value)} onBlur={handleDmEmailBlur} placeholder="you@example.com" className={inputClass} />
            <p className="text-xs text-[var(--color-text-muted)] mt-1">Get an email when enough players confirm a Saturday</p>
          </div>
          <div>
            <label className="block text-sm text-[var(--color-text-muted)] mb-1.5">Site Description</label>
            <input type="text" value={description} onChange={e => setDescription(e.target.value)} onBlur={handleDescriptionBlur} placeholder="Shown in Discord embeds" className={inputClass} />
            <p className="text-xs text-[var(--color-text-muted)] mt-1">Appears in Discord/social previews when someone shares a link</p>
          </div>
          <div>
            <label className="block text-sm text-[var(--color-text-muted)] mb-1.5">Background</label>
            <textarea
              rows={8}
              value={background}
              onChange={e => setBackground(e.target.value)}
              onBlur={handleBackgroundBlur}
              placeholder="The campaign backstory…"
              className="w-full bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded px-3 py-2 text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]/40 focus:outline-none focus:border-[var(--color-gold)] font-serif text-[0.95rem] leading-relaxed resize-y"
            />
          </div>
          <div className="h-6 text-sm">
            {saving && <span className="text-[var(--color-text-muted)]">Saving...</span>}
            {saved && <span className="text-[var(--color-gold)]">Saved</span>}
          </div>
        </div>

        {/* Right: New Invitation circle + list */}
        <div className="flex flex-col items-center gap-4 flex-shrink-0 relative">
          <button
            onClick={() => { setShowCalendar(!showCalendar); setSelectedDates([]); }}
            className="rounded-full flex items-center justify-center transition-transform hover:scale-105"
            style={{ width: 64, height: 64, border: '2px solid rgba(201,168,76,0.4)', background: '#2e2825' }}
            title="New Invitation"
          >
            <span className="text-[var(--color-gold)] text-2xl leading-none">+</span>
          </button>
          <span className="text-[0.7rem] uppercase tracking-[0.15em] text-[var(--color-text-muted)] font-sans">New Invitation</span>

          {/* Calendar popup */}
          {showCalendar && (
            <div
              className="absolute top-20 right-0 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-4 z-50"
              style={{ width: 300 }}
            >
              {/* Month nav */}
              <div className="flex items-center justify-between mb-3">
                <button
                  onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); } else setCalMonth(m => m - 1); }}
                  className="text-[var(--color-text-muted)] hover:text-[var(--color-gold)] transition-colors px-2"
                >←</button>
                <span className="font-serif text-sm text-[var(--color-text)]">{formatMonthYear(calYear, calMonth)}</span>
                <button
                  onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); } else setCalMonth(m => m + 1); }}
                  className="text-[var(--color-text-muted)] hover:text-[var(--color-gold)] transition-colors px-2"
                >→</button>
              </div>

              {/* Day headers */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }} className="mb-1">
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                  <div key={d} className="text-center text-[0.6rem] text-[var(--color-text-muted)] font-sans uppercase">{d}</div>
                ))}
              </div>

              {/* Day cells */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
                {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} />)}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const iso = toISO(calYear, calMonth, day);
                  const isSelected = selectedDates.includes(iso);
                  const isPast = iso < todayISO;
                  return (
                    <button
                      key={day}
                      onClick={() => !isPast && toggleDate(iso)}
                      disabled={isPast}
                      className={`rounded-full flex items-center justify-center text-xs font-serif transition-all ${
                        isPast ? 'text-[#3d3530] cursor-default' : isSelected ? 'text-[#1a1614] font-bold' : 'text-[var(--color-text)] hover:bg-[#2e2825]'
                      }`}
                      style={{
                        width: 32, height: 32,
                        background: isSelected ? '#c9a84c' : 'transparent',
                      }}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>

              {/* Selected count + actions */}
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--color-border)]">
                <span className="text-xs text-[var(--color-text-muted)] font-sans">
                  {selectedDates.length}/5 dates
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setShowCalendar(false); setSelectedDates([]); }}
                    className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors px-2 py-1"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={createInvitation}
                    disabled={selectedDates.length === 0}
                    className="text-xs font-sans uppercase tracking-wider text-[#1a1614] px-3 py-1 rounded transition-colors"
                    style={{ background: selectedDates.length > 0 ? '#c9a84c' : '#5a4f46' }}
                  >
                    Create
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Invitation list */}
          {invitations.map(inv => (
            <div key={inv.id} className="flex flex-col items-center gap-1">
              <button
                onClick={() => copyLink(inv.slug)}
                className="text-xs font-serif text-[var(--color-gold)] hover:text-[#e0bc5a] transition-colors text-center"
                title="Copy link"
              >
                {inv.label}
              </button>
              {copied === inv.slug && (
                <span className="text-[0.6rem] text-[#4a8a65] font-sans">Copied!</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
