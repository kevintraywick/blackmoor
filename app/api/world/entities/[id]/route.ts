import { NextResponse } from 'next/server';
import { ensureSchema } from '@/lib/schema';
import { deleteEntity } from '@/lib/world';

// DELETE /api/world/entities/[id]
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureSchema();
    const { id } = await params;
    await deleteEntity(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/world/entities/[id]', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
