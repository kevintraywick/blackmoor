import { NextResponse } from 'next/server';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROADMAP_PATH = path.join(process.cwd(), 'ROADMAP.md');

export async function POST(req: Request) {
  try {
    const { ladder, version, text } = await req.json();
    if (!ladder || !version || !text) {
      return NextResponse.json({ error: 'ladder, version, and text required' }, { status: 400 });
    }

    const tag = `<!-- ${ladder}-v${version} -->`;
    const raw = await readFile(ROADMAP_PATH, 'utf8');
    const lines = raw.split('\n');

    const idx = lines.findIndex(
      (line) => line.includes(tag) && line.includes(text.trim()),
    );

    if (idx === -1) {
      return NextResponse.json({ error: 'item not found' }, { status: 404 });
    }

    lines.splice(idx, 1);
    await writeFile(ROADMAP_PATH, lines.join('\n'), 'utf8');
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('POST /api/roadmap/remove', err);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
