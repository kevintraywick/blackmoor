'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { Player, BoonTemplate, PlayerBoon, BoonCategory } from '@/lib/types';

interface Props {
  players: Player[];
  initialTemplates: BoonTemplate[];
  initialActive: PlayerBoon[];
}

const CATEGORY_COLORS: Record<BoonCategory, string> = {
  boon: '#c9a84c',
  inspiration: '#7ac28a',
  luck: '#8ea4d2',
};

function timeRemaining(boon: PlayerBoon): string | null {
  if (boon.expiry_type !== 'timer') return null;
  const elapsed = (Date.now() / 1000) - boon.started_at;
  const remaining = (boon.expiry_minutes * 60) - elapsed;
  if (remaining <= 0) return 'expired';
  const m = Math.floor(remaining / 60);
  const s = Math.floor(remaining % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface CustomBoonDraft {
  name: string;
  description: string;
  expiryType: 'permanent' | 'long_rest' | 'timer';
  timerMinutes: number;
}

export default function BoonsDmClient({ players, initialTemplates, initialActive }: Props) {
  const [templates, setTemplates] = useState<BoonTemplate[]>(initialTemplates);
  const [activeBoons, setActiveBoons] = useState<PlayerBoon[]>(initialActive);
  const [, setTick] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Per-player input state
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [focused, setFocused] = useState<string | null>(null);
  const [customDrafts, setCustomDrafts] = useState<Record<string, CustomBoonDraft>>({});

  // Library edit state
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null);
  const [editFields, setEditFields] = useState<{ name: string; description: string; effect: string }>({ name: '', description: '', effect: '' });

  // Timer auto-expire
  useEffect(() => {
    const hasTimers = activeBoons.some(b => b.expiry_type === 'timer');
    if (!hasTimers) return;
    tickRef.current = setInterval(() => {
      setTick(t => t + 1);
      setActiveBoons(prev => {
        const expired = prev.filter(b => timeRemaining(b) === 'expired');
        if (expired.length === 0) return prev;
        for (const b of expired) {
          fetch('/api/boons', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: b.id, action: 'cancel' }),
          }).catch(() => {});
        }
        const expiredIds = new Set(expired.map(b => b.id));
        return prev.filter(b => !expiredIds.has(b.id));
      });
    }, 1000);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [activeBoons]);

  const cancelBoon = useCallback(async (id: string) => {
    setActiveBoons(prev => prev.filter(b => b.id !== id));
    await fetch('/api/boons', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action: 'cancel' }),
    });
  }, []);

  async function grantFromTemplate(playerId: string, template: BoonTemplate) {
    const sessionId = typeof window !== 'undefined' ? localStorage.getItem('blackmoor-last-session') : null;
    const res = await fetch('/api/boons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        template_id: template.id,
        player_id: playerId,
        expiry_type: 'permanent',
        session_id: sessionId,
      }),
    });
    if (res.ok) {
      const data = await fetch('/api/boons').then(r => r.json());
      setActiveBoons(data.active);
    }
    setInputs(prev => ({ ...prev, [playerId]: '' }));
  }

  async function grantCustom(playerId: string) {
    const draft = customDrafts[playerId];
    if (!draft) return;
    const sessionId = typeof window !== 'undefined' ? localStorage.getItem('blackmoor-last-session') : null;
    const res = await fetch('/api/boons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        player_id: playerId,
        name: draft.name,
        description: draft.description,
        expiry_type: draft.expiryType,
        expiry_minutes: draft.expiryType === 'timer' ? draft.timerMinutes : 0,
        session_id: sessionId,
      }),
    });
    if (res.ok) {
      const data = await fetch('/api/boons').then(r => r.json());
      setActiveBoons(data.active);
      setTemplates(data.templates);
    }
    setCustomDrafts(prev => { const n = { ...prev }; delete n[playerId]; return n; });
    setInputs(prev => ({ ...prev, [playerId]: '' }));
  }

  async function deleteTemplate(templateId: string) {
    await fetch('/api/boons', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template_id: templateId }),
    });
    setTemplates(prev => prev.filter(t => t.id !== templateId));
  }

  async function saveTemplate() {
    if (!editingTemplate) return;
    await fetch('/api/boons', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update_template',
        template_id: editingTemplate,
        name: editFields.name,
        description: editFields.description,
        effect: editFields.effect,
      }),
    });
    setTemplates(prev => prev.map(t =>
      t.id === editingTemplate
        ? { ...t, name: editFields.name, description: editFields.description, effect: editFields.effect }
        : t
    ));
    setEditingTemplate(null);
  }

  function getSuggestions(playerId: string): BoonTemplate[] {
    const q = (inputs[playerId] || '').trim().toLowerCase();
    if (!q) return [];
    return templates.filter(t => t.name.toLowerCase().includes(q));
  }

  function handleKeyDown(playerId: string, e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      setInputs(prev => ({ ...prev, [playerId]: '' }));
      setFocused(null);
      return;
    }
    if (e.key !== 'Enter') return;
    const q = (inputs[playerId] || '').trim();
    if (!q) return;

    const suggestions = getSuggestions(playerId);
    if (suggestions.length === 1) {
      // Exact or only match — grant from template
      grantFromTemplate(playerId, suggestions[0]);
    } else if (suggestions.length === 0) {
      // No match — open custom boon draft
      setCustomDrafts(prev => ({
        ...prev,
        [playerId]: { name: q, description: '', expiryType: 'permanent', timerMinutes: 10 },
      }));
      setFocused(null);
    }
    // If multiple matches, do nothing — let user refine or click
  }

  return (
    <div className="max-w-[1000px] mx-auto px-4 pb-16">
      {/* Return to Session */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }} className="pt-3">
        <Link
          href="/dm"
          className="text-[0.65rem] uppercase tracking-[0.15em] text-[var(--color-text-muted)] hover:text-[var(--color-gold)] transition-colors font-sans no-underline"
        >
          ← Session
        </Link>
      </div>

      {/* Header */}
      <h1 className="font-serif text-[2rem] italic text-[var(--color-text)] leading-none tracking-tight mt-4">Boons</h1>
      <p className="text-[0.65rem] uppercase tracking-[0.22em] text-[var(--color-text-muted)] mt-1.5 mb-8">
        Active Effects Tracker
      </p>

      {/* Player rows */}
      <div className="space-y-3">
        {players.map(player => {
          const pBoons = activeBoons.filter(b => b.player_id === player.id);
          const hasBoons = pBoons.length > 0;
          const input = inputs[player.id] || '';
          const suggestions = focused === player.id ? getSuggestions(player.id) : [];
          const draft = customDrafts[player.id];

          return (
            <div
              key={player.id}
              className="rounded-lg px-4 py-3"
              style={{
                background: hasBoons ? 'rgba(201,168,76,0.06)' : 'rgba(90,79,70,0.08)',
                border: `1px solid ${hasBoons ? 'rgba(201,168,76,0.2)' : 'rgba(90,79,70,0.15)'}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                {/* Portrait */}
                <div
                  className="relative rounded-full overflow-hidden"
                  style={{
                    width: 32, height: 32, flexShrink: 0,
                    border: `2px solid ${hasBoons ? '#c9a84c' : '#3d3530'}`,
                  }}
                >
                  <Image src={player.img} alt={player.character} fill className="object-cover" />
                </div>

                {/* Name */}
                <span className="font-serif text-sm" style={{ width: 112, flexShrink: 0, color: hasBoons ? '#c9a84c' : '#e8ddd0' }}>
                  {player.character}
                </span>

                {/* Boon name input + autocomplete */}
                <div style={{ position: 'relative', width: 140, flexShrink: 0 }}>
                  <input
                    type="text"
                    placeholder="Boon name..."
                    value={input}
                    onChange={e => setInputs(prev => ({ ...prev, [player.id]: e.target.value }))}
                    onFocus={() => setFocused(player.id)}
                    onBlur={() => setTimeout(() => setFocused(null), 150)}
                    onKeyDown={e => handleKeyDown(player.id, e)}
                    className="bg-transparent border-b border-[var(--color-border)] text-[var(--color-text)] text-xs font-serif outline-none px-1 py-0.5 w-full placeholder:text-[var(--color-text-muted)]"
                  />
                  {suggestions.length > 0 && (
                    <div
                      className="border border-[var(--color-border)] rounded"
                      style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20, background: 'var(--color-surface)', marginTop: 2 }}
                    >
                      {suggestions.map(t => (
                        <button
                          key={t.id}
                          type="button"
                          onMouseDown={() => grantFromTemplate(player.id, t)}
                          className="w-full text-left px-2 py-1.5 text-xs font-serif text-[var(--color-text)] hover:bg-[rgba(201,168,76,0.1)] transition-colors"
                        >
                          {t.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Boon pills */}
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  {pBoons.map(b => {
                    const tr = timeRemaining(b);
                    return (
                      <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(201,168,76,0.12)', borderRadius: 4, padding: '4px 8px' }}>
                        <span className="font-sans text-xs text-[#c9a84c]">{b.name}</span>
                        <span className="font-sans text-xs text-[#8a7d6e]">
                          {b.expiry_type === 'permanent' && 'Until used'}
                          {b.expiry_type === 'long_rest' && 'Until long rest'}
                          {b.expiry_type === 'timer' && (tr ? `${tr}` : 'Timer')}
                        </span>
                        {!b.seen && <svg className="animate-pulse" viewBox="0 0 24 24" fill="#ffffff" style={{ width: 16, height: 16, filter: 'drop-shadow(0 0 4px rgba(255,255,255,0.6))' }}><path d="M13 2L3 14h7l-2 8 10-12h-7l2-8z"/></svg>}
                        <button
                          onClick={() => cancelBoon(b.id)}
                          className="text-[#8a7d6e] hover:text-[#c0392b] text-xs transition-colors"
                          title="Cancel boon"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Custom boon draft — appears when no template match */}
              {draft && (
                <div className="mt-3 ml-[176px]" style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <input
                    type="text"
                    placeholder="Description..."
                    value={draft.description}
                    onChange={e => setCustomDrafts(prev => ({
                      ...prev,
                      [player.id]: { ...prev[player.id], description: e.target.value },
                    }))}
                    className="bg-transparent border-b border-[var(--color-border)] text-[var(--color-text)] text-xs font-serif outline-none px-1 py-0.5 placeholder:text-[var(--color-text-muted)]"
                    style={{ width: 200 }}
                    autoFocus={false}
                  />

                  {/* Expiry radios */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {(['permanent', 'long_rest', 'timer'] as const).map(opt => (
                      <button
                        key={opt}
                        onClick={() => setCustomDrafts(prev => ({
                          ...prev,
                          [player.id]: { ...prev[player.id], expiryType: opt },
                        }))}
                        style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                      >
                        <div
                          className="rounded-full"
                          style={{
                            width: 14, height: 14,
                            border: `2px solid ${draft.expiryType === opt ? '#4a7a5a' : '#5a4f46'}`,
                            backgroundColor: draft.expiryType === opt ? '#4a7a5a' : 'transparent',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                        >
                          {draft.expiryType === opt && <span className="text-white" style={{ fontSize: '0.5rem' }}>✓</span>}
                        </div>
                        <span className="font-sans text-[var(--color-text-muted)]" style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {opt === 'permanent' ? 'Until used' : opt === 'long_rest' ? 'Long Rest' : 'Timer'}
                        </span>
                      </button>
                    ))}

                    {draft.expiryType === 'timer' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <button
                          onClick={() => setCustomDrafts(prev => ({
                            ...prev,
                            [player.id]: { ...prev[player.id], timerMinutes: Math.max(1, prev[player.id].timerMinutes - 1) },
                          }))}
                          className="bg-[var(--color-surface-raised)] border border-[var(--color-border)] text-[var(--color-text-muted)] rounded-sm hover:border-[var(--color-gold)] hover:text-[var(--color-gold)]"
                          style={{ width: 22, height: 20, fontSize: '0.85rem', lineHeight: 1 }}
                        >−</button>
                        <span className="text-[var(--color-text)] font-serif" style={{ fontSize: '0.9rem', width: 24, textAlign: 'center' }}>{draft.timerMinutes}</span>
                        <button
                          onClick={() => setCustomDrafts(prev => ({
                            ...prev,
                            [player.id]: { ...prev[player.id], timerMinutes: prev[player.id].timerMinutes + 1 },
                          }))}
                          className="bg-[var(--color-surface-raised)] border border-[var(--color-border)] text-[var(--color-text-muted)] rounded-sm hover:border-[var(--color-gold)] hover:text-[var(--color-gold)]"
                          style={{ width: 22, height: 20, fontSize: '0.85rem', lineHeight: 1 }}
                        >+</button>
                        <span className="text-[#8a7d6e] font-sans" style={{ fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginLeft: 2 }}>min</span>
                      </div>
                    )}
                  </div>

                  {/* Grant button */}
                  <button
                    onClick={() => grantCustom(player.id)}
                    className="font-sans uppercase tracking-wider rounded-sm hover:bg-[#e8ddd0] transition-colors"
                    style={{ padding: '4px 12px', fontSize: '0.65rem', background: '#c9a84c', color: '#1a1614', flexShrink: 0 }}
                  >
                    Grant
                  </button>
                  <button
                    onClick={() => {
                      setCustomDrafts(prev => { const n = { ...prev }; delete n[player.id]; return n; });
                      setInputs(prev => ({ ...prev, [player.id]: '' }));
                    }}
                    className="text-[#8a7d6e] hover:text-[#c0392b] text-xs transition-colors"
                    style={{ flexShrink: 0 }}
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Boon Library — read-only reference */}
      <div className="text-[0.7rem] uppercase tracking-[0.15em] text-[var(--color-gold)] font-sans mb-4 mt-10 pb-1.5 border-b border-[var(--color-border)]">
        Boon Library
      </div>

      <div className="flex flex-col gap-3">
        {templates.map(t => {
          const catColor = CATEGORY_COLORS[t.category as BoonCategory];
          const isEditing = editingTemplate === t.id;

          if (isEditing) {
            return (
              <div key={t.id} className="bg-[var(--color-surface)] border border-[var(--color-gold)] rounded-md p-4">
                <div className="flex flex-col gap-2">
                  <input
                    type="text"
                    value={editFields.name}
                    onChange={e => setEditFields(prev => ({ ...prev, name: e.target.value }))}
                    className="bg-[var(--color-bg)] border border-[var(--color-border)] px-3 py-1.5 text-[var(--color-text)] font-serif text-sm rounded"
                    placeholder="Name"
                  />
                  <input
                    type="text"
                    value={editFields.description}
                    onChange={e => setEditFields(prev => ({ ...prev, description: e.target.value }))}
                    className="bg-[var(--color-bg)] border border-[var(--color-border)] px-3 py-1.5 text-[var(--color-text)] font-serif text-sm rounded"
                    placeholder="Description"
                  />
                  <input
                    type="text"
                    value={editFields.effect}
                    onChange={e => setEditFields(prev => ({ ...prev, effect: e.target.value }))}
                    className="bg-[var(--color-bg)] border border-[var(--color-border)] px-3 py-1.5 text-[var(--color-text)] font-serif text-sm rounded"
                    placeholder="Effect"
                  />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={saveTemplate}
                      className="font-sans uppercase tracking-wider rounded-sm hover:bg-[#e8ddd0] transition-colors"
                      style={{ padding: '4px 14px', fontSize: '0.65rem', background: '#c9a84c', color: '#1a1614' }}
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingTemplate(null)}
                      className="text-[#8a7d6e] hover:text-[var(--color-text)] text-xs font-sans uppercase tracking-wider transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div key={t.id} className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md p-4">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span className="font-serif text-[1.1rem] text-[var(--color-text)]">{t.name}</span>
                <span className="text-[0.55rem] uppercase tracking-wider font-sans px-1.5 py-0.5 rounded-sm"
                  style={{ color: catColor, border: `1px solid ${catColor}40` }}>
                  {t.category}
                </span>
                {t.grants_advantage && (
                  <span className="text-[0.55rem] uppercase tracking-wider font-sans px-1.5 py-0.5 rounded-sm text-[#c9a84c] border border-[#c9a84c40]">
                    Advantage
                  </span>
                )}
                <div style={{ flex: 1 }} />
                <button
                  onClick={() => {
                    setEditingTemplate(t.id);
                    setEditFields({ name: t.name, description: t.description, effect: t.effect });
                  }}
                  className="text-[#6a5a50] hover:text-[var(--color-gold)] text-xs font-sans uppercase tracking-wider transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => deleteTemplate(t.id)}
                  className="text-[#6a5a50] hover:text-[#c0392b] text-xs font-sans uppercase tracking-wider transition-colors"
                >
                  Delete
                </button>
              </div>
              <p className="font-serif text-[0.9rem] text-[var(--color-text-body)] leading-relaxed mb-2">{t.description}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0px 12px' }} className="text-[0.72rem] text-[var(--color-text-muted)] font-sans">
                {t.effect && <span><span className="text-[#6a5a50]">Effect:</span> {t.effect}</span>}
                {t.action_type && <span><span className="text-[#6a5a50]">Action:</span> {t.action_type}</span>}
                {t.range && <span><span className="text-[#6a5a50]">Range:</span> {t.range}</span>}
                {t.duration && <span><span className="text-[#6a5a50]">Duration:</span> {t.duration}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
