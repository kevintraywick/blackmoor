# DM Sessions Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the draggable session list on `/dm` with a session picker row (boxes) and an inline session form, so the DM never leaves the page to edit session prep.

**Architecture:** A new `DmSessionsClient` client component handles all state: selected session, field values, autosave. It replaces `SessionList` on the DM page. The component renders a horizontal row of session boxes and a full-height detail panel below. No drag-to-reorder. All existing API routes are kept unchanged.

**Tech Stack:** Next.js 15 App Router, React client component, Tailwind CSS v4, existing PostgreSQL API routes.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `components/DmSessionsClient.tsx` | **Create** | Session box row + inline form + autosave state |
| `app/dm/page.tsx` | **Modify** | Remove max-w wrapper and SessionList; pass sessions to DmSessionsClient |

All other files are untouched.

---

### Task 1: Create DmSessionsClient component

**Files:**
- Create: `components/DmSessionsClient.tsx`

This component receives `initial: Session[]` from the server, renders the session box row and detail panel inline. No navigation on session click.

- [ ] **Step 1: Create the file with imports and types**

```tsx
'use client';

import { useState, useRef, useCallback } from 'react';
import type { Session } from '@/lib/types';

// Fields to render in the detail panel — matches SessionForm's FIELDS array
const FIELDS = [
  { key: 'goal',       label: 'Goal / Hook',    rows: 3,  placeholder: "What's the session goal? How does it open?",   cols: 1 },
  { key: 'scenes',     label: 'Scene Outline',  rows: 7,  placeholder: 'Encounters, beats, traps, treasure, exits…',   cols: 1 },
  { key: 'npcs',       label: 'Key NPCs',       rows: 5,  placeholder: 'Names, roles, motivations…',                   cols: 2 },
  { key: 'locations',  label: 'Locations',      rows: 5,  placeholder: 'Key locations and descriptions…',              cols: 2 },
  { key: 'loose_ends', label: 'Loose Ends',     rows: 4,  placeholder: 'Unresolved threads from last session…',        cols: 2 },
  { key: 'notes',      label: 'Notes',          rows: 4,  placeholder: 'Music, atmosphere, misc reminders…',           cols: 2 },
] as const;

type FieldKey = (typeof FIELDS)[number]['key'];
type SaveStatus = 'idle' | 'saving' | 'saved' | 'failed';

// Empty field values for a new/unselected session
function emptyValues(session: Session): Record<string, string | number> {
  return {
    title: session.title,
    date:  session.date,
    ...Object.fromEntries(FIELDS.map(f => [f.key, session[f.key as keyof Session] ?? ''])),
  };
}
```

- [ ] **Step 2: Write the component function with state**

Append to the file:

```tsx
export default function DmSessionsClient({ initial }: { initial: Session[] }) {
  const [sessions, setSessions] = useState<Session[]>(initial);
  const [selectedId, setSelectedId] = useState<string | null>(
    initial.length > 0 ? initial[0].id : null
  );
  const [values, setValues] = useState<Record<string, string | number>>(
    initial.length > 0 ? emptyValues(initial[0]) : {}
  );
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selected = sessions.find(s => s.id === selectedId) ?? null;

  // Switch selected session — update values to match
  function handleSelect(session: Session) {
    setSelectedId(session.id);
    setValues(emptyValues(session));
    setSaveStatus('idle');
  }

  // Debounced autosave — fires 600ms after the last keystroke
  const autosave = useCallback((id: string, patch: Record<string, string | number>) => {
    setSaveStatus('saving');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/sessions/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        });
        if (!res.ok) throw new Error('Save failed');
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } catch {
        setSaveStatus('failed');
      }
    }, 600);
  }, []);

  function handleChange(key: string, value: string | number) {
    if (!selectedId) return;
    const updated = { ...values, [key]: value };
    setValues(updated);
    autosave(selectedId, { [key]: value });
    // Mirror title/date changes into the sessions array for the box row
    if (key === 'title' || key === 'date') {
      setSessions(prev => prev.map(s =>
        s.id === selectedId ? { ...s, [key]: value as string } : s
      ));
    }
  }

  // Create a new session and auto-select it
  async function handleNew() {
    const maxNum = sessions.reduce((m, s) => Math.max(m, s.number), 0);
    const id = Date.now().toString(36);
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, number: maxNum + 1 }),
    });
    if (!res.ok) { console.error('Failed to create session'); return; }
    const session: Session = await res.json();
    setSessions(prev => [...prev, session]);
    handleSelect(session);
  }

  const statusText = { idle: '', saving: 'saving…', saved: 'saved', failed: 'save failed' }[saveStatus];
  const statusColor = {
    idle: '',
    saving: 'text-[#8a7d6e]',
    saved: 'text-[#5a8a5a]',
    failed: 'text-[#c0392b]',
  }[saveStatus];
```

- [ ] **Step 3: Write the session box row JSX**

Append the return statement to the component:

```tsx
  return (
    <div>
      {/* Session box row */}
      <div className="border-b border-[#3d3530] bg-[#1e1b18] px-6 py-4">
        <div className="flex gap-2.5 overflow-x-auto pb-1">
          {sessions.map(s => {
            const isSelected = s.id === selectedId;
            return (
              <button
                key={s.id}
                onClick={() => handleSelect(s)}
                className={`flex-shrink-0 w-[88px] rounded px-2 py-2.5 flex flex-col items-center gap-1 text-left transition-colors border ${
                  isSelected
                    ? 'border-[#c9a84c] bg-[#231f1c]'
                    : 'border-[#3d3530] bg-[#1a1614] hover:border-[#5a4a44]'
                }`}
              >
                <span className={`text-xl font-bold leading-none font-serif ${isSelected ? 'text-[#c9a84c]' : 'text-[#8a7d6e]'}`}>
                  #{s.number}
                </span>
                <span className="text-[9px] text-[#5a4a44] text-center leading-tight w-full overflow-hidden whitespace-nowrap text-ellipsis">
                  {s.title || 'Untitled'}
                </span>
                {s.date && (
                  <span className="text-[8px] text-[#3d3530]">{s.date}</span>
                )}
              </button>
            );
          })}

          {/* + box */}
          <button
            onClick={handleNew}
            className="flex-shrink-0 w-[88px] rounded border border-dashed border-[#3d3530] bg-transparent flex items-center justify-center text-[#3d3530] text-2xl hover:border-[#5a4a44] hover:text-[#5a4a44] transition-colors"
            title="New session"
          >
            +
          </button>
        </div>
      </div>
```

- [ ] **Step 4: Write the session detail panel JSX**

Append inside the return, after the session box row div:

```tsx
      {/* Session detail panel */}
      <div className="px-8 py-8 max-w-[860px]">
        {!selected ? (
          <p className="text-[#5a4a44] font-serif italic text-sm">
            No sessions yet — click + to create your first one.
          </p>
        ) : (
          <div>
            {/* Header: #N title / date */}
            <div className="mb-8 pb-6 border-b border-[#3d3530]">
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-[#c9a84c] text-3xl font-serif">#{selected.number}</span>
                <input
                  type="text"
                  value={values.title as string}
                  placeholder="Session Title"
                  onChange={e => handleChange('title', e.target.value)}
                  className="bg-transparent border-none text-[#e8ddd0] text-3xl flex-1 outline-none placeholder:text-[#8a7d6e] font-serif"
                />
              </div>
              <input
                type="text"
                value={values.date as string}
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
              for (let i = 0; i < twoCols.length; i += 2) {
                pairs.push([twoCols[i], twoCols[i + 1]].filter(Boolean));
              }
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

            {/* Save status — inline, bottom of form */}
            <div className={`text-xs text-right mt-2 h-4 transition-opacity duration-200 ${saveStatus === 'idle' ? 'opacity-0' : 'opacity-100'} ${statusColor}`}>
              {statusText}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Verify the file looks right**

Run: `npx tsc --noEmit 2>&1 | head -30`

Expected: No errors from `DmSessionsClient.tsx`. If there are type errors, fix them before continuing.

- [ ] **Step 6: Commit**

```bash
git add components/DmSessionsClient.tsx
git commit -m "feat: add DmSessionsClient with session box row and inline form"
```

---

### Task 2: Update app/dm/page.tsx

**Files:**
- Modify: `app/dm/page.tsx`

Remove the campaign title heading, the `max-w-[480px]` wrapper, and the `SessionList` import. Pass sessions to `DmSessionsClient` instead.

- [ ] **Step 1: Read the current file**

Read `app/dm/page.tsx` and confirm it still matches this structure:

```tsx
export const dynamic = 'force-dynamic';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import type { Session } from '@/lib/types';
import SessionList from '@/components/SessionList';
import DmNav from '@/components/DmNav';
// ...
```

- [ ] **Step 2: Replace the file contents**

Write the new version:

```tsx
export const dynamic = 'force-dynamic';

import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import type { Session } from '@/lib/types';
import DmSessionsClient from '@/components/DmSessionsClient';
import DmNav from '@/components/DmNav';

async function getSessions() {
  await ensureSchema();
  return query<Session>('SELECT * FROM sessions ORDER BY sort_order ASC, number ASC');
}

export default async function DMPage() {
  const sessions = await getSessions();

  return (
    <div className="min-h-screen bg-[#1a1614] text-[#e8ddd0]">
      <DmNav current="sessions" />
      <DmSessionsClient initial={sessions} />
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -30`

Expected: No errors.

- [ ] **Step 4: Manual smoke test**

Start the dev server if not running: `npm run dev`

Visit `http://localhost:3000/dm` and verify:
- Session boxes appear in a horizontal row below the nav
- Clicking a box shows its detail form below
- Editing a field triggers autosave (check "saving…" → "saved" indicator)
- Clicking `+` creates a new session box and opens it
- Title changes in the form update the box label in real time

- [ ] **Step 5: Commit**

```bash
git add "app/dm/page.tsx"
git commit -m "feat: replace SessionList with DmSessionsClient on DM page"
```
