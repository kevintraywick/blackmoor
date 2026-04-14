'use client';

import { pickRandomQotd } from '@/lib/qotd';

/**
 * Editor-aware Quote of the Day block. Same visual as the player view but
 * adds a small recycle (♻) button that cycles to a new quote from the
 * curated local list in `lib/qotd.ts`. The current quote is still editable
 * inline — the recycle button just gives the DM a fast way to shuffle.
 *
 * Pinned to the column bottom via `marginTop: auto` (matching Spot Prices).
 */

interface Props {
  text: string;
  author: string;
  onChange: (q: { text: string; author: string }) => void;
}

export default function QotdEditor({ text, author, onChange }: Props) {
  function onRecycle() {
    const next = pickRandomQotd(text);
    onChange({ text: next.text, author: next.author });
  }

  return (
    <aside
      style={{
        position: 'relative',
        border: '1px solid #2b1f14',
        padding: '8px 10px',
        textAlign: 'center',
        background: 'rgba(139,90,30,0.05)',
        marginTop: 'auto',
      }}
    >
      <div
        style={{
          fontFamily: 'EB Garamond, serif',
          fontSize: '0.65rem',
          textTransform: 'uppercase',
          letterSpacing: '0.2em',
          fontWeight: 700,
          color: '#2b1f14',
          marginBottom: 4,
        }}
      >
        Quote of the Day
      </div>

      <input
        value={text}
        onChange={e => onChange({ text: e.target.value, author })}
        placeholder="Quote…"
        style={{
          width: '100%',
          textAlign: 'center',
          fontFamily: 'EB Garamond, serif',
          fontStyle: 'italic',
          fontSize: '0.82rem',
          lineHeight: 1.35,
          color: '#2b1f14',
          background: 'transparent',
          border: '1px solid transparent',
          outline: 'none',
          padding: '2px 4px',
        }}
        onFocus={e => { e.currentTarget.style.borderColor = '#2b1f14'; }}
        onBlur={e => { e.currentTarget.style.borderColor = 'transparent'; }}
      />

      <input
        value={author}
        onChange={e => onChange({ text, author: e.target.value })}
        placeholder="Author"
        style={{
          width: '100%',
          textAlign: 'center',
          fontFamily: 'EB Garamond, serif',
          fontSize: '0.68rem',
          marginTop: 4,
          letterSpacing: '0.05em',
          color: '#4a3723',
          background: 'transparent',
          border: '1px solid transparent',
          outline: 'none',
          padding: '2px 4px',
        }}
        onFocus={e => { e.currentTarget.style.borderColor = '#2b1f14'; }}
        onBlur={e => { e.currentTarget.style.borderColor = 'transparent'; }}
      />

      <button
        type="button"
        onClick={onRecycle}
        title="Shuffle quote"
        style={{
          position: 'absolute',
          top: 4,
          right: 4,
          background: 'transparent',
          border: 'none',
          fontSize: '0.9rem',
          cursor: 'pointer',
          opacity: 0.7,
          padding: 0,
          lineHeight: 1,
        }}
      >
        ♻
      </button>
    </aside>
  );
}
