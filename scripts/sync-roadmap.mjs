/**
 * Regenerate ROADMAP.md from the roadmap_items table.
 * Ground truth is the DB; the file is a snapshot committed to git.
 *
 * Usage:  node scripts/sync-roadmap.mjs
 * Requires DATABASE_URL env var (reads from .env.local if present).
 */

import pg from 'pg';
import { readFile, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROADMAP_PATH = join(__dirname, '..', 'ROADMAP.md');

for (const envFile of ['.env.local', '.env']) {
  try {
    const envPath = resolve(__dirname, '..', envFile);
    const content = readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.+?)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch { /* file doesn't exist, that's fine */ }
}

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL not found in environment or .env.local');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('railway') ? { rejectUnauthorized: false } : false,
});

const { rows: items } = await pool.query(
  'SELECT ladder, version, title, status, sort_order FROM roadmap_items ORDER BY ladder, version, sort_order',
);

const raw = await readFile(ROADMAP_PATH, 'utf8').catch(() => '');
const lines = raw.split('\n');

const itemRe = /^-\s+\[[ x]\]\s+.+?<!--\s*(shadow|common)-v\d+\s*-->/;
const filtered = lines.filter(line => !itemRe.test(line));

const byLadderVersion = new Map();
for (const item of items) {
  const key = `${item.ladder}-v${item.version}`;
  const arr = byLadderVersion.get(key) ?? [];
  arr.push(item);
  byLadderVersion.set(key, arr);
}

const result = [];
for (const line of filtered) {
  result.push(line);
  const sectionMatch = line.match(/^###\s+.*?(shadow|common).*?v(\d+)/i) ??
                        line.match(/^###\s+v(\d+)/i);
  if (!sectionMatch) continue;

  let ladder;
  let version;
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

const next = result
  .join('\n')
  .replace(/\n{3,}/g, '\n\n')
  .replace(/\n+$/, '\n');
await writeFile(ROADMAP_PATH, next, 'utf8');
await pool.end();

console.log(`wrote ${items.length} items to ROADMAP.md`);
