'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';


type ResultType = 'spell' | 'scroll' | 'magic_item' | 'weapon' | 'armor' | 'tool' | 'other';

interface SearchResult {
  key: string;
  name: string;
  description: string;
  metadata: Record<string, unknown>;
  resultType: ResultType;
}

const TYPE_CONFIG: Record<ResultType, { label: string; color: string; sigil: string }> = {
  spell:      { label: 'Spell',  color: '#c9a84c', sigil: '\u2726' },
  scroll:     { label: 'Scroll', color: '#a89070', sigil: '\u2709' },
  magic_item: { label: 'Item',   color: '#7a6fa0', sigil: '\u25C6' },
  weapon:     { label: 'Weapon', color: '#8a4a4a', sigil: '\u2694' },
  armor:      { label: 'Armor',  color: '#5a7a8a', sigil: '\u26E8' },
  tool:       { label: 'Tool',   color: '#6a8a6a', sigil: '\u2692' },
  other:      { label: 'Other',  color: '#6a8a6a', sigil: '\u270E' },
};

function formatSpellHeader(meta: Record<string, unknown>) {
  const level = meta.level as number;
  const school = meta.school as string;
  const levelStr = level === 0 ? `${school} cantrip` : `Level ${level} ${school}`;
  const parts = [levelStr];
  if (meta.casting_time) parts.push(`Casting Time: ${meta.casting_time}`);
  if (meta.range) parts.push(`Range: ${meta.range}`);
  if (meta.components) parts.push(`Components: ${meta.components}`);
  if (meta.duration) parts.push(`Duration: ${meta.duration}`);
  if (meta.ritual) parts.push('(Ritual)');
  return parts;
}

function formatItemHeader(meta: Record<string, unknown>) {
  const parts: string[] = [];
  if (meta.category) parts.push(meta.category as string);
  if (meta.rarity) parts.push(meta.rarity as string);
  if (meta.requires_attunement) parts.push('(Requires Attunement)');
  return parts;
}

export default function MagicPageClient() {
  const [recentlyUsed, setRecentlyUsed] = useState<SearchResult[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);
  const [showAllResults, setShowAllResults] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const abortRef = useRef<AbortController | null>(null);

  async function handleSearch() {
    const q = searchQuery.trim();
    if (!q) return;

    abortRef.current?.abort();
    setShowAllResults(false);
    setSearching(true);
    setSearchError(null);
    setSearchResults([]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch('/api/magic/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q, category: 'all' }),
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      if (!res.ok) throw new Error('API error');
      const data = await res.json();
      if (controller.signal.aborted) return;

      const results: SearchResult[] = (data.results ?? []).map(
        (r: { key: string; name: string; description: string; metadata: Record<string, unknown>; category: string }) => ({
          key: r.key,
          name: r.name,
          description: r.description,
          metadata: r.metadata,
          resultType: r.category as ResultType,
        })
      );
      setSearchResults(results);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setSearchError('The arcane library is unreachable. Try again later.');
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }

  function selectResult(result: SearchResult) {
    setSearchResults([]);
    setShowAllResults(false);
    setSearchQuery('');
    setSelectedResult(result);

    // Add to recently used (deduplicate by key + type)
    setRecentlyUsed(prev => {
      const filtered = prev.filter(r => !(r.key === result.key && r.resultType === result.resultType));
      return [result, ...filtered].slice(0, 20);
    });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (visibleResults.length === 0) return;
      setHighlightIdx(i => (i + 1) % visibleResults.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (visibleResults.length === 0) return;
      setHighlightIdx(i => (i <= 0 ? visibleResults.length - 1 : i - 1));
    } else if (e.key === 'Enter') {
      if (highlightIdx >= 0 && visibleResults[highlightIdx]) {
        e.preventDefault();
        selectResult(visibleResults[highlightIdx]);
      } else {
        handleSearch();
      }
    } else if (e.key === 'Escape') {
      setHighlightIdx(-1);
    }
  }

  // Auto-search after the user types ≥3 letters — debounced 250 ms so
  // every keystroke doesn't hit the API. Below 3 chars, clear results.
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 3) {
      abortRef.current?.abort();
      setSearchResults([]);
      setSearching(false);
      return;
    }
    const t = setTimeout(() => { handleSearch(); }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  // Reset keyboard highlight whenever the result set changes.
  useEffect(() => { setHighlightIdx(-1); }, [searchResults]);

  const selType = selectedResult ? TYPE_CONFIG[selectedResult.resultType] : null;
  const isSpellLike = selectedResult?.resultType === 'spell' || selectedResult?.resultType === 'scroll';
  const isItem = selectedResult?.resultType === 'magic_item';
  const isWeapon = selectedResult?.resultType === 'weapon';
  const isArmor = selectedResult?.resultType === 'armor';

  // Search results: show first 12 unless expanded
  const visibleResults = showAllResults ? searchResults : searchResults.slice(0, 12);
  const hasMoreResults = searchResults.length > 12 && !showAllResults;

  return (
    <div className="max-w-[1000px] mx-auto px-4 sm:px-8 py-8">

      {/* Search bar */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }} className="mb-4">
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search spells &amp; magic items..."
          style={{ flex: 1, minWidth: 200 }}
          className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-3 py-2
                     text-[var(--color-text)] font-serif text-sm placeholder:text-[var(--color-text-dim)]
                     outline-none focus:border-[var(--color-gold)]"
        />
        <button
          onClick={handleSearch}
          disabled={searching || !searchQuery.trim()}
          className="px-4 py-2 text-[0.7rem] uppercase tracking-[0.15em] font-serif
                     border border-[var(--color-gold)] text-[var(--color-gold)] rounded
                     transition-colors disabled:opacity-50 cursor-pointer
                     hover:bg-[var(--color-gold)] hover:text-[var(--color-bg)]"
        >
          Search
        </button>
      </div>

      {/* Recently used bar */}
      {recentlyUsed.length > 0 && (
        <div className="mb-4">
          <div className="text-[0.6rem] uppercase tracking-[0.18em] text-[var(--color-text-muted)] font-sans mb-2">
            Recently Used
          </div>
          <div style={{ display: 'flex', gap: 18, overflow: 'hidden' }}>
            {recentlyUsed.map(r => {
              const tc = TYPE_CONFIG[r.resultType] ?? TYPE_CONFIG.other;
              const color = tc.color;
              return (
                <button
                  key={`${r.resultType}-${r.key}`}
                  onClick={() => setSelectedResult(r)}
                  className="flex flex-col items-center cursor-pointer group"
                  title={r.name}
                >
                  <div
                    style={{
                      width: 58, height: 58, borderRadius: '50%', flexShrink: 0,
                      border: `1.5px solid ${color}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: 'var(--color-surface-raised)',
                      fontSize: '0.45rem', color: 'var(--color-text-dim)',
                      textAlign: 'center', lineHeight: 1.1, padding: 2,
                      overflow: 'hidden',
                    }}
                    className="group-hover:scale-110 transition-transform"
                  >
                    <span style={{ fontSize: '0.8rem' }}>
                      {tc.sigil}
                    </span>
                  </div>
                  <span className="text-center text-[var(--color-text-muted)] mt-0.5 leading-tight line-clamp-2"
                    style={{ width: 58, fontSize: 9, textTransform: 'uppercase' }}
                  >
                    {r.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Search results */}
      {searching && (
        <div className="text-[var(--color-text-muted)] font-serif italic text-sm mb-4">
          Consulting the arcane library...
        </div>
      )}
      {searchError && (
        <div className="text-[var(--color-danger,#a05a4a)] font-serif italic text-sm mb-4">
          {searchError}
        </div>
      )}
      {searchResults.length > 0 && (
        <div className="mb-4">
          {visibleResults.map((r, idx) => (
            <button
              key={`${r.resultType}-${r.key}`}
              onClick={() => selectResult(r)}
              onMouseEnter={() => setHighlightIdx(idx)}
              className="w-full text-left px-3 py-2 font-serif text-sm text-[var(--color-text)]
                         border-b border-[var(--color-border)]
                         transition-colors cursor-pointer"
              style={highlightIdx === idx ? { background: 'var(--color-surface-raised)' } : undefined}
            >
              {/* Type indicator */}
              <span
                className="inline-block text-[0.6rem] uppercase tracking-wider font-sans mr-2 px-1.5 py-0.5 rounded"
                style={{
                  color: TYPE_CONFIG[r.resultType]?.color ?? '#888',
                  border: `1px solid ${(TYPE_CONFIG[r.resultType]?.color ?? '#888')}50`,
                }}
              >
                {TYPE_CONFIG[r.resultType]?.label ?? r.resultType}
              </span>
              <span className="font-semibold">{r.name}</span>
              {r.metadata.level !== undefined && (
                <span className="ml-2 text-[var(--color-text-muted)] text-xs">
                  {r.metadata.level === 0 ? 'Cantrip' : `Lvl ${r.metadata.level}`}
                  {r.metadata.school ? ` ${r.metadata.school}` : ''}
                </span>
              )}
              {typeof r.metadata.rarity === 'string' && r.metadata.rarity ? (
                <span className="ml-2 text-[var(--color-text-muted)] text-xs">
                  {r.metadata.rarity}
                </span>
              ) : null}
              {typeof r.metadata.damage_dice === 'string' && r.metadata.damage_dice ? (
                <span className="ml-2 text-[var(--color-text-muted)] text-xs">
                  {r.metadata.damage_dice} {String(r.metadata.damage_type)}
                </span>
              ) : null}
            </button>
          ))}
          {hasMoreResults && (
            <button
              onClick={() => setShowAllResults(true)}
              className="w-full text-left px-3 py-2 font-serif text-[0.75rem] text-[var(--color-gold)]
                         hover:text-[var(--color-text)] transition-colors cursor-pointer"
            >
              Show all {searchResults.length} results
            </button>
          )}
        </div>
      )}

      {/* Reading pane */}
      {selectedResult && (
        <div
          className="border rounded p-6"
          style={{
            borderColor: (selType?.color ?? '#888') + '60',
            background: 'var(--color-surface)',
            position: 'relative',
          }}
        >
          {/* Dismiss button */}
          <button
            onClick={() => { setSelectedResult(null); setSearchQuery(''); }}
            style={{
              position: 'absolute', top: 10, right: 10,
              width: 22, height: 22, borderRadius: '50%',
              border: '1px solid #7b1a1a', background: 'transparent',
              color: '#7b1a1a', fontSize: '0.7rem', fontWeight: 'bold',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}
            title="Dismiss"
          >
            ✕
          </button>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }} className="mb-3">
            <span
              className="text-[0.6rem] uppercase tracking-wider font-sans px-1.5 py-0.5 rounded"
              style={{
                color: selType?.color ?? '#888',
                border: `1px solid ${(selType?.color ?? '#888')}50`,
              }}
            >
              {selType?.label ?? selectedResult.resultType}
            </span>
            <span className="font-serif text-xl font-semibold text-[var(--color-text)]">
              {selectedResult.name}
            </span>
          </div>
          {/* Spell metadata */}
          {isSpellLike && 'level' in selectedResult.metadata && (
            <div className="text-[0.7rem] text-[var(--color-text-muted)] space-y-0.5 mb-4">
              {formatSpellHeader(selectedResult.metadata).map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            </div>
          )}
          {/* Magic item metadata */}
          {isItem && ('rarity' in selectedResult.metadata || 'category' in selectedResult.metadata) && (
            <div className="text-[0.7rem] text-[var(--color-text-muted)] mb-4">
              {formatItemHeader(selectedResult.metadata).join(' \u2022 ')}
            </div>
          )}
          {/* Weapon metadata */}
          {isWeapon && (
            <div className="text-[0.7rem] text-[var(--color-text-muted)] space-y-0.5 mb-4">
              {selectedResult.metadata.damage_dice ? (
                <div>Damage: {String(selectedResult.metadata.damage_dice)} {String(selectedResult.metadata.damage_type)}</div>
              ) : null}
              {selectedResult.metadata.properties ? (
                <div>Properties: {String(selectedResult.metadata.properties)}</div>
              ) : null}
              <div>{selectedResult.metadata.is_martial ? 'Martial' : 'Simple'} weapon</div>
              {selectedResult.metadata.cost ? <div>Cost: {String(selectedResult.metadata.cost)} gp</div> : null}
              {selectedResult.metadata.weight ? <div>Weight: {String(selectedResult.metadata.weight)} lb</div> : null}
            </div>
          )}
          {/* Armor metadata */}
          {isArmor && (
            <div className="text-[0.7rem] text-[var(--color-text-muted)] space-y-0.5 mb-4">
              {selectedResult.metadata.base_ac != null ? <div>Base AC: {String(selectedResult.metadata.base_ac)}</div> : null}
              {selectedResult.metadata.stealth_disadvantage ? <div>Stealth: Disadvantage</div> : null}
              {selectedResult.metadata.strength_requirement ? <div>Str Required: {String(selectedResult.metadata.strength_requirement)}</div> : null}
              {selectedResult.metadata.cost ? <div>Cost: {String(selectedResult.metadata.cost)} gp</div> : null}
              {selectedResult.metadata.weight ? <div>Weight: {String(selectedResult.metadata.weight)} lb</div> : null}
            </div>
          )}
          {/* Description */}
          <div className="font-serif text-[1.05rem] text-[var(--color-text-body)] leading-relaxed whitespace-pre-wrap">
            {selectedResult.description}
          </div>
          {/* Create Card link */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
            <Link
              href="/dm/inventory"
              className="text-[0.65rem] uppercase tracking-widest text-[var(--color-text-muted)] hover:text-[var(--color-gold)] transition-colors"
            >
              &rarr; Create Card
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
