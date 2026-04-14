'use client';

import { useState, useRef, useEffect } from 'react';
import { useAutosave } from '@/lib/useAutosave';
import type { DmMessage } from '@/lib/types';

interface Sending { id: string; body: string; published_at: string }

type PlayerStatus = 'active' | 'away' | 'removed';

const STATUSES: { key: PlayerStatus; label: string }[] = [
  { key: 'active',  label: 'Active' },
  { key: 'removed', label: 'Delete' },
  { key: 'away',    label: 'Away'   },
];

export default function DmPlayerBox({
  playerId,
  playerName,
  playerClass,
  initialNotes,
  initialStatus,
}: {
  playerId: string;
  playerName: string;
  playerClass: string;
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
  const [sendings, setSendings]       = useState<Sending[]>([]);
  const [sendingText, setSendingText] = useState('');
  const [sendingSending, setSendingSending] = useState(false);
  const [sendingSent, setSendingSent] = useState(false);
  // Thieves' Cant state
  const [cantText, setCantText]       = useState('');
  const [cantSending, setCantSending] = useState(false);
  const [cantSent, setCantSent]       = useState(false);
  const [cants, setCants]             = useState<Sending[]>([]);
  // Druid Sign state
  const [druidText, setDruidText]     = useState('');
  const [druidSending, setDruidSending] = useState(false);
  const [druidSent, setDruidSent]     = useState(false);
  const [druidSigns, setDruidSigns]   = useState<Sending[]>([]);

  const sentTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const sendingSentTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const cantSentTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const druidSentTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const classLower = playerClass.toLowerCase();
  const isRogue = classLower.includes('rogue');
  const isDruid = classLower.includes('druid');

  useEffect(() => {
    fetch(`/api/dm-messages?player_id=${playerId}`)
      .then(r => r.json())
      .then((rows: DmMessage[]) => setMessages(rows))
      .catch(() => {});
    fetch(`/api/raven-post/sendings?playerId=${playerId}`)
      .then(r => r.json())
      .then((rows: Sending[]) => setSendings(rows))
      .catch(() => {});
    fetch(`/api/raven-post/sendings?playerId=${playerId}&medium=cant`)
      .then(r => r.json())
      .then((rows: Sending[]) => setCants(rows))
      .catch(() => {});
    fetch(`/api/raven-post/sendings?playerId=${playerId}&medium=druid_sign`)
      .then(r => r.json())
      .then((rows: Sending[]) => setDruidSigns(rows))
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

  async function sendSending() {
    if (!sendingText.trim() || sendingSending) return;
    setSendingSending(true);
    try {
      const res = await fetch('/api/raven-post/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ medium: 'sending', body: sendingText.trim(), target_player: playerId, trust: 'official' }),
      });
      if (res.ok) {
        const item = await res.json();
        setSendings(prev => [{ id: item.id, body: item.body, published_at: item.published_at }, ...prev]);
        setSendingText('');
        setSendingSent(true);
        clearTimeout(sendingSentTimer.current);
        sendingSentTimer.current = setTimeout(() => setSendingSent(false), 2000);
      }
    } finally {
      setSendingSending(false);
    }
  }

  async function sendCant() {
    if (!cantText.trim() || cantSending) return;
    setCantSending(true);
    try {
      const res = await fetch('/api/raven-post/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ medium: 'cant', body: cantText.trim(), target_player: playerId, trust: 'whispered' }),
      });
      if (res.ok) {
        const item = await res.json();
        setCants(prev => [{ id: item.id, body: item.body, published_at: item.published_at }, ...prev]);
        setCantText('');
        setCantSent(true);
        clearTimeout(cantSentTimer.current);
        cantSentTimer.current = setTimeout(() => setCantSent(false), 2000);
      }
    } finally {
      setCantSending(false);
    }
  }

  async function sendDruidSign() {
    if (!druidText.trim() || druidSending) return;
    setDruidSending(true);
    try {
      const res = await fetch('/api/raven-post/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ medium: 'druid_sign', body: druidText.trim(), target_player: playerId, trust: 'whispered' }),
      });
      if (res.ok) {
        const item = await res.json();
        setDruidSigns(prev => [{ id: item.id, body: item.body, published_at: item.published_at }, ...prev]);
        setDruidText('');
        setDruidSent(true);
        clearTimeout(druidSentTimer.current);
        druidSentTimer.current = setTimeout(() => setDruidSent(false), 2000);
      }
    } finally {
      setDruidSending(false);
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

  function formatSendingTime(published_at: string) {
    const d = new Date(published_at);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
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

  // How many panes in row 2
  const row2Panes = [true, isRogue, isDruid].filter(Boolean).length;

  return (
    <div className="mb-4">

      {/* ── Row 1: DM Notes + Status | DM Messages ── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>

        {/* Green pane: DM Notes + Status */}
        <div className="flex-1 border border-[#4a7a5a] rounded bg-[#161d18] px-4 py-2 flex gap-0 items-stretch">
          {/* DM Notes */}
          <div className="flex-1 min-w-0 pr-4">
            <div className="text-[0.6rem] uppercase tracking-[0.15em] text-[#4a8a5a] mb-1.5">DM Notes</div>
            <textarea
              rows={2}
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

        {/* Red pane: DM Messages */}
        <div className="border border-[#7a3a3a] rounded bg-[#1d1616] flex flex-col" style={{ width: 280 }}>
          {/* Compose area */}
          <div className="relative" style={{ minHeight: 64 }}>
            <textarea
              value={dmMessage}
              onChange={e => setDmMessage(e.target.value)}
              placeholder={`Message ${playerName}…`}
              rows={1}
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

      {/* ── Row 2: Druid Sign | Thieves' Cant | Sendings ── */}
      <div style={{ display: 'flex', gap: 12 }}>

        {/* Druid Sign pane — only if Druid */}
        {isDruid && (
          <div className="border border-[#5ab87a] rounded bg-[#161d16] flex flex-col" style={{ flex: 1 }}>
            <div className="relative" style={{ minHeight: 56 }}>
              <div className="text-[0.55rem] uppercase tracking-[0.15em] text-[#5ab87a] px-3 pt-2 mb-1">🌿 Druid Sign</div>
              <textarea
                value={druidText}
                onChange={e => setDruidText(e.target.value)}
                placeholder="Scratch a druidic mark…"
                rows={1}
                className="w-full bg-transparent text-[var(--color-text-body)] text-[0.82rem] leading-relaxed px-3 py-1 resize-none outline-none placeholder:text-[#4a8a5a] font-serif italic"
              />
              <button
                onClick={sendDruidSign}
                disabled={!druidText.trim() || druidSending}
                className="absolute bottom-2 text-base bg-transparent border-none disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed transition-opacity hover:scale-110" style={{ right: '12px' }}
                title="Send druid sign"
              >
                {druidSent ? '✓' : '🌿'}
              </button>
            </div>
            {druidSigns.length > 0 && (
              <div className="border-t border-[#3a5a3a] px-3 py-2">
                <div className="text-[0.55rem] uppercase tracking-[0.15em] text-[#5ab87a] mb-1.5">Sent</div>
                {druidSigns.slice(0, 8).map(s => (
                  <div key={s.id} className="mb-2 last:mb-0">
                    <div className="text-[0.78rem] leading-snug font-serif italic text-[#b0e8b0]">{s.body}</div>
                    <div className="text-[0.6rem] text-[#5ab87a] mt-0.5">{formatSendingTime(s.published_at)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Thieves' Cant pane — only if Rogue */}
        {isRogue && (
          <div className="border border-[#5a5a3a] rounded bg-[#1d1d16] flex flex-col" style={{ flex: 1 }}>
            <div className="relative" style={{ minHeight: 56 }}>
              <div className="text-[0.55rem] uppercase tracking-[0.15em] text-[#8a8a5a] px-3 pt-2 mb-1">🗝️ Thieves&apos; Cant</div>
              <textarea
                value={cantText}
                onChange={e => setCantText(e.target.value)}
                placeholder="Leave a coded message…"
                rows={1}
                className="w-full bg-transparent text-[var(--color-text-body)] text-[0.82rem] leading-relaxed px-3 py-1 resize-none outline-none placeholder:text-[#5a5a3a] font-serif italic"
              />
              <button
                onClick={sendCant}
                disabled={!cantText.trim() || cantSending}
                className="absolute bottom-2 text-base bg-transparent border-none disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed transition-opacity hover:scale-110" style={{ right: '12px' }}
                title="Send thieves' cant"
              >
                {cantSent ? '✓' : '🗝️'}
              </button>
            </div>
            {cants.length > 0 && (
              <div className="border-t border-[#3a3a22] px-3 py-2">
                <div className="text-[0.55rem] uppercase tracking-[0.15em] text-[#6a6a4a] mb-1.5">Sent</div>
                {cants.slice(0, 8).map(s => (
                  <div key={s.id} className="mb-2 last:mb-0">
                    <div className="text-[0.78rem] leading-snug font-serif italic text-[#c0c08a]">{s.body}</div>
                    <div className="text-[0.6rem] text-[#5a5a3a] mt-0.5">{formatSendingTime(s.published_at)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Purple pane: Sendings — always visible */}
        <div className="border border-[#5a3a6a] rounded bg-[#1d161e] flex flex-col" style={{ flex: 1 }}>
          <div className="relative" style={{ minHeight: 56 }}>
            <div className="text-[0.55rem] uppercase tracking-[0.15em] text-[#6a4a6a] px-3 pt-2 mb-1">✦ Sending</div>
            <textarea
              value={sendingText}
              onChange={e => setSendingText(e.target.value)}
              placeholder="≤25 words, cryptic…"
              rows={1}
              className="w-full bg-transparent text-[var(--color-text-body)] text-[0.82rem] leading-relaxed px-3 py-1 resize-none outline-none placeholder:text-[#4a3050] font-serif italic"
            />
            <button
              onClick={sendSending}
              disabled={!sendingText.trim() || sendingSending}
              className="absolute bottom-2 text-base bg-transparent border-none disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed transition-opacity hover:scale-110" style={{ right: '12px' }}
              title="Send sending"
            >
              {sendingSent ? '✓' : '✦'}
            </button>
          </div>

          {sendings.length > 0 && (
            <div className="border-t border-[#2a1a30] px-3 py-2">
              <div className="text-[0.55rem] uppercase tracking-[0.15em] text-[#6a4a6a] mb-1.5">Sent</div>
              {sendings.slice(0, 8).map(s => (
                <div key={s.id} className="mb-2 last:mb-0">
                  <div className="text-[0.78rem] leading-snug font-serif italic text-[#c4a8d0]">{s.body}</div>
                  <div className="text-[0.6rem] text-[#4a3050] mt-0.5">{formatSendingTime(s.published_at)}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Hint when no class-specific panes */}
        {!isRogue && !isDruid && row2Panes === 1 && null}
      </div>

    </div>
  );
}
