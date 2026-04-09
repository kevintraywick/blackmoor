import { NextResponse } from 'next/server';
import { recentLedger } from '@/lib/spend';
import type { SpendService } from '@/lib/types';

const VALID_SERVICES: SpendService[] = ['elevenlabs', 'anthropic', 'twilio', 'websearch', 'railway', 'openai_embeddings'];

// GET /api/spend/ledger?service=&from=&limit=
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const service = url.searchParams.get('service');
    const from = url.searchParams.get('from');
    const limitStr = url.searchParams.get('limit');

    if (service && !VALID_SERVICES.includes(service as SpendService)) {
      return NextResponse.json({ error: 'invalid service' }, { status: 400 });
    }

    const limit = limitStr ? Math.max(1, Math.min(500, parseInt(limitStr, 10) || 100)) : 100;

    const rows = await recentLedger({
      service: (service as SpendService) || undefined,
      from: from || undefined,
      limit,
    });

    return NextResponse.json(rows);
  } catch (err) {
    console.error('GET /api/spend/ledger', err);
    return NextResponse.json({ error: 'ledger query failed' }, { status: 500 });
  }
}
