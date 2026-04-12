import { readFile } from 'node:fs/promises';
import path from 'node:path';
import DoPageClient from '@/components/DoPageClient';

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

export const dynamic = 'force-dynamic';

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
      <DoPageClient initial={roadmap} />
    </main>
  );
}
