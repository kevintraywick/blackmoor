'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { Npc, Player, MenagerieEntry } from '@/lib/types';
import { resolveImageUrl } from '@/lib/imageUrl';
import { rollDice } from '@/lib/dice';

interface SessionMeta { id: string; number: number; title: string; npc_ids: string[]; menagerie: MenagerieEntry[]; }

interface Combatant {
  id: string;
  name: string;
  subName?: string;
  type: 'player' | 'npc';
  initiative: number;
  rolled: boolean;
  img?: string;
  initial: string;
  imagePath?: string | null;
  hp?: number;
  maxHp?: number;
  npcData?: Pick<Npc, 'ac' | 'speed' | 'cr' | 'attacks' | 'traits' | 'actions'>;
}

interface CombatState {
  results: Combatant[];
  currentTurn: number;
  round: number;
  turnDone?: boolean[];
}

function InitCounter({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-1 flex-shrink-0">
      <button
        type="button"
        onClick={() => onChange(value - 1)}
        className="w-7 h-7 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-muted)]
                   flex items-center justify-center hover:border-[var(--color-gold)] hover:text-[var(--color-text)]
                   transition-colors text-lg leading-none"
      >−</button>
      <input
        inputMode="numeric"
        value={value === 0 ? '' : String(value)}
        placeholder="—"
        onChange={e => {
          const n = parseInt(e.target.value, 10);
          onChange(isNaN(n) ? 0 : n);
        }}
        className="w-12 bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-1 py-1.5
                   text-[var(--color-text)] text-base focus:outline-none focus:border-[var(--color-gold)]
                   text-center placeholder:text-[var(--color-text-dim)]"
      />
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        className="w-7 h-7 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-muted)]
                   flex items-center justify-center hover:border-[var(--color-gold)] hover:text-[var(--color-text)]
                   transition-colors text-lg leading-none"
      >+</button>
    </div>
  );
}

export default function InitiativePageClient({
  sessions,
  npcs,
  playerStatuses = {},
  playerHp = {},
  players = [],
}: {
  sessions: SessionMeta[];
  npcs: Npc[];
  playerStatuses?: Record<string, string>;
  playerHp?: Record<string, number>;
  players?: Player[];
}) {
  const activePlayers = players.filter(p => {
    const s = playerStatuses[p.id] ?? 'active';
    return s !== 'away' && s !== 'removed';
  });

  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(() => {
    try {
      const lastId = localStorage.getItem('blackmoor-last-session');
      if (lastId && sessions.some(s => s.id === lastId)) return lastId;
    } catch { /* silent */ }
    return sessions[0]?.id ?? null;
  });
  const [playerInits, setPlayerInits] = useState<Record<string, number>>(
    Object.fromEntries(players.map(p => [p.id, 0]))
  );
  const [npcBonuses, setNpcBonuses] = useState<Record<string, number>>(
    Object.fromEntries(npcs.map(n => [n.id, 0]))
  );

  const [results, setResults] = useState<Combatant[] | null>(null);
  const [currentTurn, setCurrentTurn] = useState(0);
  const [round, setRound] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [turnDone, setTurnDone] = useState<boolean[]>([]);

  // Menagerie — persistent NPC HP tracking across combats
  const menagerieRef = useRef<MenagerieEntry[]>([]);
  const combatSessionIdRef = useRef<string | null>(null);
  const menagerieSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function saveMenagerie(sessionId: string, menagerie: MenagerieEntry[]) {
    if (menagerieSaveTimer.current) clearTimeout(menagerieSaveTimer.current);
    menagerieSaveTimer.current = setTimeout(() => {
      fetch(`/api/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ menagerie }),
      }).catch(() => {});
    }, 500);
  }

  const STORAGE_KEY = 'blackmoor-combat-state';

  // Persist combat state to localStorage
  const persistCombat = useCallback((r: Combatant[], turn: number, rnd: number, done?: boolean[]) => {
    try {
      const state: CombatState = { results: r, currentTurn: turn, round: rnd, turnDone: done };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch { /* silent */ }
  }, []);

  // Restore combat state on mount (skip if fresh=1 query param)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('fresh') === '1') {
        localStorage.removeItem(STORAGE_KEY);
        // Clean the URL without reloading
        window.history.replaceState({}, '', window.location.pathname);
        return;
      }
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const state: CombatState = JSON.parse(raw);
      if (state.results?.length) {
        setResults(state.results);
        setCurrentTurn(state.currentTurn ?? 0);
        setRound(state.round ?? 1);
        setTurnDone(state.turnDone ?? new Array(state.results.length).fill(false));
      }
    } catch { /* silent */ }
  }, []);

  const selectedSession = sessions.find(s => s.id === selectedSessionId) ?? null;
  const sessionNpcIds = Array.isArray(selectedSession?.npc_ids) ? selectedSession.npc_ids : [];

  function handleGo() {
    if (!selectedSession) return;
    const combatants: Combatant[] = [];

    activePlayers.forEach(p => {
      const entered = playerInits[p.id] ?? 0;
      const hp = playerHp[p.id] ?? 0;
      combatants.push({
        id: p.id,
        name: p.character,
        subName: p.playerName,
        type: 'player',
        initiative: entered > 0 ? entered : (rollDice('1d20') ?? Math.ceil(Math.random() * 20)),
        rolled: entered === 0,
        img: p.img,
        initial: p.initial,
        hp,
        maxHp: hp,
      });
    });

    // ── Sync menagerie with npc_ids ──────────────────────────────────────────
    // Existing menagerie entries carry HP from previous combats.
    // New entries get a fresh roll. Removed NPCs are pruned.
    const existingMenagerie = Array.isArray(selectedSession.menagerie) ? selectedSession.menagerie : [];

    // Group existing entries by npc_id so we can consume them in order for duplicates
    const pool: Record<string, MenagerieEntry[]> = {};
    for (const entry of existingMenagerie) {
      (pool[entry.npc_id] ??= []).push(entry);
    }
    const consumed: Record<string, number> = {};

    // Count occurrences per NPC type to know if we need numbering
    const npcCounts: Record<string, number> = {};
    sessionNpcIds.forEach(id => { npcCounts[id] = (npcCounts[id] ?? 0) + 1; });
    const npcInstanceNum: Record<string, number> = {};
    const newMenagerie: MenagerieEntry[] = [];

    sessionNpcIds.forEach(npcId => {
      const n = npcs.find(x => x.id === npcId);
      if (!n) return;
      npcInstanceNum[npcId] = (npcInstanceNum[npcId] ?? 0) + 1;
      const count = npcCounts[npcId] ?? 1;
      const instanceNum = npcInstanceNum[npcId];
      const label = count > 1 ? `${n.name || 'Unnamed'} ${instanceNum}` : (n.name || 'Unnamed NPC');

      // Try to reuse an existing menagerie entry for this npc_id
      const idx = consumed[npcId] ?? 0;
      const existing = pool[npcId]?.[idx];
      consumed[npcId] = idx + 1;

      let hp: number | undefined;
      let maxHp: number | undefined;

      if (existing && existing.maxHp !== undefined) {
        // Returning NPC — use persisted HP
        hp = existing.hp;
        maxHp = existing.maxHp;
      } else {
        // New NPC or first combat — roll fresh HP
        const rolledHp = n.hp_roll ? rollDice(n.hp_roll) : (n.hp ? parseInt(n.hp, 10) : undefined);
        const hpVal = rolledHp && !isNaN(rolledHp) ? rolledHp : undefined;
        hp = hpVal;
        maxHp = hpVal;
      }

      newMenagerie.push({ npc_id: npcId, hp: hp ?? 0, maxHp: maxHp ?? 0, label });

      combatants.push({
        id: `${n.id}-${instanceNum}`,
        name: label,
        type: 'npc',
        initiative: Math.floor(Math.random() * 20) + 1 + (npcBonuses[n.id] ?? 0),
        rolled: true,
        initial: n.name?.trim()?.[0]?.toUpperCase() ?? '?',
        imagePath: n.image_path,
        hp,
        maxHp,
        npcData: { ac: n.ac, speed: n.speed, cr: n.cr, attacks: n.attacks, traits: n.traits, actions: n.actions },
      });
    });

    // Save menagerie to DB immediately (not debounced — this is the initial population)
    menagerieRef.current = newMenagerie;
    combatSessionIdRef.current = selectedSession.id;
    fetch(`/api/sessions/${selectedSession.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ menagerie: newMenagerie }),
    }).catch(() => {});

    combatants.sort((a, b) => {
      if (b.initiative !== a.initiative) return b.initiative - a.initiative;
      // Ties: players go before NPCs
      if (a.type === 'player' && b.type === 'npc') return -1;
      if (a.type === 'npc' && b.type === 'player') return 1;
      return 0;
    });

    const initialDone = new Array(combatants.length).fill(false);
    setResults(combatants);
    setCurrentTurn(0);
    setRound(1);
    setTurnDone(initialDone);
    persistCombat(combatants, 0, 1, initialDone);
  }

  function handleReset() {
    setResults(null);
    setCurrentTurn(0);
    setRound(1);
    setExpandedId(null);
    setTurnDone([]);
    setPlayerInits(Object.fromEntries(players.map(p => [p.id, 0])));
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* silent */ }
  }

  function updateCombatantHp(idx: number, delta: number) {
    if (!results) return;
    const updated = results.map((c, i) => {
      if (i !== idx || c.hp === undefined) return c;
      return { ...c, hp: Math.max(0, c.hp + delta) };
    });
    setResults(updated);
    persistCombat(updated, currentTurn, round, turnDone);

    // Write back NPC HP changes to menagerie in DB
    const c = updated[idx];
    if (c.type === 'npc' && c.hp !== undefined && combatSessionIdRef.current) {
      // Parse combatant id "npcId-instanceNum" to find menagerie entry
      const dashIdx = c.id.lastIndexOf('-');
      const npcId = c.id.slice(0, dashIdx);
      const instanceNum = parseInt(c.id.slice(dashIdx + 1), 10);

      // Find the matching menagerie entry (nth occurrence of this npc_id)
      let count = 0;
      for (let i = 0; i < menagerieRef.current.length; i++) {
        if (menagerieRef.current[i].npc_id === npcId) {
          count++;
          if (count === instanceNum) {
            menagerieRef.current[i] = { ...menagerieRef.current[i], hp: c.hp };
            break;
          }
        }
      }
      saveMenagerie(combatSessionIdRef.current, [...menagerieRef.current]);
    }

    // Write back PC HP changes to player sheet
    if (c.type === 'player' && c.hp !== undefined) {
      fetch(`/api/players/${c.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hp: String(c.hp) }),
      }).catch(() => {});
    }
  }


  // ── RESULTS VIEW ─────────────────────────────────────────────────────────────
  if (results) {
    return (
      <div className="max-w-[1000px] mx-auto px-4 py-8">
        <div className="flex justify-center mb-6">
          <button
            onClick={handleReset}
            className="rounded-full flex items-center justify-center hover:scale-110 transition-transform font-sans text-[0.7rem] uppercase tracking-[0.15em] text-white font-bold"
            style={{ width: 60, height: 60, background: 'transparent', border: '1px solid rgba(201,168,76,0.5)' }}
            title="Reset combat"
          >
            Reset
          </button>
        </div>

        <div className="flex flex-col gap-2">
          {results.map((c, i) => {
            const isActive = i === currentTurn;
            const isDead = c.type === 'npc' && c.hp !== undefined && c.hp <= 0;
            const imgUrl = c.type === 'npc' && c.imagePath ? resolveImageUrl(c.imagePath) : null;
            const isExpanded = expandedId === `${c.id}-${i}`;
            const hasStats = c.npcData && (c.npcData.attacks || c.npcData.traits || c.npcData.actions);

            return (
              <div key={`${c.id}-${i}`} className="flex flex-col">
                <div
                  onClick={() => setCurrentTurn(i)}
                  className={`flex items-center gap-3 px-4 py-3 border cursor-pointer transition-all ${
                    isDead ? 'opacity-40' : ''
                  } ${
                    isActive
                      ? 'border-[var(--color-gold)] bg-[#1a2535]'
                      : 'border-[var(--color-border)] bg-[var(--color-bg)] hover:border-[#5a4a44]'
                  } ${isExpanded ? 'rounded-t border-b-0' : 'rounded'}`}
                >
                  {/* Rank */}
                  <span className={`text-[0.7rem] w-5 text-right flex-shrink-0 font-serif ${
                    isActive ? 'text-[var(--color-gold)]' : 'text-[var(--color-border)]'
                  }`}>{i + 1}.</span>

                  {/* Initiative badge */}
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 border-2 font-serif font-bold text-lg ${
                    isActive
                      ? 'border-[var(--color-gold)] text-[var(--color-gold)] bg-[#2e2825]'
                      : c.type === 'player'
                        ? 'border-[#2d5a3f] text-[#4a8a65] bg-[#1a2520]'
                        : 'border-[#6a1a1a] text-[#a05050] bg-[#241414]'
                  }`}>
                    {c.initiative}
                  </div>

                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full overflow-hidden bg-[#2e2825] flex items-center justify-center flex-shrink-0 border border-[var(--color-border)]">
                    {c.type === 'player' && c.img ? (
                      <Image
                        src={c.img}
                        alt={c.name}
                        width={36}
                        height={36}
                        className="w-full h-full object-cover"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    ) : imgUrl ? (
                      <img src={imgUrl} alt={c.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-[0.9rem] text-[var(--color-text-muted)] font-serif">{c.initial}</span>
                    )}
                  </div>

                  {/* Name + sub info */}
                  <div className="flex-1 min-w-0">
                    <div
                      className={`font-serif text-sm leading-tight ${isDead ? 'line-through' : ''} text-[var(--color-text)] ${hasStats ? 'cursor-pointer hover:text-[var(--color-gold)] transition-colors' : ''}`}
                      onClick={hasStats ? (e) => { e.stopPropagation(); setExpandedId(isExpanded ? null : `${c.id}-${i}`); } : undefined}
                    >
                      {c.name} {hasStats && <span className="text-[#5a4a44] text-xs">{isExpanded ? '▾' : '▸'}</span>}
                    </div>
                    {c.subName && (
                      <div className="text-[0.6rem] uppercase tracking-[0.1em] text-[var(--color-border)]">{c.subName}</div>
                    )}
                    {c.npcData && (
                      <div className="text-[0.55rem] uppercase tracking-[0.1em] text-[#d5cfc8] flex gap-2 mt-0.5">
                        {c.npcData.ac && <span>AC {c.npcData.ac}</span>}
                        {c.npcData.speed && <span>{c.npcData.speed}</span>}
                        {c.npcData.cr && <span>CR {c.npcData.cr}</span>}
                      </div>
                    )}
                  </div>

                  {/* HP tracker for NPCs */}
                  {c.hp !== undefined && (
                    <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => updateCombatantHp(i, -1)}
                        className="w-6 h-6 rounded-full bg-[#3a1a1a] border border-[#6a1a1a] text-[#a05050]
                                   flex items-center justify-center hover:bg-[#4a2020] transition-colors text-sm leading-none"
                      >−</button>
                      <span className="w-14 text-center font-serif text-sm tabular-nums text-white">
                        {c.hp}/{c.maxHp}
                      </span>
                      <button
                        onClick={() => updateCombatantHp(i, 1)}
                        className="w-6 h-6 rounded-full bg-[#1a2a1a] border border-[#2d5a3f] text-[#4a8a65]
                                   flex items-center justify-center hover:bg-[#203020] transition-colors text-sm leading-none"
                      >+</button>
                    </div>
                  )}



                  {/* Turn done checkbox — marks done and advances turn */}
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      if (turnDone[i]) {
                        // Uncheck — just toggle off, don't advance
                        const next = [...turnDone];
                        next[i] = false;
                        setTurnDone(next);
                        persistCombat(results, currentTurn, round, next);
                      } else {
                        // Check — mark done and advance to next
                        const next = [...turnDone];
                        next[i] = true;
                        // Find next unchecked combatant
                        let nextTurn = currentTurn;
                        let nextRound = round;
                        let nextDone = next;
                        const allDone = next.every(Boolean);
                        if (allDone) {
                          // New round — reset all checkboxes
                          nextTurn = 0;
                          nextRound = round + 1;
                          nextDone = new Array(results.length).fill(false);
                        } else {
                          // Advance to next unchecked
                          for (let step = 1; step <= results.length; step++) {
                            const candidate = (currentTurn + step) % results.length;
                            if (!next[candidate]) { nextTurn = candidate; break; }
                          }
                        }
                        setTurnDone(nextDone);
                        setCurrentTurn(nextTurn);
                        setRound(nextRound);
                        persistCombat(results, nextTurn, nextRound, nextDone);
                      }
                    }}
                    className={`w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                      turnDone[i]
                        ? 'border-[var(--color-gold)] bg-[var(--color-gold)]'
                        : 'border-[var(--color-border)] bg-transparent hover:border-[#5a4a44]'
                    }`}
                    title={turnDone[i] ? 'Mark as not done' : 'Mark turn done'}
                  >
                    {turnDone[i] && <span className="text-black text-[10px] font-bold leading-none">✓</span>}
                  </button>
                </div>

                {/* Expanded NPC stat block */}
                {isExpanded && c.npcData && (
                  <div className={`px-6 py-3 border border-t-0 rounded-b text-[0.75rem] font-serif space-y-2 ${
                    isActive
                      ? 'border-[var(--color-gold)] bg-[#1e1b18]'
                      : 'border-[var(--color-border)] bg-[#1a1714]'
                  }`}>
                    {c.npcData.attacks && (
                      <div>
                        <div className="text-[0.6rem] uppercase tracking-[0.15em] text-[var(--color-gold)] mb-1">Attacks</div>
                        <div className="text-[#c8bfb5] whitespace-pre-wrap">{c.npcData.attacks}</div>
                      </div>
                    )}
                    {c.npcData.traits && (
                      <div>
                        <div className="text-[0.6rem] uppercase tracking-[0.15em] text-[var(--color-gold)] mb-1">Traits</div>
                        <div className="text-[#c8bfb5] whitespace-pre-wrap">{c.npcData.traits}</div>
                      </div>
                    )}
                    {c.npcData.actions && (
                      <div>
                        <div className="text-[0.6rem] uppercase tracking-[0.15em] text-[var(--color-gold)] mb-1">Actions</div>
                        <div className="text-[#c8bfb5] whitespace-pre-wrap">{c.npcData.actions}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

      </div>
    );
  }

  // ── SETUP VIEW ───────────────────────────────────────────────────────────────
  const visibleNpcs = npcs.filter(n => sessionNpcIds.includes(n.id));

  return (
    <div>
      {/* Session box row — at top of banner */}
      <div className="relative z-10" style={{ marginTop: -241 }}>
        <div className="px-6 pb-2">
        <div className="max-w-[1000px] mx-auto flex justify-center gap-2.5 overflow-x-auto pb-1">
          {sessions.map(s => (
            <button
              key={s.id}
              onClick={() => setSelectedSessionId(s.id)}
              className={`flex-shrink-0 w-[96px] rounded px-2 py-2.5 flex flex-col items-center gap-1 transition-colors border ${
                selectedSessionId === s.id
                  ? 'border-[var(--color-gold)] bg-[var(--color-surface)]'
                  : 'border-[var(--color-border)] bg-[var(--color-bg)] hover:border-[#5a4a44]'
              }`}
            >
              <span className="text-lg font-bold leading-none font-serif text-[var(--color-gold)]">
                #{s.number}
              </span>
              <span className={`text-[13px] font-serif leading-tight line-clamp-2 text-center w-full ${
                selectedSessionId === s.id ? 'text-[var(--color-gold)]' : 'text-[var(--color-text-muted)]'
              }`}>
                {s.title || 'Untitled'}
              </span>
            </button>
          ))}
        </div>
        </div>
      </div>

      {/* Return to Session */}
      <div className="max-w-[1000px] mx-auto px-4 pt-3 flex justify-end">
        <Link
          href="/dm"
          className="text-[0.65rem] uppercase tracking-[0.15em] text-[var(--color-text-muted)] hover:text-[var(--color-gold)] transition-colors font-sans"
        >
          ← Session
        </Link>
      </div>

      {/* Roll dice */}
      <div className="max-w-[1000px] mx-auto px-4 py-8" style={{ marginTop: -25 }}>
        <div className="flex justify-center">
          <button
            onClick={handleGo}
            className="rounded-full bg-transparent flex items-center justify-center hover:scale-110 transition-transform"
            style={{ width: 60, height: 60, fontSize: '1.8rem', border: '1px solid rgba(201,168,76,0.5)' }}
            title="Roll Initiative"
          >
            🎲
          </button>
        </div>
      </div>

      {/* Main pane */}
      <div className="max-w-[1000px] mx-auto px-4 pb-16">
        <div className="border border-[var(--color-border)] rounded bg-[#1a2535]">

          {/* Players */}
          <div className="relative px-6 pt-5 pb-5">
            <div className="flex flex-col gap-4">
              {activePlayers.map(p => (
                <div key={p.id} className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-[#2e2825] border border-[var(--color-border)] flex items-center justify-center flex-shrink-0">
                    <Image
                      src={p.img}
                      alt={p.playerName}
                      width={40}
                      height={40}
                      className="w-full h-full object-cover"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-serif text-sm text-[var(--color-text)]">{p.character}</div>
                  </div>
                  <InitCounter
                    value={playerInits[p.id] ?? 0}
                    onChange={v => setPlayerInits(prev => ({ ...prev, [p.id]: v }))}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* NPCs */}
          <div className="border-t border-[var(--color-border)]" />
          <div className="px-6 pt-4 pb-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-serif text-[1.1rem] italic text-[var(--color-text)] leading-none tracking-tight">NPCs</h2>
            </div>
            {visibleNpcs.length === 0 ? (
              <p className="text-[#5a4a44] text-xs font-serif italic">No NPCs assigned to this session.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {visibleNpcs.map(n => {
                  const imgUrl = n.image_path ? resolveImageUrl(n.image_path) : null;
                  const initial = n.name?.trim()?.[0]?.toUpperCase() ?? '?';
                  return (
                    <div key={n.id} className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-[#2e2825] border border-[var(--color-border)] flex items-center justify-center flex-shrink-0">
                        {imgUrl ? (
                          <img src={imgUrl} alt={n.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-[1rem] text-[var(--color-text-muted)] font-serif">{initial}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-serif text-sm text-[var(--color-text)] truncate">{n.name || 'Unnamed'}</div>
                      </div>
                      <span className="text-[0.6rem] uppercase tracking-[0.1em] text-[#5a4a44] flex-shrink-0">d20+</span>
                      <InitCounter
                        value={npcBonuses[n.id] ?? 0}
                        onChange={v => setNpcBonuses(prev => ({ ...prev, [n.id]: v }))}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
