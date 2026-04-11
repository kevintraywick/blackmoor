'use client'; // needs onChange, setTimeout — browser-only

import { useState } from 'react';
import type { Session, Npc, MenagerieEntry } from '@/lib/types';
import { useAutosave } from '@/lib/useAutosave';
import { resolveImageUrl } from '@/lib/imageUrl';
import HpRing from '@/components/HpRing';

export default function SessionForm({ session, allNpcs: initialNpcs }: { session: Session; allNpcs: Npc[] }) {
  const [values, setValues] = useState<Record<string, string | number>>({
    number: session.number,
    title:  session.title,
    goal:   session.goal ?? '',
    scenes: session.scenes ?? '',
    notes:  session.notes ?? '',
  });

  const menagerie: MenagerieEntry[] = Array.isArray(session.menagerie) ? session.menagerie : [];

  const { save: autosave, status: saveStatus } = useAutosave(`/api/sessions/${session.id}`);

  function handleChange(key: string, value: string | number) {
    setValues(prev => ({ ...prev, [key]: value }));
    autosave({ [key]: value });
  }

  // Look up NPC data by id
  function getNpc(id: string): Npc | undefined {
    return initialNpcs.find(n => n.id === id);
  }

  const statusText = { idle: '', saving: 'saving…', saved: 'saved', failed: 'save failed — check connection' }[saveStatus];
  const statusColor = { idle: 'text-[var(--color-text-muted)]', saving: 'text-[var(--color-text-muted)]', saved: 'text-[#5a8a5a]', failed: 'text-[#c0392b]' }[saveStatus];

  const FIELDS = [
    { key: 'goal',   label: 'Goal / Hook',   rows: 3, placeholder: "What's the session goal? How does it open?" },
    { key: 'scenes', label: 'Scene',          rows: 4, placeholder: 'Encounters, beats, traps, treasure, exits…' },
  ] as const;

  return (
    <div className="max-w-[1000px] mx-auto px-8 py-8">

      {/* Save status indicator */}
      <div className={`fixed bottom-4 right-4 text-xs px-3 py-1 rounded border border-[var(--color-border)] bg-[var(--color-surface)] transition-opacity duration-200 ${saveStatus === 'idle' ? 'opacity-0' : 'opacity-100'} ${statusColor}`}>
        {statusText}
      </div>

      {/* Session header — number and title */}
      <div className="mb-8 pb-6 border-b border-[var(--color-border)]">
        <div className="flex items-baseline gap-2">
          <span className="text-[var(--color-gold)] text-3xl">#</span>
          <input
            type="number"
            value={values.number}
            min={1}
            onChange={e => handleChange('number', parseInt(e.target.value) || values.number)}
            className="bg-transparent border-none text-[var(--color-gold)] text-3xl w-14 outline-none [appearance:textfield]"
          />
          <input
            type="text"
            value={values.title}
            placeholder="Session Title"
            onChange={e => handleChange('title', e.target.value)}
            className="bg-transparent border-none text-[var(--color-text)] text-3xl flex-1 outline-none placeholder:text-[var(--color-text-muted)]"
          />
        </div>
      </div>

      {/* Goal / Hook and Scene Outline */}
      {FIELDS.map(f => (
        <div key={f.key} className="mb-7">
          <div className="text-[0.7rem] uppercase tracking-[0.15em] text-[var(--color-text-muted)] mb-1">{f.label}</div>
          <textarea
            rows={f.rows}
            value={values[f.key] as string}
            placeholder={f.placeholder}
            onChange={e => handleChange(f.key, e.target.value)}
            className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded text-[var(--color-text)] text-[0.95rem] leading-relaxed px-3 py-2 resize-y outline-none focus:border-[var(--color-gold)] placeholder:text-[var(--color-text-muted)] font-serif"
          />
        </div>
      ))}

      {/* ─── Menagerie ─── */}
      <div className="mb-7">
        <div className="text-[0.7rem] uppercase tracking-[0.15em] text-[var(--color-text-muted)] mb-2">Menagerie</div>
        <div className="min-h-[60px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-3 py-3">
          {menagerie.length === 0 ? (
            <p className="text-[#5a4a44] italic text-sm font-serif m-0">
              No creatures yet — add from the NPCs page
            </p>
          ) : (
            <div className="flex flex-wrap gap-4">
              {menagerie.map((entry, idx) => {
                const npc = getNpc(entry.npc_id);
                if (!npc) return null;
                const imgUrl = npc.image_path ? resolveImageUrl(npc.image_path) : null;
                const initial = npc.name.trim() ? npc.name.trim()[0].toUpperCase() : '?';

                return (
                  <div
                    key={idx}
                    className="flex flex-col items-center gap-1"
                  >
                    <div style={{ width: 46, height: 46 }}>
                      <HpRing current={entry.hp} max={entry.maxHp ?? entry.hp} ringPct={5}>
                        <div className="relative w-full h-full rounded-full border-2 border-[#1a1a1a] bg-[#2e2825] overflow-hidden">
                          {imgUrl ? (
                            <img src={imgUrl} alt={npc.name} className="w-full h-full object-cover absolute inset-0" />
                          ) : (
                            <span className="text-sm text-[var(--color-text-muted)] select-none font-serif absolute inset-0 flex items-center justify-center">
                              {initial}
                            </span>
                          )}
                        </div>
                      </HpRing>
                    </div>
                    <span className="text-[0.6rem] uppercase tracking-[0.08em] text-[var(--color-text-muted)] max-w-[56px] truncate">
                      {entry.label || npc.name || 'Unnamed'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Notes */}
      <div className="mb-7">
        <div className="text-[0.7rem] uppercase tracking-[0.15em] text-[var(--color-text-muted)] mb-1">Notes</div>
        <textarea
          rows={3}
          value={values.notes as string}
          placeholder="Music, atmosphere, misc reminders…"
          onChange={e => handleChange('notes', e.target.value)}
          className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded text-[var(--color-text)] text-[0.95rem] leading-relaxed px-3 py-2 resize-y outline-none focus:border-[var(--color-gold)] placeholder:text-[var(--color-text-muted)] font-serif"
        />
      </div>

    </div>
  );
}
