'use client';

import { useRef, useState, useEffect } from 'react';
import type { RavenSectionId } from '@/lib/types';

/**
 * Editable prose block for the broadsheet editor. Renders a textarea styled
 * to match final prose (EB Garamond, justified). Focus paints a subtle
 * parchment wash; the outer article box is drawn by the caller.
 *
 * Word counter in the lower-right counts down from `target`. AI-blue brain
 * glyph in the lower-left fires a World AI draft using the section's
 * *headline* (passed in as `byline`) as the prompt; the result replaces the
 * current body text.
 *
 * Target word counts for Layout 1 v1: 3 (col1_lead)=80, 6 (crimson_moon)=80,
 * 7 (blood_moon)=60, 11 (opinion)=60. Sections without a target omit the
 * counter.
 *
 * `minHeight` keeps the textarea at a sensible published-body size even
 * when empty, so the editor layout doesn't jump as the DM types.
 */

// AI accent color — used for the brain button and reserved for all
// AI-driven UI affordances going forward. See DESIGN.md §"AI accent".
export const AI_BLUE = '#4a8ab0';

interface Props {
  value: string;
  onChange: (v: string) => void;
  byline: string;
  sectionId: RavenSectionId;
  target?: number;
  placeholder?: string;
  minHeight?: number;
}

function wordCount(s: string): number {
  const trimmed = s.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

export default function EditableProse({ value, onChange, byline, target, placeholder, minHeight = 80 }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEmpty = value.trim().length === 0;

  // Auto-resize to fit content
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  const remaining = target != null ? target - wordCount(value) : null;
  const counterColor =
    remaining == null ? '#4a3723'
      : remaining === 0 ? '#2d6a3f'
      : remaining < 0   ? '#8b1a1a'
      : '#6a5a4a';

  async function onBrainClick() {
    if (drafting) return;
    const trimmed = byline.trim();
    if (trimmed.length < 3) {
      setError('Type a headline first');
      setTimeout(() => setError(null), 2400);
      return;
    }
    setDrafting(true);
    setError(null);
    try {
      const res = await fetch('/api/raven-post/draft', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ medium: 'broadsheet', oneLineBeat: trimmed, targetWords: target }),
      });
      if (!res.ok) {
        const { error: msg } = await res.json().catch(() => ({ error: 'Draft failed' }));
        setError(msg || 'Draft failed');
        setTimeout(() => setError(null), 2400);
        return;
      }
      const { body } = await res.json() as { headline: string | null; body: string };
      if (body) onChange(body);
    } catch (err) {
      console.error('brain draft', err);
      setError('Network error');
      setTimeout(() => setError(null), 2400);
    } finally {
      setDrafting(false);
    }
  }

  return (
    // flex: 1 lets this wrapper absorb remaining space inside a flex-column
    // parent (e.g., ArticleBox). The absolute-positioned brain + word counter
    // below stick to the wrapper's bottom — so they pin to the outer box
    // bottom, not the textarea's natural bottom.
    <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column' }}>
      {/* Layout-X — diagonal cross à la InDesign placeholder frame.
          Vanishes on first keystroke. */}
      {isEmpty && (
        <svg
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
          }}
          preserveAspectRatio="none"
        >
          <line x1="0" y1="0" x2="100%" y2="100%" stroke="#2b1f14" strokeOpacity={0.12} strokeWidth={0.5} />
          <line x1="100%" y1="0" x2="0" y2="100%" stroke="#2b1f14" strokeOpacity={0.12} strokeWidth={0.5} />
        </svg>
      )}

      <textarea
        ref={textareaRef}
        value={value}
        onChange={e => onChange(e.target.value)}
        // Suppress the placeholder while skeleton is showing — they would
        // overlap and read as noise. The skeleton communicates "this is
        // where prose goes."
        placeholder={isEmpty ? '' : placeholder}
        rows={3}
        style={{
          width: '100%',
          minHeight,
          fontFamily: 'EB Garamond, serif',
          fontSize: '0.85rem',
          lineHeight: 1.4,
          textAlign: 'justify',
          color: '#1a0f08',
          background: 'transparent',
          border: '1px solid transparent',
          outline: 'none',
          padding: '4px 6px 18px',
          resize: 'none',
          overflow: 'hidden',
          display: 'block',
        }}
        onFocus={e => { e.currentTarget.style.borderColor = '#2b1f14'; e.currentTarget.style.background = 'rgba(139,90,30,0.06)'; }}
        onBlur={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = 'transparent'; }}
      />

      {/* AI brain emoji — tinted blue via CSS filter. Blue = AI. */}
      <button
        type="button"
        onClick={onBrainClick}
        disabled={drafting}
        title={drafting ? 'Drafting…' : 'Draft body from headline with World AI'}
        aria-label="Draft with World AI"
        style={{
          position: 'absolute',
          bottom: 2,
          left: 4,
          background: 'transparent',
          border: 'none',
          fontSize: '1rem',
          lineHeight: 1,
          cursor: drafting ? 'wait' : 'pointer',
          opacity: drafting ? 0.5 : 0.95,
          padding: 0,
          // Tint the pink brain emoji toward AI_BLUE. Works in most modern
          // browsers; specific rendering varies by OS/font.
          filter: 'hue-rotate(200deg) saturate(1.3)',
        }}
      >
        {drafting ? '…' : '🧠'}
      </button>

      {/* Word-count remaining — lower-right */}
      {remaining != null && (
        <span
          style={{
            position: 'absolute',
            bottom: 2,
            right: 4,
            fontFamily: 'EB Garamond, serif',
            fontSize: '0.88rem',
            fontVariantNumeric: 'tabular-nums',
            color: counterColor,
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          {remaining}
        </span>
      )}

      {/* Ephemeral error */}
      {error && (
        <span
          style={{
            position: 'absolute',
            bottom: 2,
            left: 24,
            fontFamily: 'EB Garamond, serif',
            fontSize: '0.7rem',
            fontStyle: 'italic',
            color: '#8b1a1a',
          }}
        >
          {error}
        </span>
      )}
    </div>
  );
}
