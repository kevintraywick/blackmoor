import { NextResponse } from 'next/server';
import { mtdSpend } from '@/lib/spend';

// GET /api/spend/mtd — month-to-date totals for the budget tracker widget.
export async function GET() {
  try {
    const data = await mtdSpend();
    return NextResponse.json(data);
  } catch (err) {
    console.error('GET /api/spend/mtd', err);
    return NextResponse.json({ error: 'spend query failed' }, { status: 500 });
  }
}
