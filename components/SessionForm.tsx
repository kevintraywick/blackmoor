'use client'; // needs onChange, setTimeout — browser-only

import { useState, useRef, useCallback } from 'react';
import type { Session } from '@/lib/types';

// The editable fields and their labels/placeholders
const FIELDS = [
  { key: 'goal',       label: 'Goal / Hook',    rows: 3,  placeholder: "What's the session goal? How does it open?",    cols: 1 },
  { key: 'scenes',     label: 'Scene Outline',  rows: 7,  placeholder: 'Encounters, beats, traps, treasure, exits…',    cols: 1 },
  { key: 'npcs',       label: 'Key NPCs',       rows: 5,  placeholder: 'Names, roles, motivations…',                    cols: 2 },
  { key: 'locations',  label: 'Locations',      rows: 5,  placeholder: 'Key locations and descriptions…',               cols: 2 },
  { key: 'loose_ends', label: 'Loose Ends',     rows: 4,  placeholder: 'Unresolved threads from last session…',         cols: 2 },
  { key: 'notes',      label: 'Notes',          rows: 4,  placeholder: 'Music, atmosphere, misc reminders…',            cols: 2 },
] as const;

type FieldKey = (typeof FIELDS)[number]['key'];

type SaveStatus = 'idle' | 'saving' | 'saved' | 'failed';

export default function SessionForm({ session }: { session: Session }) {
  // Local state mirrors the session so we can update fields without a round-trip
  const [values, setValues] = useState<Record<string, string | number>>({
    number: session.number,
    title:  session.title,
    date:   session.date,
    ...Object.fromEntries(FIELDS.map(f => [f.key, session[f.key as keyof Session] ?? ''])),
  });

  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced autosave — fires 600ms after the last keystroke
  const autosave = useCallback((patch: Partial<typeof values>) => {
    setSaveStatus('saving');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/sessions/${session.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        });
        if (!res.ok) throw new Error('Save failed');
        setSaveStatus('saved');
        // Clear the "saved" indicator after 2 seconds
        setTimeout(() => setSaveStatus('idle'), 2000);
      } catch {
        setSaveStatus('failed');
      }
    }, 600);
  }, [session.id]);

  // Update local state and trigger autosave when any field changes
  function handleChange(key: string, value: string | number) {
    const updated = { ...values, [key]: value };
    setValues(updated);
    autosave({ [key]: value });
  }

  const statusText = { idle: '', saving: 'saving…', saved: 'saved', failed: 'save failed — check connection' }[saveStatus];
  const statusColor = { idle: 'text-[#8a7d6e]', saving: 'text-[#8a7d6e]', saved: 'text-[#5a8a5a]', failed: 'text-[#c0392b]' }[saveStatus];

  return (
    <div className="max-w-[860px] mx-auto px-8 py-8">

      {/* Save status indicator */}
      <div className={`fixed bottom-4 right-4 text-xs px-3 py-1 rounded border border-[#3d3530] bg-[#231f1c] transition-opacity duration-200 ${saveStatus === 'idle' ? 'opacity-0' : 'opacity-100'} ${statusColor}`}>
        {statusText}
      </div>

      {/* Session header — number, title, date */}
      <div className="mb-8 pb-6 border-b border-[#3d3530]">
        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-[#c9a84c] text-3xl">#</span>
          {/* Number field */}
          <input
            type="number"
            value={values.number}
            min={1}
            onChange={e => handleChange('number', parseInt(e.target.value) || values.number)}
            className="bg-transparent border-none text-[#c9a84c] text-3xl w-14 outline-none [appearance:textfield]"
          />
          {/* Title field */}
          <input
            type="text"
            value={values.title}
            placeholder="Session Title"
            onChange={e => handleChange('title', e.target.value)}
            className="bg-transparent border-none text-[#e8ddd0] text-3xl flex-1 outline-none placeholder:text-[#8a7d6e]"
          />
        </div>
        {/* Date field */}
        <input
          type="text"
          value={values.date}
          placeholder="Date"
          onChange={e => handleChange('date', e.target.value)}
          className="bg-transparent border-none border-b border-transparent focus:border-[#3d3530] text-[#8a7d6e] text-sm italic outline-none placeholder:text-[#3d3530]"
        />
      </div>

      {/* Full-width fields (cols: 1) */}
      {FIELDS.filter(f => f.cols === 1).map(f => (
        <div key={f.key} className="mb-7">
          <div className="text-[0.7rem] uppercase tracking-[0.15em] text-[#8a7d6e] mb-1">{f.label}</div>
          <textarea
            rows={f.rows}
            value={values[f.key as FieldKey] as string}
            placeholder={f.placeholder}
            onChange={e => handleChange(f.key, e.target.value)}
            className="w-full bg-[#231f1c] border border-[#3d3530] rounded text-[#e8ddd0] text-[0.95rem] leading-relaxed px-3 py-2 resize-y outline-none focus:border-[#c9a84c] placeholder:text-[#8a7d6e] font-serif"
          />
        </div>
      ))}

      {/* Two-column fields (cols: 2) — paired by order */}
      {(() => {
        const twoCols = FIELDS.filter(f => f.cols === 2);
        const pairs: (typeof FIELDS[number])[][] = [];
        for (let i = 0; i < twoCols.length; i += 2) pairs.push([twoCols[i], twoCols[i + 1]].filter(Boolean));
        return pairs.map((pair, i) => (
          <div key={i} className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-7">
            {pair.map(f => (
              <div key={f.key}>
                <div className="text-[0.7rem] uppercase tracking-[0.15em] text-[#8a7d6e] mb-1">{f.label}</div>
                <textarea
                  rows={f.rows}
                  value={values[f.key as FieldKey] as string}
                  placeholder={f.placeholder}
                  onChange={e => handleChange(f.key, e.target.value)}
                  className="w-full bg-[#231f1c] border border-[#3d3530] rounded text-[#e8ddd0] text-[0.95rem] leading-relaxed px-3 py-2 resize-y outline-none focus:border-[#c9a84c] placeholder:text-[#8a7d6e] font-serif"
                />
              </div>
            ))}
          </div>
        ));
      })()}
    </div>
  );
}
