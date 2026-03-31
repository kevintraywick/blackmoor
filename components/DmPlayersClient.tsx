'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import type { PlayerSheet, Player } from '@/lib/types';
import { Sheet } from '@/components/PlayerSheet';
import DmPlayerBox from '@/components/DmPlayerBox';

function AddPlayerModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [playerName, setPlayerName] = useState('');
  const [character, setCharacter] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const id = playerName.toLowerCase().replace(/[^a-z0-9]/g, '');
  const initial = playerName.trim()[0]?.toUpperCase() ?? '';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!id || !playerName.trim() || !character.trim()) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, playerName: playerName.trim().toUpperCase(), character: character.trim(), initial, img: `/images/players/${id}.png` }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? 'Failed to create player');
        return;
      }
      router.refresh();
      onClose();
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <form
        className="bg-[var(--color-surface)] border border-[#4a7a5a] rounded-lg px-6 py-5 w-full max-w-sm mx-4"
        onClick={e => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div className="text-[0.6rem] uppercase tracking-[0.15em] text-[#4a8a5a] mb-3">Add New Player</div>

        <label className="block mb-3">
          <span className="text-[0.7rem] uppercase tracking-[0.1em] text-[var(--color-text-muted)] block mb-1">Player Name</span>
          <input
            autoFocus
            type="text"
            value={playerName}
            onChange={e => setPlayerName(e.target.value)}
            placeholder="e.g. Levi"
            className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-3 py-2 text-[var(--color-text)] text-sm font-serif outline-none focus:border-[#4a7a5a] placeholder:text-[var(--color-text-dim)]"
          />
          {id && <span className="text-[0.65rem] text-[#5a6a60] mt-0.5 block">ID: {id}</span>}
        </label>

        <label className="block mb-4">
          <span className="text-[0.7rem] uppercase tracking-[0.1em] text-[var(--color-text-muted)] block mb-1">Character Name</span>
          <input
            type="text"
            value={character}
            onChange={e => setCharacter(e.target.value)}
            placeholder="e.g. Garrick"
            className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-3 py-2 text-[var(--color-text)] text-sm font-serif outline-none focus:border-[#4a7a5a] placeholder:text-[var(--color-text-dim)]"
          />
        </label>

        {error && <div className="text-[0.7rem] text-[#c05050] mb-3">{error}</div>}

        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="text-sm px-3 py-1.5 text-[var(--color-text-muted)] border border-[var(--color-border)] rounded hover:bg-[var(--color-surface-raised)] transition-colors font-serif"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !id || !character.trim()}
            className="text-sm px-3 py-1.5 text-[#4a8a5a] border border-[#4a7a5a] rounded hover:bg-[#1a2a20] transition-colors font-serif disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? 'Adding…' : 'Add Player'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function DmPlayersClient({
  players,
  sheets,
}: {
  players: Player[];
  sheets: Record<string, PlayerSheet>;
}) {
  const [showAddModal, setShowAddModal] = useState(false);
  const firstActive = players.find(p => (sheets[p.id]?.status ?? 'active') !== 'removed')?.id ?? players[0]?.id ?? '';
  const [selectedId, setSelectedId] = useState(firstActive);

  const selectedPlayer = players.find(p => p.id === selectedId)!;
  const selectedSheet  = sheets[selectedId];

  return (
    <div className="max-w-[1000px] mx-auto px-4 pb-16">

      {showAddModal && <AddPlayerModal onClose={() => setShowAddModal(false)} />}

      {/* Player selector — same layout as /players, but DM sees all (incl. removed) */}
      <div className="flex justify-center gap-4 flex-wrap py-5 bg-[var(--color-surface)] border-b border-[var(--color-border)] -mx-4 px-4 mb-4">
        {players.map(p => {
          const status    = sheets[p.id]?.status ?? 'active';
          const isAway    = status === 'away';
          const isRemoved = status === 'removed';
          const isActive  = p.id === selectedId;
          return (
            <button
              key={p.id}
              onClick={() => setSelectedId(p.id)}
              className={`flex flex-col items-center gap-1.5 cursor-pointer bg-transparent border-none transition-opacity ${
                isRemoved ? 'opacity-30' : isAway ? 'opacity-50' : ''
              }`}
            >
              <div className={`relative w-20 h-20 rounded-full overflow-hidden border-[3px] transition-all ${
                isActive
                  ? 'border-[var(--color-gold)]'
                  : 'border-[var(--color-border)] hover:border-[var(--color-text-muted)] hover:scale-105'
              } bg-[#2e2825] flex items-center justify-center`}>
                <span className="text-[1.6rem] text-[var(--color-text-muted)] select-none">{p.initial}</span>
                <Image
                  src={p.img}
                  alt={p.playerName}
                  fill
                  className="object-cover absolute inset-0"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              </div>
              <span className={`text-[0.72rem] uppercase tracking-[0.1em] transition-colors ${
                isActive ? 'text-[var(--color-gold)]' : 'text-[var(--color-text-muted)]'
              }`}>
                {p.playerName}
                {isAway    ? ' · away'    : ''}
                {isRemoved ? ' · removed' : ''}
              </span>
            </button>
          );
        })}

        {/* Add new player */}
        <button
          onClick={() => setShowAddModal(true)}
          className="flex flex-col items-center gap-1.5 cursor-pointer bg-transparent border-none"
        >
          <div className="relative w-20 h-20 rounded-full border-[3px] border-dashed border-[var(--color-border)] hover:border-[#4a7a5a] transition-colors bg-[#1e1c1a] flex items-center justify-center">
            <span className="text-[2rem] text-[var(--color-border)] leading-none select-none" style={{ marginTop: '-2px' }}>+</span>
          </div>
          <span className="text-[0.72rem] uppercase tracking-[0.1em] text-[var(--color-border)]">Add Player</span>
        </button>
      </div>

      {/* DM box — updates per selected player */}
      {selectedPlayer && (
        <DmPlayerBox
          key={selectedId}
          playerId={selectedId}
          playerName={selectedPlayer.character}
          initialNotes={selectedSheet?.dm_notes ?? ''}
          initialStatus={(selectedSheet?.status ?? 'active') as 'active' | 'away' | 'removed'}
        />
      )}

      {/* Player sheet — mirror of the player's own page */}
      {selectedPlayer && (
        <Sheet
          key={`sheet-${selectedId}`}
          playerId={selectedPlayer.id}
          playerName={selectedPlayer.playerName}
          character={selectedPlayer.character}
          initial={selectedPlayer.initial}
          img={selectedPlayer.img}
          data={selectedSheet}
        />
      )}
    </div>
  );
}
