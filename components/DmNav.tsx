'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';

export type NavSection =
  | 'campaign' | 'sessions' | 'players' | 'npcs' | 'initiative'
  | 'world' | 'maps' | 'map-builder'
  | 'magic' | 'marketplace' | 'poisons' | 'inventory'
  | 'boons' | 'journey' | 'journal' | 'ar' | 'raven-post';

interface PlayerChangeRow {
  player_id: string;
  field: string;
  old_value: string | null;
  new_value: string | null;
  created_at: number;
}

const JSON_FIELDS = new Set(['gear', 'spells', 'items']);

function formatChange(c: PlayerChangeRow): string {
  if (JSON_FIELDS.has(c.field)) return `Modified ${c.field}`;
  const oldVal = c.old_value || '(empty)';
  const newVal = c.new_value || '(empty)';
  return `${c.field}: ${oldVal} → ${newVal}`;
}

function groupByPlayer(changes: PlayerChangeRow[]): Record<string, PlayerChangeRow[]> {
  const grouped: Record<string, PlayerChangeRow[]> = {};
  for (const c of changes) {
    (grouped[c.player_id] ??= []).push(c);
  }
  return grouped;
}

const LINKS: { key: NavSection; label: string; href: string }[] = [
  { key: 'campaign',    label: 'Campaign',         href: '/dm/campaign' },
  { key: 'journal',     label: 'Journal',         href: '/dm/journal' },
  { key: 'raven-post',  label: 'Raven Post',      href: '/dm/raven-post' },
  { key: 'sessions',    label: 'Sessions',        href: '/dm' },
  { key: 'players',     label: 'Players',         href: '/dm/players' },
  { key: 'npcs',        label: 'NPCs',            href: '/dm/npcs' },
  { key: 'initiative',  label: 'Initiative',      href: '/dm/initiative' },
  { key: 'world',       label: 'World',           href: '/dm/world' },
  { key: 'maps',        label: 'Maps',            href: '/dm/maps' },
  { key: 'map-builder', label: 'Map Builder',     href: '/dm/map-builder' },
  { key: 'magic',       label: 'Magic',           href: '/dm/magic' },
  { key: 'marketplace', label: 'Marketplace',     href: '/dm/marketplace' },
  { key: 'inventory',   label: 'Inventory',       href: '/dm/inventory' },
  { key: 'poisons',     label: 'Poisons & Traps', href: '/dm/poisons' },
  { key: 'boons',       label: 'Boons',           href: '/dm/boons' },
  { key: 'journey',     label: 'Journey',         href: '/dm/journey' },
];

// Gold wireframe icosahedron used as the AR / "The Field" nav link.
// Matches the fallback GoldCrystal in app/ar/ARViewer.tsx.
function GoldCrystalIcon({ active }: { active: boolean }) {
  const stroke = active ? '#c9a84c' : '#4a8a5a';
  return (
    <svg
      viewBox="0 0 24 24"
      width={18}
      height={18}
      fill="none"
      stroke={stroke}
      strokeWidth="1.3"
      strokeLinejoin="round"
      aria-label="The Field"
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
    >
      <polygon points="12,2 22,9 18,21 6,21 2,9" />
      <line x1="12" y1="2" x2="12" y2="21" />
      <line x1="2" y1="9" x2="22" y2="9" />
      <line x1="2" y1="9" x2="18" y2="21" />
      <line x1="22" y1="9" x2="6" y2="21" />
    </svg>
  );
}

function ArrowLeft() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 inline-block -mt-px">
      <path d="M10 3L5 8l5 5" />
    </svg>
  );
}

export default function DmNav({ current, sessionId, poisonCount: initialPoisonCount }: { current: NavSection; sessionId?: string; poisonCount?: number }) {
  const [poisonCount, setPoisonCount] = useState(initialPoisonCount ?? 0);
  const [changeCount, setChangeCount] = useState(0);
  const [showChanges, setShowChanges] = useState(false);
  const [changes, setChanges] = useState<PlayerChangeRow[]>([]);
  const [loadingChanges, setLoadingChanges] = useState(false);

  useEffect(() => {
    if (initialPoisonCount !== undefined) return;
    fetch('/api/poison').then(r => r.json()).then((rows: unknown[]) => setPoisonCount(rows.length)).catch(() => {});
  }, [initialPoisonCount]);

  // Fetch unread change count on mount
  useEffect(() => {
    fetch('/api/player-changes?count=true')
      .then(r => r.json())
      .then((data: { count: number }) => setChangeCount(data.count))
      .catch(() => {});
  }, []);

  const toggleChanges = useCallback(async () => {
    if (showChanges) {
      setShowChanges(false);
      return;
    }
    setShowChanges(true);
    setLoadingChanges(true);
    try {
      const [changesRes] = await Promise.all([
        fetch('/api/player-changes').then(r => r.json()),
        fetch('/api/player-changes/read', { method: 'PATCH' }),
      ]);
      setChanges(changesRes as PlayerChangeRow[]);
      setChangeCount(0);
    } catch { /* ignore */ }
    setLoadingChanges(false);
  }, [showChanges]);

  const grouped = groupByPlayer(changes);

  return (
    <>
      <nav style={{ position: 'sticky', top: 0, display: 'flex', alignItems: 'center', zIndex: 10, background: '#161d18', borderBottom: '1px solid rgba(74,122,90,0.4)', padding: '10px 32px', fontSize: '0.875rem' }} className="font-serif relative">
        <Link href="/" className="flex items-center text-[#4a8a5a] hover:text-[#5ab87a] transition-colors no-underline flex-shrink-0">
          <div className="relative rounded-full border border-[#4a7a5a] overflow-hidden flex-shrink-0" style={{ width: 30, height: 30 }}>
            <Image src="/images/dm.png" alt="" fill className="object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          </div>
        </Link>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 16, marginLeft: 16 }}>
        {LINKS.map(link => {
          const href = link.key === 'maps' && sessionId ? `/dm/maps?session=${sessionId}` : link.href;
          const isPoisonGlow = link.key === 'poisons' && poisonCount > 0 && current !== 'poisons';
          return link.key === current
            ? <span key={link.key} className="text-[#5ab87a] font-semibold whitespace-nowrap">{link.label}</span>
            : <Link key={link.key} href={href} className={`transition-colors no-underline whitespace-nowrap ${isPoisonGlow ? 'text-[#7ac28a] animate-pulse' : 'text-[#4a8a5a] hover:text-[#5ab87a]'}`}>{link.label}</Link>;
        })}
        {/* The Field — AR encounter. Icon-only (gold crystal) to signal it's a different kind of page. */}
        <Link
          href="/ar"
          title="The Field"
          className="flex items-center transition-opacity hover:opacity-80"
          style={{ marginLeft: 4 }}
        >
          <GoldCrystalIcon active={current === 'ar'} />
        </Link>
        </div>
        {/* Change notification dot — right end of nav */}
        <div className="flex-shrink-0" style={{ marginLeft: 16 }}>
          {changeCount > 0 ? (
            <div onClick={toggleChanges} className="animate-pulse cursor-pointer" title={`${changeCount} player change${changeCount > 1 ? 's' : ''}`}>
              <div style={{ width: 16, height: 16, backgroundColor: '#dc2626', borderRadius: '50%' }} />
            </div>
          ) : (
            <div onClick={toggleChanges} className="cursor-pointer rounded-full opacity-40 hover:opacity-70 transition-opacity"
              style={{ width: 12, height: 12, backgroundColor: '#5a4f46' }} title="View player changes" />
          )}
        </div>
      </nav>

      {/* Slide-down change summary panel */}
      <div
        className="overflow-hidden transition-all duration-300 ease-in-out sticky z-10"
        style={{
          maxHeight: showChanges ? '400px' : '0px',
          opacity: showChanges ? 1 : 0,
          top: 45,
        }}
      >
        <div className="relative border-x border-b border-[#4a7a5a]/40 px-4 py-3" style={{ background: 'rgba(22,29,24,0.97)' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[0.65rem] uppercase tracking-[0.15em] text-[#c05050] font-sans">Player Changes</span>
            <button
              onClick={() => setShowChanges(false)}
              className="text-[#5a4f46] hover:text-[var(--color-text)] text-sm bg-transparent border-none cursor-pointer"
            >
              ✕
            </button>
          </div>
          {loadingChanges && <p className="text-[#8a7d6e] text-sm font-serif">Loading...</p>}
          {!loadingChanges && changes.length === 0 && <p className="text-[#8a7d6e] text-sm font-serif italic">No recent changes</p>}
          {!loadingChanges && Object.entries(grouped).map(([playerId, playerChanges]) => (
            <div key={playerId} className="mb-3">
              <div className="text-[0.7rem] uppercase tracking-[0.12em] text-[#c9a84c] font-sans mb-1">
                {playerId}
              </div>
              {playerChanges.map((c, i) => (
                <div key={i} className="text-[0.9rem] text-[#d4c8b8] font-serif" style={{ marginLeft: 8 }}>
                  {formatChange(c)}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
