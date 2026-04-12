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
    if (ladder !== 'shadow' && ladder !== 'common') {
      return NextResponse.json({ error: 'ladder must be shadow or common' }, { status: 400 });
    }

    const tag = `<!-- ${ladder}-v${version} -->`;
    const newLine = `- [ ] ${text.trim()} ${tag}`;

    const raw = await readFile(ROADMAP_PATH, 'utf8');
    const lines = raw.split('\n');

    let lastTagLineIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(tag)) {
        lastTagLineIdx = i;
      }
    }

    if (lastTagLineIdx >= 0) {
      lines.splice(lastTagLineIdx + 1, 0, newLine);
    } else {
      const sectionHeader = `### ${ladder === 'shadow' ? 'Shadow ' : ''}v${version} — planned`;
      lines.push('', sectionHeader, '', newLine);
    }

    await writeFile(ROADMAP_PATH, lines.join('\n'), 'utf8');
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('POST /api/roadmap/add', err);
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
}
