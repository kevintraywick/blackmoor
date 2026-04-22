import { readFile } from 'fs/promises';
import { join } from 'path';

export async function GET() {
  const html = await readFile(
    join(process.cwd(), 'public/editions/index.html'),
    'utf8',
  );
  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
