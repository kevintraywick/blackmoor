import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import { broadcast } from '@/lib/events';
import type { MapRow } from '@/lib/types';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await ensureSchema();
    const { id } = await params;
    const { tiles, revealed } = await req.json() as {
      tiles: [number, number][];
      revealed: boolean;
    };

    if (!Array.isArray(tiles) || typeof revealed !== 'boolean') {
      return NextResponse.json({ error: 'tiles (array) and revealed (boolean) required' }, { status: 400 });
    }

    // Read-modify-write: load current, apply set/clear, write back
    const [map] = await query<MapRow>('SELECT revealed_tiles FROM maps WHERE id = $1', [id]);
    if (!map) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const current: [number, number][] = map.revealed_tiles ?? [];

    let updated: [number, number][];
    if (revealed) {
      // Union: add tiles not already present
      const existing = new Set(current.map(([c, r]) => `${c},${r}`));
      const toAdd = tiles.filter(([c, r]) => !existing.has(`${c},${r}`));
      updated = [...current, ...toAdd];
    } else {
      // Remove matching tiles
      const toRemove = new Set(tiles.map(([c, r]) => `${c},${r}`));
      updated = current.filter(([c, r]) => !toRemove.has(`${c},${r}`));
    }

    await query(
      'UPDATE maps SET revealed_tiles = $1 WHERE id = $2',
      [JSON.stringify(updated), id]
    );

    broadcast('maps', id, 'patch');
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('PATCH /api/maps/[id]/reveal', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
