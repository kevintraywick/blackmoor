import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';

// POST /api/sms/optin
// Body: { playerId: string, phone?: string, optin: boolean }
export async function POST(req: Request) {
  try {
    await ensureSchema();
    const body = await req.json();
    const { playerId, phone, optin } = body as { playerId?: string; phone?: string; optin?: boolean };

    if (!playerId || typeof playerId !== 'string') {
      return NextResponse.json({ error: 'playerId required' }, { status: 400 });
    }
    if (typeof optin !== 'boolean') {
      return NextResponse.json({ error: 'optin must be a boolean' }, { status: 400 });
    }
    if (phone !== undefined && typeof phone !== 'string') {
      return NextResponse.json({ error: 'phone must be a string' }, { status: 400 });
    }
    if (phone && !/^\+\d{8,15}$/.test(phone)) {
      return NextResponse.json({ error: 'phone must be E.164 format (+15551234567)' }, { status: 400 });
    }

    if (phone !== undefined) {
      await query(
        `UPDATE player_sheets SET sms_phone = $1, sms_optin = $2 WHERE id = $3`,
        [phone || null, optin, playerId],
      );
    } else {
      await query(
        `UPDATE player_sheets SET sms_optin = $1 WHERE id = $2`,
        [optin, playerId],
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('POST /api/sms/optin', err);
    return NextResponse.json({ error: 'optin failed' }, { status: 500 });
  }
}
