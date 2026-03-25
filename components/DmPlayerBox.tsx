'use client';

import { useState, useRef, useCallback } from 'react';

type PlayerStatus = 'active' | 'away' | 'removed';

const STATUSES: { key: PlayerStatus; label: string }[] = [
  { key: 'active',  label: 'Active' },
  { key: 'removed', label: 'Delete' },
  { key: 'away',    label: 'Away'   },
];

export default function DmPlayerBox({
  playerId,
  initialNotes,
  initialStatus,
}: {
  playerId: string;
  initialNotes: string;
  initialStatus: PlayerStatus;
}) {
  const [notes, setNotes]             = useState(initialNotes);
  const [status, setStatus]           = useState<PlayerStatus>(initialStatus);
  const [confirmRemove, setConfirm]   = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback((patch: Record<string, unknown>) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      fetch(`/api/players/${playerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
    }, 600);
  }, [playerId]);

  function handleNotesChange(v: string) {
    setNotes(v);
    save({ dm_notes: v });
  }

  function handleStatusClick(s: PlayerStatus) {
    if (s === status) return;
    if (s === 'removed') { setConfirm(true); return; }
    setStatus(s);
    save({ status: s });
    setConfirm(false);
  }

  function confirmRemoval() {
    setStatus('removed');
    save({ status: 'removed' });
    setConfirm(false);
  }

  const dotColor: Record<PlayerStatus, string> = {
    active:  'border-[#4a7a5a] bg-[#4a7a5a]',
    away:    'border-[#8a7d3a] bg-[#8a7d3a]',
    removed: 'border-[#7a3a3a] bg-[#7a3a3a]',
  };
  const labelColor: Record<PlayerStatus, string> = {
    active:  'text-[#5ab87a]',
    away:    'text-[#c9a84c]',
    removed: 'text-[#c05050]',
  };

  return (
    <div className="border border-[#4a7a5a] rounded bg-[#161d18] px-4 py-3 mb-4 flex gap-0 items-stretch">

      {/* Left: DM Notes */}
      <div className="flex-1 min-w-0 pr-4">
        <div className="text-[0.6rem] uppercase tracking-[0.15em] text-[#4a8a5a] mb-1.5">DM Notes</div>
        <textarea
          rows={3}
          value={notes}
          onChange={e => handleNotesChange(e.target.value)}
          placeholder="Upcoming absences, hooks, reminders…"
          className="w-full bg-transparent border border-[#243a2c] rounded text-[#c8bfb5] text-[0.88rem] leading-relaxed px-2 py-1.5 resize-none outline-none focus:border-[#4a7a5a] placeholder:text-[#374a3e] font-serif"
        />
      </div>

      {/* Divider */}
      <div className="w-px bg-[#243a2c] flex-shrink-0 self-stretch" />

      {/* Right: Status radio buttons */}
      <div className="flex-shrink-0 pl-4 flex flex-col justify-center gap-2">
        <div className="text-[0.6rem] uppercase tracking-[0.15em] text-[#4a8a5a] mb-0.5">Status</div>
        {STATUSES.map(s => {
          const active = status === s.key;
          return (
            <label key={s.key} className="flex items-center gap-2 cursor-pointer select-none" onClick={() => handleStatusClick(s.key)}>
              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                active ? dotColor[s.key] : 'border-[#2a4a35] bg-transparent'
              }`}>
                {active && <div className="w-1.5 h-1.5 rounded-full bg-[#1a1614]" />}
              </div>
              <span className={`font-serif text-sm transition-colors ${active ? labelColor[s.key] : 'text-[#4a6a55]'}`}>
                {s.label}
              </span>
            </label>
          );
        })}

        {confirmRemove && (
          <div className="mt-1 border-t border-[#243a2c] pt-2">
            <div className="text-[0.68rem] text-[#c05050] mb-1.5">Remove this player?</div>
            <div className="flex gap-1.5">
              <button
                onClick={confirmRemoval}
                className="text-[0.68rem] px-2 py-0.5 text-[#c05050] border border-[#7a3a3a] rounded hover:bg-[#2a1414] transition-colors"
              >
                Remove
              </button>
              <button
                onClick={() => setConfirm(false)}
                className="text-[0.68rem] px-2 py-0.5 text-[#4a6a55] border border-[#243a2c] rounded hover:bg-[#1a2a20] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
