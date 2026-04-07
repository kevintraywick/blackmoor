import { NextResponse } from 'next/server';
import { analyzeMapGrid, type MappyGridResult } from '@/lib/mappy';

// POST /api/map-builder/[id]/mappy — analyze an uploaded image with Mappy (Claude Vision)
// for grid type, cell size, and scale.
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { base64, media_type } = body;

    if (!base64 || !media_type) {
      return NextResponse.json({ error: 'base64 and media_type required' }, { status: 400 });
    }

    const result = await analyzeMapGrid(base64, media_type);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Mappy analysis failed';
    console.error('POST /api/map-builder/[id]/mappy', err);

    // Graceful degradation — return a "no grid detected" fallback so the UI
    // can drop into the manual calibration tool without crashing.
    const fallback: MappyGridResult & { fallback: true; error?: string } = {
      fallback: true,
      error: message,
      grid_type: 'none',
      hex_orientation: null,
      cell_size_px: null,
      scale_guess: 'combat',
      confidence: 'low',
      notes: message.includes('ANTHROPIC_API_KEY')
        ? 'API key not configured — calibrate manually.'
        : 'Analysis failed — calibrate manually.',
    };
    return NextResponse.json(fallback, { status: 200 });
  }
}
