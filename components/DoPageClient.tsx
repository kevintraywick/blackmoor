'use client';

import { useState, useRef } from 'react';
import { titleForVersion } from '@/lib/roadmap-version-titles';

type Status = 'built' | 'in_progress' | 'planned';

type RoadmapItem = {
  id: number;
  title: string;
  status: Status;
};

export type Roadmap = Record<string, RoadmapItem[]>;

function sortVersions(roadmap: Roadmap): string[] {
  return Object.keys(roadmap).sort((a, b) => {
    const na = parseInt(a.slice(1), 10);
    const nb = parseInt(b.slice(1), 10);
    return na - nb;
  });
}

function Glyph({ status, onClick }: { status: Status; onClick?: () => void }) {
  const base: React.CSSProperties = {
    display: 'inline-block',
    width: 12,
    height: 12,
    borderRadius: '50%',
    marginRight: 10,
    flexShrink: 0,
    cursor: onClick ? 'pointer' : 'default',
    transition: 'transform 0.15s',
  };

  if (status === 'built') {
    return (
      <span
        aria-label="built"
        onClick={onClick}
        style={{
          ...base,
          background: '#c9a84c',
          boxShadow: '0 0 6px rgba(201,168,76,0.5)',
        }}
      />
    );
  }
  if (status === 'in_progress') {
    return (
      <span
        aria-label="in progress"
        className="do-pulse"
        onClick={onClick}
        style={{
          ...base,
          background: 'linear-gradient(90deg, #c9a84c 0 50%, transparent 50% 100%)',
          border: '1px solid #c9a84c',
        }}
      />
    );
  }
  return (
    <span
      aria-label="planned"
      onClick={onClick}
      style={{
        ...base,
        border: '1px solid #8a7d6e',
      }}
    />
  );
}

function ItemRow({
  item,
  index,
  version,
  onRemove,
  onToggle,
}: {
  item: RoadmapItem;
  index: number;
  version: string;
  onRemove: (version: string, text: string, itemId: number) => void;
  onToggle: (version: string, text: string, itemId: number) => void;
}) {
  return (
    <li
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '4px 0',
        fontSize: '0.95rem',
        color: item.status === 'built' ? '#e8ddd0' : '#c8bfb5',
      }}
    >
      <span style={{ width: 24, flexShrink: 0, fontSize: '0.75rem', color: '#e8ddd0', fontFamily: 'var(--font-garamond)' }}>
        {index}.
      </span>
      <Glyph
        status={item.status}
        onClick={() => onToggle(version, item.title, item.id)}
      />
      <span style={{ flex: 1 }}>{item.title}</span>
      {item.status !== 'built' && (
        <button
          onClick={() => onRemove(version, item.title, item.id)}
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
  );
}

function VersionCard({
  version,
  items,
  accent,
  startIndex,
  onRemove,
  onToggle,
}: {
  version: string;
  items: RoadmapItem[];
  accent: string;
  startIndex: number;
  onRemove: (version: string, text: string, itemId: number) => void;
  onToggle: (version: string, text: string, itemId: number) => void;
}) {
  const [showCompleted, setShowCompleted] = useState(false);

  const active: { item: RoadmapItem; origIdx: number }[] = [];
  const completed: { item: RoadmapItem; origIdx: number }[] = [];
  items.forEach((item, i) => {
    const entry = { item, origIdx: i };
    if (item.status === 'built') completed.push(entry);
    else active.push(entry);
  });

  return (
    <div
      style={{
        border: `1px solid ${accent}`,
        borderRadius: 4,
        marginBottom: 16,
        background: '#231f1c',
      }}
    >
      <div style={{ padding: 16, paddingBottom: completed.length > 0 ? 12 : 16 }}>
        <div
          style={{
            fontFamily: 'var(--font-garamond)',
            fontSize: '1.3rem',
            color: accent,
            marginBottom: 10,
            letterSpacing: '0.05em',
          }}
        >
          <span style={{ textTransform: 'lowercase' }}>{version}</span>
          {(() => {
            const n = parseInt(version.slice(1), 10);
            const title = titleForVersion(n);
            return title ? <span style={{ color: '#c8bfb5', fontSize: '1rem', marginLeft: 8 }}>— {title}</span> : null;
          })()}
        </div>
        {active.length > 0 && (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {active.map(({ item, origIdx }) => (
              <ItemRow key={item.id} item={item} index={startIndex + origIdx} version={version} onRemove={onRemove} onToggle={onToggle} />
            ))}
          </ul>
        )}
        {active.length === 0 && completed.length > 0 && (
          <div style={{ color: '#5a4f46', fontStyle: 'italic', fontSize: '0.85rem', fontFamily: 'var(--font-garamond)' }}>
            All done.
          </div>
        )}
      </div>
      {completed.length > 0 && (
        <div
          style={{
            borderTop: '1px solid #3d3530',
            background: '#1e1b18',
            borderRadius: '0 0 3px 3px',
          }}
        >
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            style={{
              width: '100%',
              background: 'none',
              border: 'none',
              padding: '6px 16px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              color: '#5a4f46',
              fontSize: '0.7rem',
              fontFamily: 'var(--font-garamond)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              transition: 'color 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#c9a84c'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#5a4f46'; }}
          >
            <span>{completed.length} completed</span>
            <span style={{ fontSize: '0.6rem' }}>{showCompleted ? '▲' : '▼'}</span>
          </button>
          {showCompleted && (
            <ul style={{ listStyle: 'none', padding: '0 16px 10px', margin: 0 }}>
              {completed.map(({ item, origIdx }) => (
                <ItemRow key={item.id} item={item} index={startIndex + origIdx} version={version} onRemove={onRemove} onToggle={onToggle} />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function AddInput({
  placeholder,
  onAdd,
}: {
  placeholder: string;
  onAdd: (version: number, text: string) => void;
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
    onAdd(version, text);
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

export default function DoPageClient({ initial }: { initial: Roadmap }) {
  const [roadmap, setRoadmap] = useState<Roadmap>(initial);
  const accent = '#c9a84c';

  const allVersions = sortVersions(roadmap);
  const versions = allVersions.filter(v => (roadmap[v] ?? []).some(item => item.status !== 'built'));
  const cumulativeIndex: Record<string, number> = {};
  let runningIdx = 1;
  for (const v of versions) {
    cumulativeIndex[v] = runningIdx;
    runningIdx += (roadmap[v]?.length ?? 0);
  }
  const firstVersion = versions[0] ?? 'v1';
  const placeholder = `${firstVersion} feature name…`;

  async function handleAdd(version: number, text: string) {
    const res = await fetch('/api/roadmap/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ version, text }),
    });
    if (!res.ok) return;
    const { item } = await res.json();

    const vKey = `v${version}`;
    setRoadmap((prev) => {
      const next = { ...prev };
      const items = next[vKey] ? [...next[vKey]] : [];
      items.push({ id: item.id, title: text, status: 'planned' });
      next[vKey] = items;
      return next;
    });
  }

  async function handleRemove(version: string, _text: string, itemId: number) {
    const res = await fetch('/api/roadmap/remove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: itemId }),
    });
    if (!res.ok) return;

    setRoadmap((prev) => {
      const next = { ...prev };
      const items = (next[version] ?? []).filter((item) => item.id !== itemId);
      if (items.length > 0) {
        next[version] = items;
      } else {
        delete next[version];
      }
      return next;
    });
  }

  async function handleToggle(version: string, _text: string, itemId: number) {
    const res = await fetch('/api/roadmap/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: itemId }),
    });
    if (!res.ok) return;
    const { status: newStatus } = await res.json();

    setRoadmap((prev) => {
      const next = { ...prev };
      const items = (next[version] ?? []).map((item) =>
        item.id === itemId ? { ...item, status: newStatus as Status } : item
      );
      next[version] = items;
      return next;
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
          .do-columns { flex-direction: row !important; gap: 40px !important; align-items: flex-start !important; }
        }
      `}</style>

      <div
        className="do-columns"
        style={{ display: 'flex', flexDirection: 'column', gap: 24 }}
      >
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div
            style={{
              fontFamily: 'var(--font-garamond)',
              fontSize: '1.5rem',
              color: accent,
              marginBottom: 0,
            }}
          >
            Common World
          </div>
          <AddInput placeholder={placeholder} onAdd={handleAdd} />
          {versions.length === 0 ? (
            <div style={{ color: '#5a4f46', fontStyle: 'italic' }}>
              Nothing tagged yet.
            </div>
          ) : (
            versions.map((v) => (
              <VersionCard
                key={v}
                version={v}
                items={roadmap[v]}
                accent={accent}
                startIndex={cumulativeIndex[v]}
                onRemove={handleRemove}
                onToggle={handleToggle}
              />
            ))
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div
            style={{
              fontFamily: 'var(--font-garamond)',
              fontSize: '1.5rem',
              color: accent,
              marginBottom: 0,
            }}
          >
            Delivery
          </div>
          <div style={{ color: '#5a4f46', fontStyle: 'italic', fontSize: '0.9rem' }}>
            Delivery dates will live here.
          </div>
        </div>
      </div>
    </>
  );
}
