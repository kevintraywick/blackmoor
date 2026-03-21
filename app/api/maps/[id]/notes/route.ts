import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import type { MapRow, DmNote } from '@/lib/types';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureSchema();
    const { id } = await params;
    const { col, row, text } = await req.json() as { col: number; row: number; text: string };

    if (typeof col !== 'number' || typeof row !== 'number' || typeof text !== 'string') {
      return NextResponse.json({ error: 'col, row, text required' }, { status: 400 });
    }

    const [map] = await query<MapRow>('SELECT dm_notes FROM maps WHERE id = $1', [id]);
    if (!map) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const notes: DmNote[] = map.dm_notes ?? [];
    let updated: DmNote[];

    if (text === '') {
      // Delete note for this tile
      updated = notes.filter(n => !(n.col === col && n.row === row));
    } else {
      // Upsert
      const existing = notes.findIndex(n => n.col === col && n.row === row);
      if (existing >= 0) {
        updated = notes.map((n, i) => i === existing ? { col, row, text } : n);
      } else {
        updated = [...notes, { col, row, text }];
      }
    }

    await query(
      'UPDATE maps SET dm_notes = $1 WHERE id = $2',
      [JSON.stringify(updated), id]
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('PATCH /api/maps/[id]/notes', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
