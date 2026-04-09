import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';

const UPLOAD_DIR = `${process.env.DATA_DIR ?? '/data'}/uploads/raven-post/newsie`;

interface Props {
  params: Promise<{ filename: string }>;
}

// GET /api/uploads/raven-post/newsie/:filename — serve cached MP3
export async function GET(_req: Request, { params }: Props) {
  const { filename } = await params;

  // Path traversal guard
  if (filename.includes('/') || filename.includes('..') || !filename.endsWith('.mp3')) {
    return new NextResponse('Not found', { status: 404 });
  }

  try {
    const buffer = await readFile(join(UPLOAD_DIR, filename));
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'content-type': 'audio/mpeg',
        'cache-control': 'public, max-age=86400',
      },
    });
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }
}
