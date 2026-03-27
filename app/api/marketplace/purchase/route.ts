import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import type { MarketplaceItem } from '@/lib/types';

// POST /api/marketplace/purchase — buy an item for a player
// Body: { item_id: number, player_id: string }
// Uses a transaction with FOR UPDATE locks to prevent overselling
export async function POST(req: Request) {
  await ensureSchema();

  const { item_id, player_id } = await req.json();
  if (!item_id || !player_id) {
    return NextResponse.json({ error: 'item_id and player_id required' }, { status: 400 });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Lock the item row — prevents two buyers from purchasing the last copy
    const { rows: [item] } = await client.query(
      'SELECT id, title, price, stat_type, stat_value, image_path, marketplace_qty FROM items WHERE id = $1 FOR UPDATE',
      [item_id]
    );
    if (!item) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }
    if (item.marketplace_qty < 1) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Item not available' }, { status: 400 });
    }

    // Lock the player row — prevents concurrent gold modifications
    const { rows: [player] } = await client.query(
      'SELECT gold, items FROM player_sheets WHERE id = $1 FOR UPDATE',
      [player_id]
    );
    if (!player) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    const gold = parseInt(player.gold) || 0;
    if (gold < item.price) {
      await client.query('ROLLBACK');
      return NextResponse.json({ error: 'Not enough gold', gold, price: item.price }, { status: 400 });
    }

    // Build the MarketplaceItem — preserves price, image, and source for future trading/refunds
    const newItem: MarketplaceItem = {
      id: Date.now().toString(36),
      source_item_id: item.id,
      name: item.title,
      price: item.price,
      image_path: item.image_path,
      stat_type: item.stat_type,
      stat_value: item.stat_value,
      purchased_at: new Date().toISOString(),
    };

    const updatedItems = [...(Array.isArray(player.items) ? player.items : []), newItem];
    const newGold = String(gold - item.price);

    // Deduct gold and add item to player's inventory
    await client.query(
      'UPDATE player_sheets SET gold = $1, items = $2 WHERE id = $3',
      [newGold, JSON.stringify(updatedItems), player_id]
    );

    // Decrement marketplace stock
    await client.query(
      'UPDATE items SET marketplace_qty = marketplace_qty - 1 WHERE id = $1',
      [item_id]
    );

    await client.query('COMMIT');
    return NextResponse.json({ ok: true, gold: newGold, item: newItem });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('POST /api/marketplace/purchase', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  } finally {
    client.release();
  }
}
