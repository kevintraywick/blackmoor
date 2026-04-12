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

    const line = lines[idx];
    let newStatus: string;

    if (/^- \[x\]/.test(line)) {
      // Built → planned (uncheck)
      lines[idx] = line.replace('- [x]', '- [ ]');
      newStatus = 'planned';
    } else if (/^- \[ \]/.test(line)) {
      // Planned/in_progress → built (check), also remove in-progress tag
      lines[idx] = line
        .replace('- [ ]', '- [x]')
        .replace(/\s*<!--\s*in-progress\s*-->/g, '');
      newStatus = 'built';
    } else {
      return NextResponse.json({ error: 'unrecognized format' }, { status: 400 });
    }

    await writeFile(ROADMAP_PATH, lines.join('\n'), 'utf8');
    return NextResponse.json({ ok: true, status: newStatus });
  } catch (err) {
    console.error('POST /api/roadmap/toggle', err);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
