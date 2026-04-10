'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import type { MagicCatalogEntry, MagicCategory } from '@/lib/types';

interface SearchResult {
  key: string;
  name: string;
  description: string;
  metadata: Record<string, unknown>;
}

const CATEGORY_CONFIG: { key: MagicCategory; label: string; apiCategory?: 'spell' | 'magic_item'; sigil: string; color: string }[] = [
  { key: 'spell',      label: 'Spells',      apiCategory: 'spell',      sigil: '\u2726', color: '#c9a84c' },  // star
  { key: 'scroll',     label: 'Scrolls',     apiCategory: 'spell',      sigil: '\u2709', color: '#a89070' },  // scroll/envelope
  { key: 'magic_item', label: 'Magic Items',  apiCategory: 'magic_item', sigil: '\u25C6', color: '#7a6fa0' },  // diamond
  { key: 'other',      label: 'Other',                                   sigil: '\u270E', color: '#6a8a6a' },  // pencil
];

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

function scrollName(name: string) {
  return `Scroll of ${name}`;
}

function formatItemHeader(meta: Record<string, unknown>) {
  const parts: string[] = [];
  if (meta.category) parts.push(meta.category as string);
  if (meta.rarity) parts.push(meta.rarity as string);
  if (meta.requires_attunement) parts.push('(Requires Attunement)');
  return parts;
}

export default function MagicPageClient({ initial }: { initial: MagicCatalogEntry[] }) {
  const [catalog, setCatalog] = useState<MagicCatalogEntry[]>(initial);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchCategory, setSearchCategory] = useState<MagicCategory | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [paneContents, setPaneContents] = useState<Record<MagicCategory, { name: string; description: string; metadata: Record<string, unknown> } | null>>({
    spell: null, scroll: null, magic_item: null, other: null,
  });
  const [activeCategory, setActiveCategory] = useState<MagicCategory>('spell');
  const [otherName, setOtherName] = useState('');
  const [otherDesc, setOtherDesc] = useState('');
  const [showOtherEditor, setShowOtherEditor] = useState(false);
  const [showAllResults, setShowAllResults] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  async function handleSearch(category: MagicCategory) {
    const q = searchQuery.trim();
    if (!q) return;

    // Cancel any in-flight search
    abortRef.current?.abort();

    // Switch active tab
    setActiveCategory(category);
    setShowAllResults(false);

    // "Other" — open editor instead of API search
    if (category === 'other') {
      setOtherName(q);
      setOtherDesc('');
      setShowOtherEditor(true);
      setSearchResults([]);
      setSearchCategory(null);
      setSearchError(null);
      return;
    }

    const config = CATEGORY_CONFIG.find(c => c.key === category);
    if (!config) return;
    setSearching(true);
    setSearchError(null);
    setSearchResults([]);
    setSearchCategory(category);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch('/api/magic/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q, category: config.apiCategory }),
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      if (!res.ok) throw new Error('API error');
      const data = await res.json();
      if (controller.signal.aborted) return;
      setSearchResults(data.results ?? []);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setSearchError('The arcane library is unreachable. Try again later.');
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }

  async function selectResult(result: SearchResult, category: MagicCategory) {
    const displayName = category === 'scroll' ? scrollName(result.name) : result.name;

    // Clear search results immediately to prevent double-click
    setSearchResults([]);
    setSearchCategory(null);
    setShowAllResults(false);

    // Load into pane
    setPaneContents(prev => ({
      ...prev,
      [category]: { name: displayName, description: result.description, metadata: result.metadata },
    }));

    // Save to catalog (upsert — server deduplicates by category + api_key)
    try {
      const res = await fetch('/api/magic/catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          name: displayName,
          api_key: result.key,
          description: result.description,
          metadata: result.metadata,
        }),
      });
      if (res.ok) {
        const entry: MagicCatalogEntry = await res.json();
        // Replace existing entry with same api_key or prepend new one
        setCatalog(prev => {
          const filtered = prev.filter(e => !(e.api_key && e.api_key === entry.api_key && e.category === entry.category));
          return [entry, ...filtered];
        });
      }
    } catch { /* catalog save failure is non-critical */ }
  }

  async function saveOtherEntry() {
    if (!otherName.trim()) return;
    const description = otherDesc.trim();

    setPaneContents(prev => ({
      ...prev,
      other: { name: otherName, description, metadata: {} },
    }));
    setShowOtherEditor(false);

    try {
      const res = await fetch('/api/magic/catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: 'other',
          name: otherName,
          api_key: null,
          description,
          metadata: {},
        }),
      });
      if (res.ok) {
        const entry: MagicCatalogEntry = await res.json();
        setCatalog(prev => [entry, ...prev]);
      }
    } catch { /* non-critical */ }
  }

  function loadFromCatalog(entry: MagicCatalogEntry) {
    setActiveCategory(entry.category);
    setPaneContents(prev => ({
      ...prev,
      [entry.category]: { name: entry.name, description: entry.description, metadata: entry.metadata },
    }));
  }

  async function removeCatalogEntry(id: string) {
    const prev = catalog;
    setCatalog(p => p.filter(e => e.id !== id));
    try {
      const res = await fetch(`/api/magic/catalog/${id}`, { method: 'DELETE' });
      if (!res.ok) setCatalog(prev);
    } catch {
      setCatalog(prev);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      handleSearch(activeCategory);
    }
  }

  const activeCatConfig = CATEGORY_CONFIG.find(c => c.key === activeCategory)!;
  const content = paneContents[activeCategory];

  // Search results: show first 12 unless expanded
  const visibleResults = showAllResults ? searchResults : searchResults.slice(0, 12);
  const hasMoreResults = searchResults.length > 12 && !showAllResults;

  return (
    <div className="max-w-[1000px] mx-auto px-4 sm:px-8 py-8">

      {/* Search bar + category search buttons */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }} className="mb-4">
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search by name..."
          style={{ flex: 1, minWidth: 200 }}
          className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-3 py-2
                     text-[var(--color-text)] font-serif text-sm placeholder:text-[var(--color-text-dim)]
                     outline-none focus:border-[var(--color-gold)]"
        />
        <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
          {CATEGORY_CONFIG.map(cat => (
            <button
              key={cat.key}
              onClick={() => handleSearch(cat.key)}
              disabled={searching}
              className="px-3 py-1.5 text-[0.7rem] uppercase tracking-[0.15em] font-serif
                         border rounded transition-colors
                         disabled:opacity-50 cursor-pointer magic-cat-btn"
              style={{
                '--cat-color': cat.color,
                borderColor: cat.color,
                color: cat.color,
              } as React.CSSProperties}
            >
              {cat.sigil} {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Search results list — no scroll container */}
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
      {searchResults.length > 0 && searchCategory && (
        <div className="mb-4">
          {visibleResults.map(r => (
            <button
              key={r.key}
              onClick={() => selectResult(r, searchCategory)}
              className="w-full text-left px-3 py-2 font-serif text-sm text-[var(--color-text)]
                         hover:bg-[var(--color-surface-raised)] border-b border-[var(--color-border)]
                         transition-colors cursor-pointer"
            >
              <span className="font-semibold">
                {searchCategory === 'scroll' ? scrollName(r.name) : r.name}
              </span>
              {r.metadata.level !== undefined && (
                <span className="ml-2 text-[var(--color-text-muted)] text-xs">
                  {r.metadata.level === 0 ? 'Cantrip' : `Lvl ${r.metadata.level}`}
                  {r.metadata.school ? ` ${r.metadata.school}` : ''}
                </span>
              )}
              {typeof r.metadata.rarity === 'string' && r.metadata.rarity && (
                <span className="ml-2 text-[var(--color-text-muted)] text-xs">
                  {r.metadata.rarity}
                </span>
              )}
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

      {/* "Other" editor */}
      {showOtherEditor && (() => {
        const otherColor = CATEGORY_CONFIG.find(c => c.key === 'other')!.color;
        return (
        <div className="border rounded bg-[var(--color-surface)] p-4 mb-4" style={{ borderColor: otherColor }}>
          <div className="text-[0.65rem] uppercase tracking-[0.18em] mb-2" style={{ color: otherColor }}>
            New Entry: {otherName}
          </div>
          <textarea
            value={otherDesc}
            onChange={e => setOtherDesc(e.target.value)}
            placeholder="Enter description..."
            rows={4}
            className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-3 py-2
                       text-[var(--color-text)] font-serif text-sm placeholder:text-[var(--color-text-dim)]
                       outline-none resize-y"
            style={{ '--focus-color': otherColor } as React.CSSProperties}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button
              onClick={saveOtherEntry}
              className="px-4 py-1.5 text-[0.7rem] uppercase tracking-[0.15em] font-serif
                         border rounded transition-colors cursor-pointer magic-cat-btn"
              style={{ '--cat-color': otherColor, borderColor: otherColor, color: otherColor } as React.CSSProperties}
            >
              Save
            </button>
            <button
              onClick={() => setShowOtherEditor(false)}
              className="px-4 py-1.5 text-[0.7rem] uppercase tracking-[0.15em] font-serif
                         border border-[var(--color-border)] text-[var(--color-text-muted)] rounded
                         hover:bg-[var(--color-surface-raised)] transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
        );
      })()}

      {/* Reading pane — appears when content is loaded */}
      {content ? (
        <div
          className="border rounded p-6"
          style={{
            borderColor: activeCatConfig.color + '60',
            background: 'var(--color-surface)',
          }}
        >
          <div className="font-serif text-xl font-semibold text-[var(--color-text)] mb-3">
            {content.name}
          </div>
          {/* Metadata header */}
          {(activeCategory === 'spell' || activeCategory === 'scroll') && 'level' in content.metadata && (
            <div className="text-[0.7rem] text-[var(--color-text-muted)] space-y-0.5 mb-4">
              {formatSpellHeader(content.metadata).map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            </div>
          )}
          {activeCategory === 'magic_item' && ('rarity' in content.metadata || 'category' in content.metadata) && (
            <div className="text-[0.7rem] text-[var(--color-text-muted)] mb-4">
              {formatItemHeader(content.metadata).join(' \u2022 ')}
            </div>
          )}
          {/* Description */}
          <div className="font-serif text-[1.05rem] text-[var(--color-text-body)] leading-relaxed whitespace-pre-wrap">
            {content.description}
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
      ) : null}
    </div>
  );
}
