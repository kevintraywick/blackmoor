import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureSchema();
    const { id } = await params;
    await query('DELETE FROM magic_catalog WHERE id = $1', [id]);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error('DELETE /api/magic/catalog/[id]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
