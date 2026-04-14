import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join, extname } from 'path';

const UPLOAD_DIR = `${process.env.DATA_DIR ?? '/data'}/uploads/raven-post/issue`;

const MIME: Record<string, string> = {
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif':  'image/gif',
};

interface Props {
  params: Promise<{ filename: string }>;
}

export async function GET(_: Request, { params }: Props) {
  const { filename } = await params;

  if (filename.includes('/') || filename.includes('..')) {
    return new NextResponse('Not found', { status: 404 });
  }

  try {
    const buffer = await readFile(join(UPLOAD_DIR, filename));
    const ext = extname(filename).toLowerCase();
    const contentType = MIME[ext] ?? 'application/octet-stream';
    return new NextResponse(buffer, {
      headers: { 'Content-Type': contentType },
    });
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }
}
