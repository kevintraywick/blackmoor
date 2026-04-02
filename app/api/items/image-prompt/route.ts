import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'AI unavailable' }, { status: 503 });
  }

  try {
    const { name, item_type, description } = await request.json();

    if (!name || !description) {
      return NextResponse.json({ error: 'name and description required' }, { status: 400 });
    }

    const client = new Anthropic({ apiKey });

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      system: `You convert D&D item descriptions into Midjourney image prompts. Output ONLY the prompt text, nothing else. The prompt should:
- Describe the item as a single isolated object on a plain background
- Use vivid fantasy art language (oil painting style, dramatic lighting, detailed textures)
- Include style keywords: fantasy RPG item, detailed illustration, dramatic lighting
- End with: --v 7 --ar 1:1 --style raw
- Keep it under 100 words before the parameters
- No quotes, no explanation, just the prompt`,
      messages: [
        {
          role: 'user',
          content: `Item: "${name}" (${item_type || 'magic item'})\nDescription: ${description}`,
        },
      ],
    });

    const prompt = message.content[0]?.type === 'text' ? message.content[0].text.trim() : '';
    return NextResponse.json({ prompt });
  } catch (err) {
    console.error('POST /api/items/image-prompt', err);
    return NextResponse.json({ error: 'Failed to generate prompt' }, { status: 500 });
  }
}
