import { NextResponse } from 'next/server';
import { analyzeMapImage } from '@/lib/mappy';

// POST /api/map-builder/[id]/mappy — analyze an uploaded image with Mappy (Claude Vision)
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { base64, media_type } = body;

    if (!base64 || !media_type) {
      return NextResponse.json({ error: 'base64 and media_type required' }, { status: 400 });
    }

    const result = await analyzeMapImage(base64, media_type);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Mappy analysis failed';
    console.error('POST /api/map-builder/[id]/mappy', err);

    // Return a graceful degradation response
    if (message.includes('ANTHROPIC_API_KEY')) {
      return NextResponse.json({
        error: message,
        fallback: true,
        width_meters: 30,
        height_meters: 30,
        confidence: 'low',
        method: 'room_estimation',
        notes: 'API key not configured — using default estimate. Adjust manually.',
      }, { status: 200 });
    }

    return NextResponse.json({
      error: message,
      fallback: true,
      width_meters: 30,
      height_meters: 30,
      confidence: 'low',
      method: 'room_estimation',
      notes: 'Analysis failed — using default estimate. Adjust manually.',
    }, { status: 200 });
  }
}
