import { readFile } from 'node:fs/promises';
import path from 'node:path';

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

async function loadRoadmap(): Promise<Roadmap> {
  const filePath = path.join(process.cwd(), 'ROADMAP.md');
  const raw = await readFile(filePath, 'utf8');
  return parseRoadmap(raw);
}

function parseRoadmap(markdown: string): Roadmap {
  const shadow: Ladder = {};
  const common: Ladder = {};
  const lines = markdown.split('\n');

  const itemRe = /^-\s+\[( |x)\]\s+(.+?)\s*$/;
  const tagRe = /<!--\s*(shadow|common)-v(\d+)\s*-->/;
  const inProgressRe = /<!--\s*in-progress\s*-->/;
  const deferredRe = /<!--\s*deferred\s*-->/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(itemRe);
    if (!match) continue;
    const checked = match[1] === 'x';
    const rest = match[2];
    const tag = rest.match(tagRe);
    if (!tag) continue;
    const ladder = tag[1] as 'shadow' | 'common';
    const version = `v${tag[2]}`;
    const isInProgress = inProgressRe.test(rest);
    const isDeferred = deferredRe.test(rest);
    const title = rest
      .replace(tagRe, '')
      .replace(inProgressRe, '')
      .replace(deferredRe, '')
      .trim();

    let status: Status;
    if (isDeferred) status = 'deferred';
    else if (checked) status = 'built';
    else if (isInProgress) status = 'in_progress';
    else status = 'planned';

    const target = ladder === 'shadow' ? shadow : common;
    target[version] ??= [];
    target[version].push({
      id: `${ladder}-${version}-${i}`,
      title,
      status,
    });
  }

  return { shadow, common };
}

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
          background:
            'linear-gradient(90deg, #c9a84c 0 50%, transparent 50% 100%)',
          border: '1px solid #c9a84c',
          marginRight: 10,
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
      }}
    />
  );
}

function VersionCard({
  version,
  items,
  accent,
}: {
  version: string;
  items: RoadmapItem[];
  accent: string;
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
            <span>{item.title}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function LadderColumn({
  title,
  subtitle,
  ladder,
  accent,
}: {
  title: string;
  subtitle: string;
  ladder: Ladder;
  accent: string;
}) {
  const versions = sortVersions(ladder);
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div
        style={{
          fontFamily: 'var(--font-garamond)',
          fontSize: '1.8rem',
          color: accent,
          marginBottom: 4,
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: '0.7rem',
          textTransform: 'uppercase',
          letterSpacing: '0.15em',
          color: '#8a7d6e',
          marginBottom: 20,
        }}
      >
        {subtitle}
      </div>
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
          />
        ))
      )}
    </div>
  );
}

export const metadata = {
  title: 'Roadmap — Shadow of the Wolf · Common World',
};

export default async function DoPage() {
  const roadmap = await loadRoadmap();

  return (
    <main
      style={{
        maxWidth: 1000,
        margin: '0 auto',
        padding: '40px 20px 80px',
        color: '#e8ddd0',
        fontFamily: 'var(--font-garamond)',
      }}
    >
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
        style={{
          fontSize: '0.7rem',
          textTransform: 'uppercase',
          letterSpacing: '0.18em',
          color: '#8a7d6e',
          marginBottom: 6,
        }}
      >
        Roadmap
      </div>
      <h1
        style={{
          fontSize: '2.4rem',
          marginBottom: 8,
          color: '#e8ddd0',
        }}
      >
        What we&apos;re building
      </h1>
      <p
        style={{
          color: '#c8bfb5',
          marginBottom: 40,
          maxWidth: 700,
          lineHeight: 1.6,
        }}
      >
        Two ladders, in parallel. <em>Shadow of the Wolf</em> is the campaign
        site Kevin runs his Wednesday night game on. <em>Common World</em> is
        the shared-canon platform being built on top of it — a place where many
        campaigns can inherit the same vast, morally grey, ancient world.
      </p>

      <div
        className="do-columns"
        style={{ display: 'flex', flexDirection: 'column', gap: 24 }}
      >
        <LadderColumn
          title="Shadow of the Wolf"
          subtitle="the campaign site"
          ladder={roadmap.shadow}
          accent="#6b4f2a"
        />
        <LadderColumn
          title="Common World"
          subtitle="the shared canon"
          ladder={roadmap.common}
          accent="#c9a84c"
        />
      </div>
    </main>
  );
}
