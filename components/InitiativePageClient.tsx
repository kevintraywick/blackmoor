'use client';

import { useState } from 'react';
import Image from 'next/image';
import type { Npc } from '@/lib/types';
import { PLAYERS } from '@/lib/players';

interface SessionMeta { id: string; number: number; title: string; }

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
}

function npcImageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return path.startsWith('uploads/') ? `/api/${path}` : `/${path}`;
}

function InitCounter({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-1 flex-shrink-0">
      <button
        type="button"
        onClick={() => onChange(value - 1)}
        className="w-7 h-7 rounded-full bg-[#231f1c] border border-[#3d3530] text-[#8a7d6e]
                   flex items-center justify-center hover:border-[#c9a84c] hover:text-[#e8ddd0]
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
        className="w-12 bg-[#231f1c] border border-[#3d3530] rounded px-1 py-1.5
                   text-[#e8ddd0] text-base focus:outline-none focus:border-[#c9a84c]
                   text-center placeholder:text-[#5a4f46]"
      />
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        className="w-7 h-7 rounded-full bg-[#231f1c] border border-[#3d3530] text-[#8a7d6e]
                   flex items-center justify-center hover:border-[#c9a84c] hover:text-[#e8ddd0]
                   transition-colors text-lg leading-none"
      >+</button>
    </div>
  );
}

export default function InitiativePageClient({
  sessions,
  npcs,
}: {
  sessions: SessionMeta[];
  npcs: Npc[];
}) {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(
    sessions[sessions.length - 1]?.id ?? null
  );
  const [playerInits, setPlayerInits] = useState<Record<string, number>>(
    Object.fromEntries(PLAYERS.map(p => [p.id, 0]))
  );
  const [npcIncluded, setNpcIncluded] = useState<Record<string, boolean>>(
    Object.fromEntries(npcs.map(n => [n.id, false]))
  );

  const [results, setResults] = useState<Combatant[] | null>(null);
  const [currentTurn, setCurrentTurn] = useState(0);

  function handleGo() {
    const combatants: Combatant[] = [];

    PLAYERS.forEach(p => {
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

    npcs.forEach(n => {
      if (!npcIncluded[n.id]) return;
      combatants.push({
        id: n.id,
        name: n.name || 'Unnamed NPC',
        type: 'npc',
        initiative: Math.floor(Math.random() * 20) + 1,
        rolled: true,
        initial: n.name?.trim()?.[0]?.toUpperCase() ?? '?',
        imagePath: n.image_path,
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
  }

  function handleReset() {
    setResults(null);
    setCurrentTurn(0);
    setPlayerInits(Object.fromEntries(PLAYERS.map(p => [p.id, 0])));
  }

  // ── RESULTS VIEW ─────────────────────────────────────────────────────────────
  if (results) {
    return (
      <div className="max-w-[640px] mx-auto px-4 py-8">
        <div className="flex items-baseline justify-between mb-6">
          <h2 className="font-serif text-[1.3rem] italic text-[#e8ddd0]">Combat Order</h2>
          <button
            onClick={handleReset}
            className="text-[0.7rem] uppercase tracking-[0.15em] text-[#8a7d6e] border border-[#3d3530]
                       rounded px-3 py-1.5 hover:border-[#c9a84c] hover:text-[#c9a84c] transition-colors"
          >
            ← Reset
          </button>
        </div>

        <div className="flex flex-col gap-2">
          {results.map((c, i) => {
            const isActive = i === currentTurn;
            const imgUrl = c.type === 'npc' ? npcImageUrl(c.imagePath) : null;

            return (
              <div
                key={`${c.id}-${i}`}
                onClick={() => setCurrentTurn(i)}
                className={`flex items-center gap-4 px-4 py-3 rounded border cursor-pointer transition-all ${
                  isActive
                    ? 'border-[#c9a84c] bg-[#231f1c]'
                    : 'border-[#3d3530] bg-[#1a1614] hover:border-[#5a4a44] opacity-70'
                }`}
              >
                {/* Rank */}
                <span className={`text-[0.7rem] w-5 text-right flex-shrink-0 font-serif ${
                  isActive ? 'text-[#c9a84c]' : 'text-[#3d3530]'
                }`}>{i + 1}.</span>

                {/* Initiative badge */}
                <div className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 border-2 font-serif font-bold text-xl ${
                  isActive
                    ? 'border-[#c9a84c] text-[#c9a84c] bg-[#2e2825]'
                    : c.type === 'player'
                      ? 'border-[#2d5a3f] text-[#4a8a65] bg-[#1a2520]'
                      : 'border-[#6a1a1a] text-[#a05050] bg-[#241414]'
                }`}>
                  {c.initiative}
                </div>

                {/* Avatar */}
                <div className="w-10 h-10 rounded-full overflow-hidden bg-[#2e2825] flex items-center justify-center flex-shrink-0 border border-[#3d3530]">
                  {c.type === 'player' && c.img ? (
                    <Image
                      src={c.img}
                      alt={c.name}
                      width={40}
                      height={40}
                      className="w-full h-full object-cover"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : imgUrl ? (
                    <img src={imgUrl} alt={c.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-[1rem] text-[#8a7d6e] font-serif">{c.initial}</span>
                  )}
                </div>

                {/* Name */}
                <div className="flex-1 min-w-0">
                  <div className={`font-serif text-base leading-tight ${isActive ? 'text-[#e8ddd0]' : 'text-[#8a7d6e]'}`}>
                    {c.name}
                  </div>
                  {c.subName && (
                    <div className="text-[0.6rem] uppercase tracking-[0.1em] text-[#3d3530]">{c.subName}</div>
                  )}
                </div>

                {/* Type badge */}
                <div className="flex-shrink-0 flex items-center gap-2">
                  {c.rolled && (
                    <span className="text-[0.55rem] uppercase tracking-[0.12em] text-[#5a4a44]">d20</span>
                  )}
                  <span className={`text-[0.55rem] uppercase tracking-[0.15em] px-2 py-0.5 rounded-full border ${
                    c.type === 'player'
                      ? 'border-[#2d5a3f] text-[#4a8a65]'
                      : 'border-[#6a1a1a] text-[#a05050]'
                  }`}>
                    {c.type}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <button
          onClick={() => setCurrentTurn(t => (t + 1) % results.length)}
          className="mt-6 w-full py-4 rounded bg-[#c9a84c] text-black font-serif font-bold text-xl
                     hover:bg-[#e0bc5a] transition-colors"
        >
          Next Turn →
        </button>
      </div>
    );
  }

  // ── SETUP VIEW ───────────────────────────────────────────────────────────────
  const allIncluded = npcs.length > 0 && npcs.every(n => npcIncluded[n.id]);

  return (
    <div className="max-w-[640px] mx-auto px-4 py-6">

      {/* Session picker */}
      {sessions.length > 0 && (
        <div className="mb-6">
          <p className="text-[0.65rem] uppercase tracking-[0.22em] text-[#8a7d6e] mb-2">Current Session</p>
          <div className="flex gap-2 flex-wrap">
            {sessions.map(s => (
              <button
                key={s.id}
                onClick={() => setSelectedSessionId(s.id)}
                className={`flex-shrink-0 px-3 py-1.5 rounded border text-sm font-serif transition-colors ${
                  selectedSessionId === s.id
                    ? 'border-[#c9a84c] text-[#c9a84c] bg-[#231f1c]'
                    : 'border-[#3d3530] text-[#8a7d6e] bg-[#1a1614] hover:border-[#5a4a44]'
                }`}
              >
                #{s.number}{s.title ? ` · ${s.title}` : ''}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="border border-[#3d3530] rounded bg-[#2e3a4a]">

        {/* Players */}
        <div className="relative px-6 pt-5 pb-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-[1.1rem] italic text-[#e8ddd0] leading-none tracking-tight">Players</h2>
            <button
              onClick={handleGo}
              className="w-10 h-10 rounded-full bg-[#c9a84c] text-black font-bold text-xl
                         flex items-center justify-center hover:bg-[#e0bc5a] transition-colors"
              title="Roll Initiative"
            >
              →
            </button>
          </div>
          <div className="border-t border-[#3d3530] mb-4" />
          <div className="flex flex-col gap-4">
            {PLAYERS.map(p => (
              <div key={p.id} className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full overflow-hidden bg-[#2e2825] border border-[#3d3530] flex items-center justify-center flex-shrink-0">
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
                  <div className="font-serif text-sm text-[#e8ddd0]">{p.character}</div>
                  <div className="text-[0.6rem] uppercase tracking-[0.1em] text-[#5a4a44]">{p.playerName}</div>
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
        {npcs.length > 0 && (
          <>
            <div className="border-t border-[#3d3530]" />
            <div className="px-6 pt-5 pb-5">
              <div className="flex items-center justify-end mb-4">
                <button
                  onClick={() => setNpcIncluded(Object.fromEntries(npcs.map(n => [n.id, !allIncluded])))}
                  className="text-[0.6rem] uppercase tracking-[0.15em] text-[#8a7d6e] hover:text-[#c9a84c] transition-colors"
                >
                  {allIncluded ? 'Deselect all' : 'Select all'}
                </button>
              </div>
              <div className="flex flex-col gap-3">
                {npcs.map(n => {
                  const included = npcIncluded[n.id] ?? false;
                  const imgUrl = npcImageUrl(n.image_path);
                  const initial = n.name?.trim()?.[0]?.toUpperCase() ?? '?';
                  return (
                    <div
                      key={n.id}
                      className={`flex items-center gap-3 cursor-pointer transition-opacity ${included ? '' : 'opacity-40'}`}
                      onClick={() => setNpcIncluded(prev => ({ ...prev, [n.id]: !prev[n.id] }))}
                    >
                      {/* Checkbox */}
                      <div className={`w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                        included ? 'border-[#c9a84c] bg-[#c9a84c]' : 'border-[#3d3530] bg-transparent'
                      }`}>
                        {included && <span className="text-black text-[10px] font-bold leading-none">✓</span>}
                      </div>

                      {/* Avatar */}
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-[#2e2825] border border-[#3d3530] flex items-center justify-center flex-shrink-0">
                        {imgUrl ? (
                          <img src={imgUrl} alt={n.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-[1rem] text-[#8a7d6e] font-serif">{initial}</span>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="font-serif text-sm text-[#e8ddd0] truncate">{n.name || 'Unnamed'}</div>
                        {n.species && (
                          <div className="text-[0.6rem] uppercase tracking-[0.1em] text-[#5a4a44]">{n.species} · CR {n.cr}</div>
                        )}
                      </div>

                      <span className="text-[0.6rem] uppercase tracking-[0.1em] text-[#5a4a44] flex-shrink-0">d20</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

    </div>
  );
}
