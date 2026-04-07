'use client';

import { useState, useRef, useEffect } from 'react';
import { useAutosave } from '@/lib/useAutosave';
import type { DmMessage } from '@/lib/types';

type PlayerStatus = 'active' | 'away' | 'removed';

const STATUSES: { key: PlayerStatus; label: string }[] = [
  { key: 'active',  label: 'Active' },
  { key: 'removed', label: 'Delete' },
  { key: 'away',    label: 'Away'   },
];

export default function DmPlayerBox({
  playerId,
  playerName,
  initialNotes,
  initialStatus,
}: {
  playerId: string;
  playerName: string;
  initialNotes: string;
  initialStatus: PlayerStatus;
}) {
  const [notes, setNotes]             = useState(initialNotes);
  const [status, setStatus]           = useState<PlayerStatus>(initialStatus);
  const [confirmRemove, setConfirm]   = useState(false);
  const [dmMessage, setDmMessage]     = useState('');
  const [sending, setSending]         = useState(false);
  const [sent, setSent]               = useState(false);
  const [messages, setMessages]       = useState<DmMessage[]>([]);
  const sentTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    fetch(`/api/dm-messages?player_id=${playerId}`)
      .then(r => r.json())
      .then((rows: DmMessage[]) => setMessages(rows))
      .catch(() => {});
  }, [playerId]);

  const { save } = useAutosave(`/api/players/${playerId}`);

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

  async function sendDmMessage() {
    if (!dmMessage.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch('/api/dm-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_id: playerId, message: dmMessage.trim() }),
      });
      const row: DmMessage = await res.json();
      setMessages(prev => [row, ...prev]);
      setDmMessage('');
      setSent(true);
      clearTimeout(sentTimer.current);
      sentTimer.current = setTimeout(() => setSent(false), 2000);
    } finally {
      setSending(false);
    }
  }

  function formatTime(epoch: number) {
    const d = new Date(epoch * 1000);
    const mon = d.toLocaleString('en-US', { month: 'short' });
    const day = d.getDate();
    const h = d.getHours();
    const m = d.getMinutes().toString().padStart(2, '0');
    const ampm = h >= 12 ? 'pm' : 'am';
    return `${mon} ${day} · ${h % 12 || 12}:${m}${ampm}`;
  }

  const dotColor: Record<PlayerStatus, string> = {
    active:  'border-[#4a7a5a] bg-[#4a7a5a]',
    away:    'border-[#8a7d3a] bg-[#8a7d3a]',
    removed: 'border-[#7a3a3a] bg-[#7a3a3a]',
  };
  const labelColor: Record<PlayerStatus, string> = {
    active:  'text-[#5ab87a]',
    away:    'text-[var(--color-gold)]',
    removed: 'text-[#c05050]',
  };

  return (
    <div className="flex gap-3 mb-4 items-stretch">

      {/* Green pane: DM Notes + Status */}
      <div className="flex-1 border border-[#4a7a5a] rounded bg-[#161d18] px-4 py-3 flex gap-0 items-stretch">
        {/* DM Notes */}
        <div className="flex-1 min-w-0 pr-4">
          <div className="text-[0.6rem] uppercase tracking-[0.15em] text-[#4a8a5a] mb-1.5">DM Notes</div>
          <textarea
            rows={3}
            value={notes}
            onChange={e => handleNotesChange(e.target.value)}
            placeholder="Upcoming absences, hooks, reminders…"
            className="w-full bg-transparent border border-[#243a2c] rounded text-[var(--color-text-body)] text-[0.88rem] leading-relaxed px-2 py-1.5 resize-none outline-none focus:border-[#4a7a5a] placeholder:text-[#374a3e] font-serif"
          />
        </div>

        {/* Divider */}
        <div className="w-px bg-[#243a2c] flex-shrink-0 self-stretch" />

        {/* Status radio buttons */}
        <div className="flex-shrink-0 pl-4 flex flex-col justify-center gap-2">
          <div className="text-[0.6rem] uppercase tracking-[0.15em] text-[#4a8a5a] mb-0.5">Status</div>
          {STATUSES.map(s => {
            const active = status === s.key;
            return (
              <label key={s.key} className="flex items-center gap-2 cursor-pointer select-none" onClick={() => handleStatusClick(s.key)}>
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                  active ? dotColor[s.key] : 'border-[#2a4a35] bg-transparent'
                }`}>
                  {active && <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-bg)]" />}
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

      {/* Red pane: DM's DMs */}
      <div className="border border-[#7a3a3a] rounded bg-[#1d1616] flex flex-col" style={{ width: 280 }}>
        {/* Compose area */}
        <div className="relative" style={{ minHeight: 80 }}>
          <textarea
            value={dmMessage}
            onChange={e => setDmMessage(e.target.value)}
            placeholder={`Message ${playerName}…`}
            rows={2}
            className="w-full bg-transparent text-[var(--color-text-body)] text-[0.82rem] leading-relaxed px-3 py-2.5 resize-none outline-none placeholder:text-[#5a3a3a] font-serif"
          />
          <button
            onClick={sendDmMessage}
            disabled={!dmMessage.trim() || sending}
            className="absolute bottom-2 text-base bg-transparent border-none disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed transition-opacity hover:scale-110" style={{ right: '12px' }}
            title="Send message"
          >
            {sent ? '✓' : '📨'}
          </button>
        </div>

        {/* Sent messages */}
        {messages.length > 0 && (
          <div className="border-t border-[#3a2222] px-3 py-2">
            <div className="text-[0.55rem] uppercase tracking-[0.15em] text-[#6a4a4a] mb-1.5">Sent</div>
            {messages.map(m => (
              <div key={m.id} className="mb-2 last:mb-0">
                <div className="flex items-start gap-1.5">
                  <div
                    style={{ width: 7, height: 7, borderRadius: '50%', marginTop: 5, flexShrink: 0,
                      backgroundColor: m.read ? '#3a2e2e' : '#dc2626',
                    }}
                    title={m.read ? 'Read' : 'Unread'}
                  />
                  <div className={`text-[0.78rem] leading-snug font-serif ${m.read ? 'text-[#6a5a5a]' : 'text-[var(--color-text-body)]'}`}>
                    {m.message}
                  </div>
                </div>
                <div className="text-[0.6rem] text-[#5a3a3a] ml-[13px] mt-0.5">{formatTime(m.created_at)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
