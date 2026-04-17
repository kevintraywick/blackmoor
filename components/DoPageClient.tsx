'use client';

import { useState, useRef } from 'react';

type Status = 'built' | 'in_progress' | 'planned';

type RoadmapItem = {
  id: number;
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
  ladderKey,
  version,
  onRemove,
  onToggle,
}: {
  item: RoadmapItem;
  index: number;
  ladderKey: 'shadow' | 'common';
  version: string;
  onRemove: (ladder: 'shadow' | 'common', version: string, text: string, itemId: number) => void;
  onToggle: (ladder: 'shadow' | 'common', version: string, text: string, itemId: number) => void;
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
        onClick={() => onToggle(ladderKey, version, item.title, item.id)}
      />
      <span style={{ flex: 1 }}>{item.title}</span>
      {item.status !== 'built' && (
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
  );
}

function VersionCard({
  version,
  items,
  accent,
  ladderKey,
  startIndex,
  onRemove,
  onToggle,
}: {
  version: string;
  items: RoadmapItem[];
  accent: string;
  ladderKey: 'shadow' | 'common';
  startIndex: number;
  onRemove: (ladder: 'shadow' | 'common', version: string, text: string, itemId: number) => void;
  onToggle: (ladder: 'shadow' | 'common', version: string, text: string, itemId: number) => void;
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
            textTransform: 'lowercase',
            letterSpacing: '0.05em',
          }}
        >
          {version}
        </div>
        {active.length > 0 && (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {active.map(({ item, origIdx }) => (
              <ItemRow key={item.id} item={item} index={startIndex + origIdx} ladderKey={ladderKey} version={version} onRemove={onRemove} onToggle={onToggle} />
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
                <ItemRow key={item.id} item={item} index={startIndex + origIdx} ladderKey={ladderKey} version={version} onRemove={onRemove} onToggle={onToggle} />
              ))}
            </ul>
          )}
        </div>
      )}
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
  onToggle,
}: {
  title: string;
  ladder: Ladder;
  accent: string;
  bg?: string;
  ladderKey: 'shadow' | 'common';
  onAdd: (ladder: 'shadow' | 'common', version: number, text: string) => void;
  onRemove: (ladder: 'shadow' | 'common', version: string, text: string, itemId: number) => void;
  onToggle: (ladder: 'shadow' | 'common', version: string, text: string, itemId: number) => void;
}) {
  const allVersions = sortVersions(ladder);
  const versions = allVersions.filter(v => (ladder[v] ?? []).some(item => item.status !== 'built'));
  const cumulativeIndex: Record<string, number> = {};
  let runningIdx = 1;
  for (const v of versions) {
    cumulativeIndex[v] = runningIdx;
    runningIdx += (ladder[v]?.length ?? 0);
  }
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
        versions.map((v) => {
          const idx = cumulativeIndex[v];
          return (
            <VersionCard
              key={v}
              version={v}
              items={ladder[v]}
              accent={accent}
              ladderKey={ladderKey}
              startIndex={idx}
              onRemove={onRemove}
              onToggle={onToggle}
            />
          );
        })
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
    const { item } = await res.json();

    const vKey = `v${version}`;
    setRoadmap((prev) => {
      const target = { ...prev[ladder] };
      const items = target[vKey] ? [...target[vKey]] : [];
      items.push({ id: item.id, title: text, status: 'planned' });
      target[vKey] = items;
      return { ...prev, [ladder]: target };
    });
  }

  async function handleRemove(_ladder: 'shadow' | 'common', version: string, _text: string, itemId: number) {
    const res = await fetch('/api/roadmap/remove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: itemId }),
    });
    if (!res.ok) return;

    setRoadmap((prev) => {
      const ladder = _ladder;
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

  async function handleToggle(_ladder: 'shadow' | 'common', version: string, _text: string, itemId: number) {
    const res = await fetch('/api/roadmap/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: itemId }),
    });
    if (!res.ok) return;
    const { status: newStatus } = await res.json();

    setRoadmap((prev) => {
      const ladder = _ladder;
      const target = { ...prev[ladder] };
      const items = (target[version] ?? []).map((item) =>
        item.id === itemId ? { ...item, status: newStatus as Status } : item
      );
      target[version] = items;
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
          onToggle={handleToggle}
        />
        <LadderColumn
          title="Common World"
          ladder={roadmap.common}
          accent="#c9a84c"
          bg="rgba(74,122,90,0.12)"
          ladderKey="common"
          onAdd={handleAdd}
          onRemove={handleRemove}
          onToggle={handleToggle}
        />
      </div>
    </>
  );
}
