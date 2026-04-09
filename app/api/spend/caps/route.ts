import { NextResponse } from 'next/server';
import { listCaps, updateCap } from '@/lib/spend';
import type { SpendService } from '@/lib/types';

const VALID_SERVICES: SpendService[] = ['elevenlabs', 'anthropic', 'twilio', 'websearch', 'railway', 'openai_embeddings'];

// GET /api/spend/caps — list all caps + pause flags
export async function GET() {
  try {
    return NextResponse.json(await listCaps());
  } catch (err) {
    console.error('GET /api/spend/caps', err);
    return NextResponse.json({ error: 'caps query failed' }, { status: 500 });
  }
}

// PATCH /api/spend/caps — update one service's cap or pause flag
// Body: { service: string, soft_cap_usd?: number, paused?: boolean }
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { service, soft_cap_usd, paused } = body as {
      service?: string;
      soft_cap_usd?: number;
      paused?: boolean;
    };

    if (!service || !VALID_SERVICES.includes(service as SpendService)) {
      return NextResponse.json({ error: 'service must be one of: ' + VALID_SERVICES.join(', ') }, { status: 400 });
    }
    if (soft_cap_usd !== undefined) {
      if (typeof soft_cap_usd !== 'number' || soft_cap_usd < 0 || soft_cap_usd > 1000) {
        return NextResponse.json({ error: 'soft_cap_usd must be a number between 0 and 1000' }, { status: 400 });
      }
    }
    if (paused !== undefined && typeof paused !== 'boolean') {
      return NextResponse.json({ error: 'paused must be a boolean' }, { status: 400 });
    }

    await updateCap(service as SpendService, { soft_cap_usd, paused });
    return NextResponse.json(await listCaps());
  } catch (err) {
    console.error('PATCH /api/spend/caps', err);
    return NextResponse.json({ error: 'caps update failed' }, { status: 500 });
  }
}
