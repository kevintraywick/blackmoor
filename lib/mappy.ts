/**
 * Mappy — AI agent that analyzes uploaded map images and detects grid metadata.
 *
 * Returns: grid type (square / hex / none), hex orientation, pixels per cell on
 * the source image, and a tactical-vs-overland scale guess. Used by the map
 * builder upload flow to pre-fill the grid confirmation panel.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { GridDetectType, ScaleMode } from './types';

export type HexOrient = 'flat' | 'pointy';
export type Confidence = 'low' | 'medium' | 'high';

export interface MappyGridResult {
  grid_type: GridDetectType;
  hex_orientation: HexOrient | null;
  cell_size_px: number | null;
  scale_guess: ScaleMode;
  confidence: Confidence;
  notes: string;
}

const MAPPY_PROMPT = `You are analyzing a top-down map image to detect its grid system and real-world scale.

## Step 1: Grid type
Look at the image and decide which grid (if any) is overlaid on it:

- **square**: regular orthogonal grid of squares. Look for evenly spaced horizontal and vertical lines forming squares of consistent size.
- **hex**: regular hexagonal grid. Look for the characteristic 6-sided cells. Note whether hexes are flat-top (two horizontal edges, two vertices on the sides) or pointy-top (two vertical edges, two vertices top and bottom).
- **none**: no visible regular grid (hand-drawn maps, AI art, photographs without overlays).

## Step 2: Cell pixel size
If a grid is present, measure how many image pixels span one full cell at the image's natural resolution.
- For square grids: the side length of one square in pixels.
- For flat-top hex grids: the width of one hex (flat side to flat side, the longer axis).
- For pointy-top hex grids: the width of one hex (vertex to opposite vertex, the longer axis).
Round to the nearest integer. Return null if no grid is visible.

## Step 3: Scale guess (tactical vs overland)
Decide whether this map is meant for:
- **combat**: a tactical battle map. Visual cues: visible doors/furniture, room-scale features, dungeon layouts, single buildings. D&D combat is 5 ft per cell.
- **overland**: a wilderness/region/world map. Visual cues: terrain features (forests, mountains, rivers), settlements as small icons, no individual rooms, named regions. D&D overland hexes are typically 6 miles per hex.

If the grid is hex, lean strongly toward "overland" unless small-scale combat features are clearly present.
If the grid is square, lean strongly toward "combat" — square overland maps are rare.

## Step 4: Confidence
- **high**: clear grid lines, easy to count, obvious scale signals.
- **medium**: grid is detectable but partially obscured or at an unusual angle.
- **low**: had to guess one or more values; worth flagging to the DM.

Be honest about confidence — the DM will see your guess and override anything that looks wrong.`;

export async function analyzeMapGrid(imageBase64: string, mediaType: string): Promise<MappyGridResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not set. Mappy requires an Anthropic API key.');
  }

  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 512,
    tools: [{
      name: 'report_grid',
      description: 'Report the detected grid metadata for a map image.',
      input_schema: {
        type: 'object' as const,
        properties: {
          grid_type: {
            type: 'string',
            enum: ['square', 'hex', 'none'],
            description: 'Detected grid type',
          },
          hex_orientation: {
            type: ['string', 'null'],
            enum: ['flat', 'pointy', null],
            description: 'Only set when grid_type is "hex"; otherwise null',
          },
          cell_size_px: {
            type: ['number', 'null'],
            description: 'Pixels per cell at the image\'s natural resolution. Null if no grid detected.',
          },
          scale_guess: {
            type: 'string',
            enum: ['combat', 'overland'],
            description: 'Whether this looks like a tactical combat map or a wilderness/overland map',
          },
          confidence: {
            type: 'string',
            enum: ['low', 'medium', 'high'],
            description: 'How confident the analysis is overall',
          },
          notes: {
            type: 'string',
            description: 'One short sentence explaining the reasoning',
          },
        },
        required: ['grid_type', 'hex_orientation', 'cell_size_px', 'scale_guess', 'confidence', 'notes'],
      },
    }],
    tool_choice: { type: 'tool', name: 'report_grid' },
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

  const result = toolBlock.input as MappyGridResult;

  // Sanity-clamp cell size — anything wildly outside plausible bounds is wrong.
  if (result.cell_size_px != null) {
    if (result.cell_size_px < 4 || result.cell_size_px > 1000) {
      result.cell_size_px = null;
    } else {
      result.cell_size_px = Math.round(result.cell_size_px);
    }
  }

  // Hex orientation only meaningful when grid_type === 'hex'
  if (result.grid_type !== 'hex') {
    result.hex_orientation = null;
  }

  return result;
}
