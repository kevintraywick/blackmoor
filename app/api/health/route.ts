import { query } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    await query('SELECT 1');
    return NextResponse.json({ status: 'ok', db: 'connected' });
  } catch (err) {
    return NextResponse.json(
      { status: 'error', db: 'disconnected', error: String(err) },
      { status: 500 }
    );
  }
}
