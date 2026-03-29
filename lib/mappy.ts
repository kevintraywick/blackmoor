/**
 * Mappy — AI agent that analyzes map images and estimates real-world dimensions.
 * Uses Claude Vision API via the Anthropic SDK (server-side only).
 */

import Anthropic from '@anthropic-ai/sdk';

export interface MappyResult {
  width_meters: number;
  height_meters: number;
  confidence: 'low' | 'medium' | 'high';
  method: 'grid_count' | 'reference_objects' | 'room_estimation';
  notes: string;
}

const MAPPY_PROMPT = `You are analyzing a top-down map image to estimate its real-world physical dimensions.

Use these reference cues to calibrate your estimate:
- Standard interior doors: ~0.9m (3ft) wide
- Hallways/corridors: ~1.5m (5ft) wide
- Small rooms (closets, cells): ~2-3m per side
- Medium rooms (bedrooms, offices): ~4-6m per side
- Large rooms (halls, throne rooms): ~8-15m per side
- Dungeon grid squares (if visible): typically 1.5m (5ft) per square
- Human-sized furniture (tables, beds): ~0.6-2m
- Staircases: ~1m wide, ~3m run per floor

Look for:
1. Grid lines or squares (most reliable — count them)
2. Doors, doorways, archways (strong size anchors)
3. Furniture, stairs, or other recognizable objects
4. Corridor widths relative to rooms
5. Overall room count and layout density

If the image has a visible grid, count squares along width and height and multiply by 1.5m (standard 5ft grid).`;

export async function analyzeMapImage(imageBase64: string, mediaType: string): Promise<MappyResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not set. Mappy requires an Anthropic API key.');
  }

  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 512,
    tools: [{
      name: 'report_map_dimensions',
      description: 'Report the estimated real-world dimensions of the map image',
      input_schema: {
        type: 'object' as const,
        properties: {
          width_meters: { type: 'number', description: 'Estimated width in meters' },
          height_meters: { type: 'number', description: 'Estimated height in meters' },
          confidence: { type: 'string', enum: ['low', 'medium', 'high'], description: 'How confident is this estimate' },
          method: { type: 'string', enum: ['grid_count', 'reference_objects', 'room_estimation'], description: 'Primary method used for estimation' },
          notes: { type: 'string', description: 'Brief explanation of reasoning' },
        },
        required: ['width_meters', 'height_meters', 'confidence', 'method', 'notes'],
      },
    }],
    tool_choice: { type: 'tool', name: 'report_map_dimensions' },
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: mediaType as 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp',
            data: imageBase64,
          },
        },
        { type: 'text', text: MAPPY_PROMPT },
      ],
    }],
  });

  const toolBlock = response.content.find(b => b.type === 'tool_use');
  if (!toolBlock || toolBlock.type !== 'tool_use') {
    throw new Error('Mappy did not return a tool_use response');
  }

  const result = toolBlock.input as MappyResult;

  // Validate ranges
  if (result.width_meters < 1) result.width_meters = 10;
  if (result.height_meters < 1) result.height_meters = 10;
  if (result.width_meters > 500) result.width_meters = 50;
  if (result.height_meters > 500) result.height_meters = 50;

  return result;
}
