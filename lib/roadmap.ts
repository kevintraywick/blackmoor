import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { query } from './db';
import { ensureSchema } from './schema';

export type RoadmapStatus = 'built' | 'in_progress' | 'planned';

export interface RoadmapRow {
  id: number;
  ladder: 'shadow' | 'common';
  version: number;
  title: string;
  status: RoadmapStatus;
  sort_order: number;
}

const ROADMAP_PATH = path.join(process.cwd(), 'ROADMAP.md');

export async function seedFromMarkdownIfEmpty(): Promise<void> {
  await ensureSchema();
  const existing = await query<{ count: string }>('SELECT count(*)::text AS count FROM roadmap_items');
  if (parseInt(existing[0].count, 10) > 0) return;

  const raw = await readFile(ROADMAP_PATH, 'utf8');
  const items = parseMarkdownItems(raw);
  if (items.length === 0) return;

  const values: string[] = [];
  const params: unknown[] = [];
  let pi = 1;
  for (const item of items) {
    values.push(`($${pi}, $${pi + 1}, $${pi + 2}, $${pi + 3}, $${pi + 4})`);
    params.push(item.ladder, item.version, item.title, item.status, item.sort_order);
    pi += 5;
  }
  await query(
    `INSERT INTO roadmap_items (ladder, version, title, status, sort_order) VALUES ${values.join(', ')}`,
    params,
  );
}

function parseMarkdownItems(markdown: string): Omit<RoadmapRow, 'id'>[] {
  const items: Omit<RoadmapRow, 'id'>[] = [];
  const lines = markdown.split('\n');
  const itemRe = /^-\s+\[( |x)\]\s+(.+?)\s*$/;
  const tagRe = /<!--\s*(shadow|common)-v(\d+)\s*-->/;
  const inProgressRe = /<!--\s*in-progress\s*-->/;
  let sortOrder = 0;

  for (const line of lines) {
    const match = line.match(itemRe);
    if (!match) continue;
    const checked = match[1] === 'x';
    const rest = match[2];
    const tag = rest.match(tagRe);
    if (!tag) continue;
    const ladder = tag[1] as 'shadow' | 'common';
    const version = parseInt(tag[2], 10);
    const isInProgress = inProgressRe.test(rest);
    const title = rest
      .replace(tagRe, '')
      .replace(inProgressRe, '')
      .replace(/<!--[^>]*-->/g, '')
      .trim();

    let status: RoadmapStatus;
    if (checked) status = 'built';
    else if (isInProgress) status = 'in_progress';
    else status = 'planned';

    items.push({ ladder, version, title, status, sort_order: sortOrder++ });
  }
  return items;
}

export async function getAllItems(): Promise<RoadmapRow[]> {
  await seedFromMarkdownIfEmpty();
  return query<RoadmapRow>('SELECT * FROM roadmap_items ORDER BY ladder, version, sort_order');
}

export async function addItem(ladder: 'shadow' | 'common', version: number, title: string): Promise<RoadmapRow> {
  await ensureSchema();
  const maxSort = await query<{ max_sort: number | null }>(
    'SELECT MAX(sort_order) AS max_sort FROM roadmap_items WHERE ladder = $1 AND version = $2',
    [ladder, version],
  );
  const nextSort = (maxSort[0]?.max_sort ?? -1) + 1;
  const rows = await query<RoadmapRow>(
    `INSERT INTO roadmap_items (ladder, version, title, status, sort_order)
     VALUES ($1, $2, $3, 'planned', $4) RETURNING *`,
    [ladder, version, title, nextSort],
  );
  return rows[0];
}

export async function removeItem(id: number): Promise<boolean> {
  await ensureSchema();
  const rows = await query<{ id: number }>('DELETE FROM roadmap_items WHERE id = $1 RETURNING id', [id]);
  return rows.length > 0;
}

export async function toggleItem(id: number): Promise<RoadmapStatus> {
  await ensureSchema();
  const rows = await query<RoadmapRow>('SELECT * FROM roadmap_items WHERE id = $1', [id]);
  if (rows.length === 0) throw new Error('Item not found');
  const current = rows[0].status;
  const next: RoadmapStatus = current === 'built' ? 'planned' : 'built';
  await query('UPDATE roadmap_items SET status = $1 WHERE id = $2', [next, id]);
  return next;
}

export async function exportToMarkdown(): Promise<string> {
  const items = await getAllItems();
  const raw = await readFile(ROADMAP_PATH, 'utf8').catch(() => '');
  const lines = raw.split('\n');

  const itemRe = /^-\s+\[[ x]\]\s+.+?<!--\s*(shadow|common)-v\d+\s*-->/;
  const filtered = lines.filter(line => !itemRe.test(line));

  const byLadderVersion = new Map<string, RoadmapRow[]>();
  for (const item of items) {
    const key = `${item.ladder}-v${item.version}`;
    const arr = byLadderVersion.get(key) ?? [];
    arr.push(item);
    byLadderVersion.set(key, arr);
  }

  const result: string[] = [];
  for (const line of filtered) {
    result.push(line);
    const sectionMatch = line.match(/^###\s+.*?(shadow|common).*?v(\d+)/i) ??
                          line.match(/^###\s+v(\d+)/i);
    if (!sectionMatch) continue;

    let ladder: string;
    let version: string;
    if (sectionMatch[2]) {
      ladder = sectionMatch[1].toLowerCase();
      version = sectionMatch[2];
    } else {
      version = sectionMatch[1];
      ladder = 'common';
    }
    const key = `${ladder}-v${version}`;
    const sectionItems = byLadderVersion.get(key);
    if (!sectionItems) continue;

    const nextLineIdx = filtered.indexOf(line) + 1;
    if (nextLineIdx < filtered.length && filtered[nextLineIdx] === '') {
      result.push('');
    }

    for (const item of sectionItems) {
      const check = item.status === 'built' ? '[x]' : '[ ]';
      const tag = `<!-- ${item.ladder}-v${item.version} -->`;
      const extra = item.status === 'in_progress' ? ' <!-- in-progress -->' : '';
      result.push(`- ${check} ${item.title} ${tag}${extra}`);
    }
    byLadderVersion.delete(key);
  }

  return result
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\n+$/, '\n');
}

export async function syncMarkdownFile(): Promise<void> {
  const content = await exportToMarkdown();
  await writeFile(ROADMAP_PATH, content, 'utf8');
}
