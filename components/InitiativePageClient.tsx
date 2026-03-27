'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import type { Npc, Player } from '@/lib/types';
import { resolveImageUrl } from '@/lib/imageUrl';
import { rollDice } from '@/lib/dice';

interface SessionMeta { id: string; number: number; title: string; npc_ids: string[]; }

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
  players = [],
}: {
  sessions: SessionMeta[];
  npcs: Npc[];
  playerStatuses?: Record<string, string>;
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
    return sessions[sessions.length - 1]?.id ?? null;
  });
  const [playerInits, setPlayerInits] = useState<Record<string, number>>(
    Object.fromEntries(players.map(p => [p.id, 0]))
  );
  const [npcIncluded, setNpcIncluded] = useState<Record<string, boolean>>(
    Object.fromEntries(npcs.map(n => [n.id, true]))
  );
  const [npcBonuses, setNpcBonuses] = useState<Record<string, number>>(
    Object.fromEntries(npcs.map(n => [n.id, 0]))
  );

  const [results, setResults] = useState<Combatant[] | null>(null);
  const [currentTurn, setCurrentTurn] = useState(0);
  const [round, setRound] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const STORAGE_KEY = 'blackmoor-combat-state';

  // Persist combat state to localStorage
  const persistCombat = useCallback((r: Combatant[], turn: number, rnd: number) => {
    try {
      const state: CombatState = { results: r, currentTurn: turn, round: rnd };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch { /* silent */ }
  }, []);

  // Restore combat state on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const state: CombatState = JSON.parse(raw);
      if (state.results?.length) {
        setResults(state.results);
        setCurrentTurn(state.currentTurn ?? 0);
        setRound(state.round ?? 1);
      }
    } catch { /* silent */ }
  }, []);

  const selectedSession = sessions.find(s => s.id === selectedSessionId) ?? null;
  const sessionNpcIds = Array.isArray(selectedSession?.npc_ids) ? selectedSession.npc_ids : [];

  function handleGo() {
    const combatants: Combatant[] = [];

    activePlayers.forEach(p => {
      combatants.push({
        id: p.id,
        name: p.character,
        subName: p.playerName,
        type: 'player',
        initiative: playerInits[p.id] ?? 0,
        rolled: false,
        img: p.img,
        initial: p.initial,
      });
    });

    // Count occurrences per NPC type to know if we need numbering
    const npcCounts: Record<string, number> = {};
    sessionNpcIds.forEach(id => { npcCounts[id] = (npcCounts[id] ?? 0) + 1; });
    const npcInstanceNum: Record<string, number> = {};

    const idsToRoll = sessionNpcIds.length > 0 ? sessionNpcIds : npcs.map(n => n.id);
    idsToRoll.forEach(npcId => {
      const n = npcs.find(x => x.id === npcId);
      if (!n || !npcIncluded[n.id]) return;
      npcInstanceNum[npcId] = (npcInstanceNum[npcId] ?? 0) + 1;
      const count = npcCounts[npcId] ?? 1;
      const instanceNum = npcInstanceNum[npcId];
      const rolledHp = n.hp_roll ? rollDice(n.hp_roll) : (n.hp ? parseInt(n.hp, 10) : undefined);
      const hpVal = rolledHp && !isNaN(rolledHp) ? rolledHp : undefined;
      combatants.push({
        id: `${n.id}-${instanceNum}`,
        name: count > 1 ? `${n.name || 'Unnamed'} ${instanceNum}` : (n.name || 'Unnamed NPC'),
        type: 'npc',
        initiative: Math.floor(Math.random() * 20) + 1 + (npcBonuses[n.id] ?? 0),
        rolled: true,
        initial: n.name?.trim()?.[0]?.toUpperCase() ?? '?',
        imagePath: n.image_path,
        hp: hpVal,
        maxHp: hpVal,
        npcData: { ac: n.ac, speed: n.speed, cr: n.cr, attacks: n.attacks, traits: n.traits, actions: n.actions },
      });
    });

    combatants.sort((a, b) => {
      if (b.initiative !== a.initiative) return b.initiative - a.initiative;
      // Ties: players go before NPCs
      if (a.type === 'player' && b.type === 'npc') return -1;
      if (a.type === 'npc' && b.type === 'player') return 1;
      return 0;
    });

    setResults(combatants);
    setCurrentTurn(0);
    setRound(1);
    persistCombat(combatants, 0, 1);
  }

  function handleReset() {
    setResults(null);
    setCurrentTurn(0);
    setRound(1);
    setExpandedId(null);
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
    persistCombat(updated, currentTurn, round);
  }

  function advanceTurn() {
    if (!results) return;
    const nextTurn = (currentTurn + 1) % results.length;
    const nextRound = nextTurn === 0 ? round + 1 : round;
    setCurrentTurn(nextTurn);
    setRound(nextRound);
    persistCombat(results, nextTurn, nextRound);
  }

  // ── RESULTS VIEW ─────────────────────────────────────────────────────────────
  if (results) {
    return (
      <div className="max-w-[640px] mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-serif text-[1.3rem] italic text-[var(--color-text)] leading-none">Combat Order</h2>
            <span className="text-[0.65rem] uppercase tracking-[0.15em] text-[#5a4a44] mt-1 block">Round {round}</span>
          </div>
          <button
            onClick={handleReset}
            className="text-[0.7rem] uppercase tracking-[0.15em] text-[var(--color-text-muted)] border border-[var(--color-border)]
                       rounded px-3 py-1.5 hover:border-[var(--color-gold)] hover:text-[var(--color-gold)] transition-colors"
          >
            ← Reset
          </button>
        </div>

        <div className="flex flex-col gap-2">
          {results.map((c, i) => {
            const isActive = i === currentTurn;
            const isDead = c.hp !== undefined && c.hp <= 0;
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
                      ? 'border-[var(--color-gold)] bg-[var(--color-surface)]'
                      : 'border-[var(--color-border)] bg-[var(--color-bg)] hover:border-[#5a4a44] opacity-70'
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
                    <div className={`font-serif text-sm leading-tight ${isDead ? 'line-through' : ''} ${isActive ? 'text-[var(--color-text)]' : 'text-[var(--color-text-muted)]'}`}>
                      {c.name}
                    </div>
                    {c.subName && (
                      <div className="text-[0.6rem] uppercase tracking-[0.1em] text-[var(--color-border)]">{c.subName}</div>
                    )}
                    {c.npcData && (
                      <div className="text-[0.55rem] uppercase tracking-[0.1em] text-[#5a4a44] flex gap-2 mt-0.5">
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
                      <span className={`w-14 text-center font-serif text-sm tabular-nums ${
                        c.hp <= 0 ? 'text-[#a05050]'
                          : c.hp <= (c.maxHp ?? 0) * 0.25 ? 'text-[#c07040]'
                          : c.hp <= (c.maxHp ?? 0) * 0.5 ? 'text-[var(--color-gold)]'
                          : 'text-[#4a8a65]'
                      }`}>
                        {c.hp}/{c.maxHp}
                      </span>
                      <button
                        onClick={() => updateCombatantHp(i, 1)}
                        className="w-6 h-6 rounded-full bg-[#1a2a1a] border border-[#2d5a3f] text-[#4a8a65]
                                   flex items-center justify-center hover:bg-[#203020] transition-colors text-sm leading-none"
                      >+</button>
                    </div>
                  )}

                  {/* Expand toggle for NPC stats */}
                  {hasStats && (
                    <button
                      onClick={e => { e.stopPropagation(); setExpandedId(isExpanded ? null : `${c.id}-${i}`); }}
                      className="w-6 h-6 flex items-center justify-center text-[#5a4a44] hover:text-[var(--color-gold)] transition-colors flex-shrink-0 text-xs"
                      title="Show stat block"
                    >
                      {isExpanded ? '▾' : '▸'}
                    </button>
                  )}

                  {/* Type badge */}
                  <span className={`text-[0.5rem] uppercase tracking-[0.15em] px-1.5 py-0.5 rounded-full border flex-shrink-0 ${
                    c.type === 'player'
                      ? 'border-[#2d5a3f] text-[#4a8a65]'
                      : 'border-[#6a1a1a] text-[#a05050]'
                  }`}>
                    {c.type === 'player' ? 'PC' : 'NPC'}
                  </span>
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

        <button
          onClick={advanceTurn}
          className="mt-6 w-full py-4 rounded bg-[var(--color-gold)] text-black font-serif font-bold text-xl
                     hover:bg-[#e0bc5a] transition-colors"
        >
          Next Turn →
        </button>
      </div>
    );
  }

  // ── SETUP VIEW ───────────────────────────────────────────────────────────────
  const visibleNpcs = npcs.filter(n => sessionNpcIds.includes(n.id));
  const allIncluded = visibleNpcs.length > 0 && visibleNpcs.every(n => npcIncluded[n.id]);

  return (
    <div className="relative z-10 -mt-[84px] max-w-[780px] mx-auto px-4 pb-16 flex gap-4 items-start">

      {/* Left: session boxes stacked vertically, start 50px below banner */}
      {sessions.length > 0 && (
        <div className="flex-shrink-0 w-[96px] pt-[134px] flex flex-col gap-2">
          {sessions.map(s => (
            <button
              key={s.id}
              onClick={() => setSelectedSessionId(s.id)}
              className={`w-full rounded px-2 py-2.5 flex flex-col items-center gap-1 transition-colors border ${
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
      )}

      {/* Right: main pane — overlaps banner */}
      <div className="flex-1 min-w-0 bg-[var(--color-bg)] rounded-t-2xl pt-6">
        <div className="border border-[var(--color-border)] rounded bg-[#1a2535]">

          {/* Players */}
          <div className="relative px-6 pt-5 pb-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-serif text-[1.1rem] italic text-[var(--color-text)] leading-none tracking-tight">Players</h2>
              {/* Arrow positioned above the counter column */}
              <button
                onClick={handleGo}
                className="w-10 h-10 rounded-full bg-[var(--color-gold)] text-black font-bold text-xl
                           flex items-center justify-center hover:bg-[#e0bc5a] transition-colors mr-[2px]"
                title="Roll Initiative"
              >
                🎲
              </button>
            </div>
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
              {visibleNpcs.length > 0 && (
                <button
                  onClick={() => setNpcIncluded(Object.fromEntries(visibleNpcs.map(n => [n.id, !allIncluded])))}
                  className="text-[0.6rem] uppercase tracking-[0.15em] text-[var(--color-text-muted)] hover:text-[var(--color-gold)] transition-colors"
                >
                  {allIncluded ? 'Deselect all' : 'Select all'}
                </button>
              )}
            </div>
            {visibleNpcs.length === 0 ? (
              <p className="text-[#5a4a44] text-xs font-serif italic">No NPCs assigned to this session.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {visibleNpcs.map(n => {
                  const included = npcIncluded[n.id] ?? false;
                  const imgUrl = n.image_path ? resolveImageUrl(n.image_path) : null;
                  const initial = n.name?.trim()?.[0]?.toUpperCase() ?? '?';
                  return (
                    <div
                      key={n.id}
                      className={`flex items-center gap-3 cursor-pointer transition-opacity ${included ? '' : 'opacity-40'}`}
                      onClick={() => setNpcIncluded(prev => ({ ...prev, [n.id]: !prev[n.id] }))}
                    >
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
                      <div className={`w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                        included ? 'border-[var(--color-gold)] bg-[var(--color-gold)]' : 'border-[var(--color-border)] bg-transparent'
                      }`}>
                        {included && <span className="text-black text-[10px] font-bold leading-none">✓</span>}
                      </div>
                      <span className="text-[0.6rem] uppercase tracking-[0.1em] text-[#5a4a44] flex-shrink-0">d20+</span>
                      <div onClick={e => e.stopPropagation()}>
                        <InitCounter
                          value={npcBonuses[n.id] ?? 0}
                          onChange={v => setNpcBonuses(prev => ({ ...prev, [n.id]: v }))}
                        />
                      </div>
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
