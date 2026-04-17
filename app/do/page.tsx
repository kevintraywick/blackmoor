import DoPageClient from '@/components/DoPageClient';
import type { Roadmap } from '@/components/DoPageClient';
import { getAllItems } from '@/lib/roadmap';
import type { RoadmapRow } from '@/lib/roadmap';

function rowsToRoadmap(rows: RoadmapRow[]): Roadmap {
  const out: Roadmap = {};
  for (const row of rows) {
    const vKey = `v${row.version}`;
    out[vKey] ??= [];
    out[vKey].push({ id: row.id, title: row.title, status: row.status });
  }
  return out;
}

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Roadmap — Common World',
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
