import DoPageClient from '@/components/DoPageClient';
import { getAllItems } from '@/lib/roadmap';
import type { RoadmapRow } from '@/lib/roadmap';

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

function rowsToRoadmap(rows: RoadmapRow[]): Roadmap {
  const shadow: Ladder = {};
  const common: Ladder = {};
  for (const row of rows) {
    const target = row.ladder === 'shadow' ? shadow : common;
    const vKey = `v${row.version}`;
    target[vKey] ??= [];
    target[vKey].push({ id: row.id, title: row.title, status: row.status });
  }
  return { shadow, common };
}

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Roadmap — Shadow of the Wolf · Common World',
};

export default async function DoPage() {
  const rows = await getAllItems();
  const roadmap = rowsToRoadmap(rows);

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
