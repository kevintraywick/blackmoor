'use client';

/**
 * Editable headline — styled to match the rendered broadsheet headline so
 * the DM editor reads like the final page. Flat input, focus-only border.
 *
 * Variant maps to the three headline scales used in Layout 1 v1:
 *  - `big`  → section (2), page-width ORC INVASION style
 *  - `article` → sections (6, 7, 11) regular article headlines
 *  - `lead`   → section (3) lead column headline (slightly smaller)
 *  - `opinion` → italic OPINION-style
 */

type Variant = 'big' | 'article' | 'lead' | 'opinion';

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  variant?: Variant;
}

const BASE: React.CSSProperties = {
  width: '100%',
  background: 'transparent',
  border: '1px solid transparent',
  outline: 'none',
  padding: '2px 4px',
  color: '#1a0f08',
  fontFamily: 'EB Garamond, serif',
};

const VARIANTS: Record<Variant, React.CSSProperties> = {
  big: {
    fontFamily: '"Playfair Display", "EB Garamond", serif',
    fontSize: '3.4rem',
    fontWeight: 900,
    lineHeight: 0.95,
    letterSpacing: '0.01em',
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  article: {
    fontWeight: 700,
    fontSize: '1.15rem',
    lineHeight: 1.15,
  },
  lead: {
    fontWeight: 700,
    fontSize: '1.05rem',
    lineHeight: 1.15,
  },
  opinion: {
    fontWeight: 700,
    fontStyle: 'italic',
    fontSize: '1.15rem',
    lineHeight: 1.15,
  },
};

export default function EditableHeadline({ value, onChange, placeholder, variant = 'article' }: Props) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{ ...BASE, ...VARIANTS[variant] }}
      onFocus={e => { e.currentTarget.style.borderColor = '#2b1f14'; e.currentTarget.style.background = 'rgba(139,90,30,0.06)'; }}
      onBlur={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = 'transparent'; }}
    />
  );
}
