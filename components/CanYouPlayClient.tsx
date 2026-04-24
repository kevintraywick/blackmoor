'use client';

import { useState, useCallback, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { Player } from '@/lib/types';
import type { Availability } from '@/lib/types';

// ── helpers ──────────────────────────────────────────────────────────────────

/** Next 3 Saturdays, starting from today (inclusive). A Saturday rolls off
 *  the list only after it has passed — so Friday still shows tomorrow's game. */
function getNextSaturdays(): string[] {
  const result: string[] = [];
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  while (cursor.getDay() !== 6) cursor.setDate(cursor.getDate() + 1);
  for (let i = 0; i < 3; i++) {
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, '0');
    const d = String(cursor.getDate()).padStart(2, '0');
    result.push(`${y}-${m}-${d}`);
    cursor.setDate(cursor.getDate() + 7);
  }
  return result;
}

function formatSaturday(iso: string): { month: string; day: string } {
  const d = new Date(iso + 'T12:00:00');
  return {
    month: d.toLocaleDateString('en-US', { month: 'short' }),
    day: String(d.getDate()),
  };
}

// ── types ────────────────────────────────────────────────────────────────────

interface Props {
  players: Player[];
  initialAvailability: Availability[];
  quorum: number;
  dates?: string[];
}

// ── component ────────────────────────────────────────────────────────────────

export default function CanYouPlayClient({ players: initialPlayers, initialAvailability, quorum, dates }: Props) {
  const saturdays = dates ?? getNextSaturdays();
  const [players, setPlayers] = useState<Player[]>(initialPlayers);

  // Build availability map: "playerId:saturday" → status
  const [avMap, setAvMap] = useState<Map<string, string>>(() => {
    const m = new Map<string, string>();
    for (const row of initialAvailability) {
      m.set(`${row.player_id}:${row.saturday}`, row.status);
    }
    return m;
  });

  // Registration state
  const [showJoin, setShowJoin] = useState(false);
  const [joinName, setJoinName] = useState('');
  const [joinCharacter, setJoinCharacter] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [welcomePlayer, setWelcomePlayer] = useState<{ id: string; character: string } | null>(null);

  // Share state
  const [copied, setCopied] = useState(false);

  const getStatus = useCallback((playerId: string, saturday: string): 'in' | 'maybe' | 'out' | 'unseen' => {
    return (avMap.get(`${playerId}:${saturday}`) as 'in' | 'maybe' | 'out') ?? 'unseen';
  }, [avMap]);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const playSound = useCallback((status: 'in' | 'out' | 'maybe') => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    const src = status === 'in' ? '/audio/swords.mp3' : status === 'out' ? '/audio/run_away.mp3' : '/audio/maybe.mp3';
    const audio = new Audio(src);
    audio.volume = 0.5;
    audio.play().catch(() => {});
    audioRef.current = audio;
  }, []);

  const toggle = useCallback(async (playerId: string, saturday: string) => {
    const current = getStatus(playerId, saturday);
    // unseen → in → out → maybe → in → out → maybe ...
    const next = current === 'unseen' ? 'in' : current === 'in' ? 'out' : current === 'out' ? 'maybe' : 'in';

    playSound(next);

    // Optimistic update
    setAvMap(prev => {
      const m = new Map(prev);
      m.set(`${playerId}:${saturday}`, next);
      return m;
    });

    await fetch('/api/availability', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ player_id: playerId, saturday, status: next }),
    });
  }, [getStatus, playSound]);

  const getInCount = useCallback((saturday: string): number => {
    return players.filter(p => getStatus(p.id, saturday) === 'in').length;
  }, [players, getStatus]);

  async function handleJoin() {
    const name = joinName.trim();
    const character = joinCharacter.trim();
    if (!name || !character) {
      setJoinError('Both fields are required');
      return;
    }
    setJoining(true);
    setJoinError(null);
    try {
      const res = await fetch('/api/players/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName: name, character }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setJoinError(data.error ?? 'Registration failed');
        return;
      }
      const data: { id: string; playerName: string; character: string; initial: string } = await res.json();
      // Add new player to local state
      setPlayers(prev => [...prev, {
        id: data.id,
        playerName: data.playerName,
        character: data.character,
        initial: data.initial,
        img: '',
      }]);
      setShowJoin(false);
      setJoinName('');
      setJoinCharacter('');
      setWelcomePlayer({ id: data.id, character: data.character });
      // Auto-dismiss welcome after 10s
      setTimeout(() => setWelcomePlayer(null), 10000);
    } catch {
      setJoinError('Registration failed');
    } finally {
      setJoining(false);
    }
  }

  function handleShare() {
    navigator.clipboard.writeText(window.location.href).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="min-h-screen relative" style={{ background: '#1a1614' }}>
      {/* Background image */}
      <div className="absolute inset-0 overflow-hidden">
        <Image
          src="/images/canyouplay/canyouplay_splash.png"
          alt=""
          fill
          className="object-cover opacity-30"
          priority
        />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(26,22,20,0.3) 0%, rgba(26,22,20,0.85) 50%, rgba(26,22,20,1) 80%)' }} />
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-[1000px] mx-auto px-6 py-10">
        {/* Header */}
        <h1 className="font-serif text-4xl text-[#e8ddd0] text-center mb-2 tracking-wide">
          Are You In?
        </h1>
        <p className="text-center text-[#8a7d6e] font-sans text-sm mb-4 sm:mb-10">
          Tap your name in, out or maybe. New?{' '}
          <button
            onClick={() => setShowJoin(true)}
            style={{ background: 'none', border: 'none', padding: 0, color: '#c9a84c', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'inherit' }}
          >
            Join the Party!
          </button>
        </p>

        {/* Welcome banner for new player */}
        {welcomePlayer && (
          <div
            style={{
              background: 'rgba(45,138,78,0.15)',
              border: '1px solid rgba(45,138,78,0.4)',
              padding: '10px 16px',
              marginBottom: 16,
              textAlign: 'center',
            }}
          >
            <span className="font-serif text-sm" style={{ color: '#7ac28a' }}>
              Welcome, {welcomePlayer.character}!{' '}
              <Link
                href={`/players/${welcomePlayer.id}`}
                className="underline"
                style={{ color: '#c9a84c' }}
              >
                Your character page →
              </Link>
            </span>
          </div>
        )}

        {/* Saturday columns */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-10 sm:gap-6 mb-12">
          {saturdays.map(sat => {
            const { month, day } = formatSaturday(sat);
            const inCount = getInCount(sat);
            return (
              <div key={sat} className="flex flex-col items-center">
                {/* Date */}
                <div
                  className="rounded-full flex flex-col items-center justify-center mb-4"
                  style={{ width: 77, height: 77, border: '2px solid rgba(201,168,76,0.3)', flexShrink: 0 }}
                >
                  <div className="font-sans uppercase tracking-[0.15em] text-[#c9a84c] leading-none" style={{ fontSize: '0.77rem' }}>
                    {month}
                  </div>
                  <div className="font-serif text-[#e8ddd0] leading-none mt-0.5" style={{ fontSize: '1.65rem' }}>
                    {day}
                  </div>
                </div>

                {/* Player list */}
                <div className="w-full space-y-2" style={{ marginTop: '10px' }}>
                  {players.map(p => {
                    const status = getStatus(p.id, sat);
                    const isIn = status === 'in';
                    const isMaybe = status === 'maybe';
                    const isOut = status === 'out';
                    const unseen = status === 'unseen';

                    return (
                      <button
                        key={p.id}
                        onClick={() => toggle(p.id, sat)}
                        className="w-full flex items-center gap-3 px-3 py-1.5 sm:py-2 rounded transition-all duration-200"
                        style={{
                          background: unseen ? 'rgba(90,79,70,0.15)' : 'rgba(201,168,76,0.08)',
                          border: `1px solid ${unseen ? 'rgba(90,79,70,0.2)' : 'rgba(201,168,76,0.15)'}`,
                        }}
                      >
                        {/* Portrait */}
                        <div
                          className="relative w-10 h-10 sm:w-8 sm:h-8 rounded-full overflow-hidden flex-shrink-0 transition-all duration-200"
                          style={{
                            opacity: unseen ? 0.3 : 1,
                            filter: unseen ? 'grayscale(1)' : 'none',
                            border: `2px solid ${unseen ? '#3d3530' : '#8b1a1a'}`,
                          }}
                        >
                          {p.img ? (
                            <Image src={p.img} alt={p.character} fill className="object-cover" />
                          ) : (
                            <div
                              className="w-full h-full flex items-center justify-center font-serif"
                              style={{ background: '#2a2420', color: '#8a7d6e', fontSize: '1rem' }}
                            >
                              {p.initial || p.character.charAt(0)}
                            </div>
                          )}
                        </div>

                        {/* Name */}
                        <span
                          className="font-serif text-base sm:text-sm flex-1 text-left transition-all duration-200"
                          style={{
                            color: unseen ? '#7a6e63' : '#e8ddd0',
                          }}
                        >
                          {p.character}
                        </span>

                        {/* Status circle: black ? → green → red → amber */}
                        <span
                          className="w-5 h-5 sm:w-4 sm:h-4 rounded-full flex-shrink-0 flex items-center justify-center transition-all duration-200"
                          style={{
                            background: isIn ? '#2d8a4e' : isOut ? '#8b1a1a' : isMaybe ? '#c9a84c' : '#1a1614',
                            border: unseen ? 'none' : '1px solid rgba(255,255,255,0.5)',
                            boxShadow: isIn ? '0 0 6px rgba(45,138,78,0.6)' : isOut ? '0 0 6px rgba(139,26,26,0.6)' : isMaybe ? '0 0 6px rgba(201,168,76,0.6)' : 'none',
                            color: '#fff',
                            fontSize: '1rem',
                            fontFamily: 'var(--font-sans)',
                            fontWeight: 600,
                          }}
                        >
                          {unseen ? '?' : ''}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* In count */}
                <div className="font-serif mt-4" style={{ fontSize: '1.85rem', color: '#d0ccc6' }}>
                  {inCount}
                </div>

              </div>
            );
          })}
        </div>

        {/* Share button */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
          <button
            onClick={handleShare}
            className="font-sans"
            style={{
              background: 'transparent',
              border: '1px solid rgba(138,125,110,0.3)',
              color: copied ? '#7ac28a' : '#8a7d6e',
              padding: '8px 16px',
              fontSize: '0.7rem',
              textTransform: 'uppercase',
              letterSpacing: '0.15em',
              cursor: 'pointer',
            }}
          >
            {copied ? 'Copied!' : '↗ Share'}
          </button>
        </div>

        {/* Join form */}
        {showJoin && (
          <div
            style={{
              background: 'rgba(26,22,20,0.9)',
              border: '1px solid rgba(201,168,76,0.3)',
              padding: 20,
              maxWidth: 360,
              margin: '0 auto 24px',
            }}
          >
            <div className="font-serif text-[#c9a84c] text-sm mb-3">New Adventurer</div>
            <input
              type="text"
              value={joinName}
              onChange={e => setJoinName(e.target.value)}
              placeholder="Your name"
              maxLength={50}
              className="w-full mb-2 px-3 py-2 font-serif text-sm"
              style={{
                background: 'rgba(90,79,70,0.2)',
                border: '1px solid rgba(201,168,76,0.2)',
                color: '#e8ddd0',
                outline: 'none',
              }}
            />
            <input
              type="text"
              value={joinCharacter}
              onChange={e => setJoinCharacter(e.target.value)}
              placeholder="Character name"
              maxLength={50}
              className="w-full mb-3 px-3 py-2 font-serif text-sm"
              style={{
                background: 'rgba(90,79,70,0.2)',
                border: '1px solid rgba(201,168,76,0.2)',
                color: '#e8ddd0',
                outline: 'none',
              }}
              onKeyDown={e => { if (e.key === 'Enter') handleJoin(); }}
            />
            {joinError && (
              <div className="text-sm mb-2" style={{ color: '#c07a8a' }}>{joinError}</div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleJoin}
                disabled={joining}
                className="font-serif"
                style={{
                  background: '#c9a84c',
                  color: '#1a1410',
                  border: 'none',
                  padding: '6px 16px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: joining ? 'wait' : 'pointer',
                  opacity: joining ? 0.5 : 1,
                }}
              >
                {joining ? 'Joining...' : 'Join'}
              </button>
              <button
                onClick={() => { setShowJoin(false); setJoinError(null); }}
                className="font-serif"
                style={{
                  background: 'transparent',
                  color: '#8a7d6e',
                  border: '1px solid rgba(138,125,110,0.3)',
                  padding: '6px 12px',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Home button */}
        <div className="flex justify-center mt-8 mb-4">
          <Link href="/" title="Shadow of the Wolf" className="block rounded-full overflow-hidden" style={{ width: 77, height: 77, flexShrink: 0 }}>
            <Image
              src="/images/invite/dice_home.png"
              alt="Home"
              width={77}
              height={77}
              className="object-cover rounded-full"
            />
          </Link>
        </div>

      </div>
    </div>
  );
}
