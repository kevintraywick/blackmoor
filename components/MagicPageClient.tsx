'use client';

import { useState, useRef } from 'react';
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
  const [otherName, setOtherName] = useState('');
  const [otherDesc, setOtherDesc] = useState('');
  const [showOtherEditor, setShowOtherEditor] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  async function handleSearch(category: MagicCategory) {
    const q = searchQuery.trim();
    if (!q) return;

    // Cancel any in-flight search
    abortRef.current?.abort();

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
      // Default to Spells on Enter
      handleSearch('spell');
    }
  }

  return (
    <div className="max-w-[1000px] mx-auto px-4 sm:px-8 py-8">
      {/* Page header */}
      <h1 className="font-serif text-[2rem] italic text-[var(--color-text)] leading-none tracking-tight">Magic</h1>
      <p className="text-[0.65rem] uppercase tracking-[0.22em] text-[var(--color-text-muted)] mt-1.5 mb-6">
        Spells &middot; Scrolls &middot; Arcane Items
      </p>

      {/* Search bar + category buttons */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search by name..."
          className="flex-1 min-w-[200px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded px-3 py-2
                     text-[var(--color-text)] font-serif text-sm placeholder:text-[var(--color-text-dim)]
                     outline-none focus:border-[var(--color-gold)]"
        />
        <div className="flex gap-1.5 ml-auto">
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

      {/* Search results list */}
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
        <div className="border border-[var(--color-border)] rounded bg-[var(--color-surface)] mb-4 max-h-[240px] overflow-y-auto">
          {searchResults.map(r => (
            <button
              key={r.key}
              onClick={() => selectResult(r, searchCategory)}
              className="w-full text-left px-3 py-2 font-serif text-sm text-[var(--color-text)]
                         hover:bg-[var(--color-surface-raised)] border-b border-[var(--color-border)]
                         last:border-b-0 transition-colors cursor-pointer"
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
          <div className="flex gap-2 mt-2">
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

      {/* Catalog strip */}
      {catalog.length > 0 && (
        <div className="mb-6">
          <div className="text-[0.6rem] uppercase tracking-[0.22em] text-[var(--color-text-dim)] mb-2">
            Reference Catalog
          </div>
          <div className="flex flex-wrap gap-3">
            {catalog.map(entry => {
              const config = CATEGORY_CONFIG.find(c => c.key === entry.category);
              if (!config) return null;
              return (
                <div key={entry.id} className="group relative">
                  <button
                    onClick={() => loadFromCatalog(entry)}
                    className="flex flex-col items-center gap-1 w-16 cursor-pointer"
                    title={entry.name}
                  >
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-lg border transition-all
                                 hover:scale-110"
                      style={{ borderColor: config.color, color: config.color, background: config.color + '15' }}
                    >
                      {config.sigil}
                    </div>
                    <span className="text-[0.55rem] text-[var(--color-text-muted)] text-center leading-tight line-clamp-2 font-serif">
                      {entry.name}
                    </span>
                  </button>
                  <button
                    onClick={() => removeCatalogEntry(entry.id)}
                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)]
                               text-[var(--color-text-dim)] text-[0.55rem] leading-none flex items-center justify-center
                               opacity-0 group-hover:opacity-100 transition-opacity hover:text-[var(--color-danger,#a05a4a)] cursor-pointer"
                    title="Remove from catalog"
                  >
                    &times;
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Four panes grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {CATEGORY_CONFIG.map(cat => {
          const content = paneContents[cat.key];
          return (
            <div
              key={cat.key}
              className="border rounded p-4 min-h-[200px] flex flex-col"
              style={{ borderColor: cat.color + '60', background: 'var(--color-surface)' }}
            >
              {/* Pane header */}
              <div className="flex items-center gap-2 mb-3 pb-2 border-b" style={{ borderColor: cat.color + '40' }}>
                <span className="text-lg" style={{ color: cat.color }}>{cat.sigil}</span>
                <span
                  className="text-[0.65rem] uppercase tracking-[0.22em] font-serif font-semibold"
                  style={{ color: cat.color }}
                >
                  {cat.label}
                </span>
              </div>

              {/* Pane content */}
              {content ? (
                <div className="flex-1 overflow-y-auto">
                  <div className="font-serif text-base font-semibold text-[var(--color-text)] mb-2">
                    {content.name}
                  </div>
                  {/* Metadata header */}
                  {(cat.key === 'spell' || cat.key === 'scroll') && 'level' in content.metadata && (
                    <div className="text-[0.6rem] text-[var(--color-text-muted)] space-y-0.5 mb-3">
                      {formatSpellHeader(content.metadata).map((line, i) => (
                        <div key={i}>{line}</div>
                      ))}
                    </div>
                  )}
                  {cat.key === 'magic_item' && ('rarity' in content.metadata || 'category' in content.metadata) && (
                    <div className="text-[0.6rem] text-[var(--color-text-muted)] mb-3">
                      {formatItemHeader(content.metadata).join(' \u2022 ')}
                    </div>
                  )}
                  {/* Description */}
                  <div className="font-serif text-[0.8rem] text-[var(--color-text-body)] leading-relaxed whitespace-pre-wrap">
                    {content.description}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <span className="font-serif italic text-[0.75rem] text-[var(--color-text-dim)]">
                    Search for {cat.key === 'other' ? 'an entry' : `a ${cat.label.toLowerCase().replace(/s$/, '')}`} to see it here
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
