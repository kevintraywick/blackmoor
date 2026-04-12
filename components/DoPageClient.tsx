'use client';

import { useState, useRef } from 'react';

type Status = 'built' | 'in_progress' | 'planned' | 'deferred';

type RoadmapItem = {
  id: string;
  title: string;
  status: Status;
};

type Ladder = Record<string, RoadmapItem[]>;

type Roadmap = {
  shadow: Ladder;
  common: Ladder;
};

function sortVersions(ladder: Ladder): string[] {
  return Object.keys(ladder).sort((a, b) => {
    const na = parseInt(a.slice(1), 10);
    const nb = parseInt(b.slice(1), 10);
    return na - nb;
  });
}

function Glyph({ status }: { status: Status }) {
  if (status === 'built') {
    return (
      <span
        aria-label="built"
        style={{
          display: 'inline-block',
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: '#c9a84c',
          boxShadow: '0 0 6px rgba(201,168,76,0.5)',
          marginRight: 10,
          flexShrink: 0,
        }}
      />
    );
  }
  if (status === 'in_progress') {
    return (
      <span
        aria-label="in progress"
        className="do-pulse"
        style={{
          display: 'inline-block',
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: 'linear-gradient(90deg, #c9a84c 0 50%, transparent 50% 100%)',
          border: '1px solid #c9a84c',
          marginRight: 10,
          flexShrink: 0,
        }}
      />
    );
  }
  if (status === 'deferred') {
    return (
      <span
        aria-label="deferred"
        style={{
          display: 'inline-block',
          width: 10,
          height: 10,
          borderRadius: '50%',
          border: '1px solid #5a4f46',
          marginRight: 10,
          flexShrink: 0,
        }}
      />
    );
  }
  return (
    <span
      aria-label="planned"
      style={{
        display: 'inline-block',
        width: 10,
        height: 10,
        borderRadius: '50%',
        border: '1px solid #8a7d6e',
        marginRight: 10,
        flexShrink: 0,
      }}
    />
  );
}

function VersionCard({
  version,
  items,
  accent,
  ladderKey,
  onRemove,
}: {
  version: string;
  items: RoadmapItem[];
  accent: string;
  ladderKey: 'shadow' | 'common';
  onRemove: (ladder: 'shadow' | 'common', version: string, text: string, itemId: string) => void;
}) {
  return (
    <div
      style={{
        border: `1px solid ${accent}`,
        borderRadius: 4,
        padding: 16,
        marginBottom: 16,
        background: '#231f1c',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-garamond)',
          fontSize: '1.3rem',
          color: accent,
          marginBottom: 10,
          textTransform: 'lowercase',
          letterSpacing: '0.05em',
        }}
      >
        {version}
      </div>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {items.map((item) => (
          <li
            key={item.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '4px 0',
              fontSize: '0.95rem',
              color:
                item.status === 'deferred'
                  ? '#5a4f46'
                  : item.status === 'built'
                    ? '#e8ddd0'
                    : '#c8bfb5',
              textDecoration:
                item.status === 'deferred' ? 'line-through' : 'none',
            }}
          >
            <Glyph status={item.status} />
            <span style={{ flex: 1 }}>{item.title}</span>
            {item.status !== 'built' && item.status !== 'deferred' && (
              <button
                onClick={() => onRemove(ladderKey, version, item.title, item.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#5a4f46',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  padding: '2px 6px',
                  marginLeft: 8,
                  borderRadius: 2,
                  flexShrink: 0,
                  transition: 'color 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#c07a8a'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = '#5a4f46'; }}
                title="Remove item"
              >
                ✕
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function AddInput({
  ladderKey,
  placeholder,
  onAdd,
}: {
  ladderKey: 'shadow' | 'common';
  placeholder: string;
  onAdd: (ladder: 'shadow' | 'common', version: number, text: string) => void;
}) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  function handleSubmit() {
    const trimmed = value.trim();
    if (!trimmed) return;
    const match = trimmed.match(/^v(\d+)\s+(.+)/i);
    if (!match) {
      setError('Start with v{N}');
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setError(''), 2000);
      return;
    }
    const version = parseInt(match[1], 10);
    const text = match[2].trim();
    onAdd(ladderKey, version, text);
    setValue('');
    setError('');
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
        placeholder={placeholder}
        style={{
          width: '100%',
          background: '#1e1b18',
          border: '1px solid #3d3530',
          borderRadius: 4,
          padding: '8px 12px',
          color: '#e8ddd0',
          fontFamily: 'var(--font-garamond)',
          fontSize: '0.95rem',
          outline: 'none',
        }}
        onFocus={(e) => { e.currentTarget.style.borderColor = '#c9a84c'; }}
        onBlur={(e) => { e.currentTarget.style.borderColor = '#3d3530'; }}
      />
      {error && (
        <div style={{ color: '#c07a8a', fontSize: '0.75rem', marginTop: 4, fontFamily: 'var(--font-garamond)' }}>
          {error}
        </div>
      )}
    </div>
  );
}

function LadderColumn({
  title,
  ladder,
  accent,
  bg,
  ladderKey,
  onAdd,
  onRemove,
}: {
  title: string;
  ladder: Ladder;
  accent: string;
  bg?: string;
  ladderKey: 'shadow' | 'common';
  onAdd: (ladder: 'shadow' | 'common', version: number, text: string) => void;
  onRemove: (ladder: 'shadow' | 'common', version: string, text: string, itemId: string) => void;
}) {
  const versions = sortVersions(ladder);
  const firstVersion = versions[0] ?? 'v1';
  const placeholder = `${firstVersion} feature name…`;
  return (
    <div style={{ flex: 1, minWidth: 0, background: bg, borderRadius: bg ? 8 : 0, padding: bg ? '20px 20px 4px' : 0 }}>
      <div
        style={{
          fontFamily: 'var(--font-garamond)',
          fontSize: '1.5rem',
          color: accent,
          marginBottom: 12,
        }}
      >
        {title}
      </div>
      <AddInput ladderKey={ladderKey} placeholder={placeholder} onAdd={onAdd} />
      {versions.length === 0 ? (
        <div style={{ color: '#5a4f46', fontStyle: 'italic' }}>
          Nothing tagged yet.
        </div>
      ) : (
        versions.map((v) => (
          <VersionCard
            key={v}
            version={v}
            items={ladder[v]}
            accent={accent}
            ladderKey={ladderKey}
            onRemove={onRemove}
          />
        ))
      )}
    </div>
  );
}

export default function DoPageClient({ initial }: { initial: Roadmap }) {
  const [roadmap, setRoadmap] = useState<Roadmap>(initial);

  async function handleAdd(ladder: 'shadow' | 'common', version: number, text: string) {
    const res = await fetch('/api/roadmap/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ladder, version, text }),
    });
    if (!res.ok) return;

    const vKey = `v${version}`;
    setRoadmap((prev) => {
      const target = { ...prev[ladder] };
      const items = target[vKey] ? [...target[vKey]] : [];
      items.push({
        id: `${ladder}-${vKey}-${Date.now()}`,
        title: text,
        status: 'planned',
      });
      target[vKey] = items;
      return { ...prev, [ladder]: target };
    });
  }

  async function handleRemove(ladder: 'shadow' | 'common', version: string, text: string, itemId: string) {
    const vNum = version.replace('v', '');
    const res = await fetch('/api/roadmap/remove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ladder, version: parseInt(vNum, 10), text }),
    });
    if (!res.ok) return;

    setRoadmap((prev) => {
      const target = { ...prev[ladder] };
      const items = (target[version] ?? []).filter((item) => item.id !== itemId);
      if (items.length > 0) {
        target[version] = items;
      } else {
        delete target[version];
      }
      return { ...prev, [ladder]: target };
    });
  }

  return (
    <>
      <style>{`
        @keyframes do-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        .do-pulse { animation: do-pulse 2s ease-in-out infinite; }
        @media (min-width: 768px) {
          .do-columns { flex-direction: row !important; gap: 40px !important; }
        }
      `}</style>

      <div
        className="do-columns"
        style={{ display: 'flex', flexDirection: 'column', gap: 24 }}
      >
        <LadderColumn
          title="Shadow of the Wolf"
          ladder={roadmap.shadow}
          accent="#6b4f2a"
          ladderKey="shadow"
          onAdd={handleAdd}
          onRemove={handleRemove}
        />
        <LadderColumn
          title="Common World"
          ladder={roadmap.common}
          accent="#c9a84c"
          bg="rgba(74,122,90,0.12)"
          ladderKey="common"
          onAdd={handleAdd}
          onRemove={handleRemove}
        />
      </div>
    </>
  );
}
