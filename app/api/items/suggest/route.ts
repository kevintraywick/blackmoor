import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const ALLOWED_TYPES = ['magic_item', 'scroll', 'spell'] as const;
type ItemType = (typeof ALLOWED_TYPES)[number];

const FIELD_SCHEMAS: Record<ItemType, string> = {
  magic_item: '{ "description": string, "attack": number, "damage": number, "heal": number, "rarity": "Common"|"Uncommon"|"Rare"|"Very Rare"|"Legendary", "attunement": boolean, "price": number }',
  scroll: '{ "description": string, "level": number (0=cantrip), "school": "Abjuration"|"Conjuration"|"Divination"|"Enchantment"|"Evocation"|"Illusion"|"Necromancy"|"Transmutation", "price": number }',
  spell: '{ "description": string, "level": number (0=cantrip), "school": "Abjuration"|"Conjuration"|"Divination"|"Enchantment"|"Evocation"|"Illusion"|"Necromancy"|"Transmutation", "casting_time": string, "range": string, "components": string, "duration": string, "price": number }',
};

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'AI suggestions unavailable' }, { status: 503 });
  }

  try {
    const body = await request.json();
    const { name, item_type } = body as { name?: string; item_type?: string };

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return NextResponse.json({ error: 'name is required (min 2 chars)' }, { status: 400 });
    }
    if (!item_type || !ALLOWED_TYPES.includes(item_type as ItemType)) {
      return NextResponse.json({ error: 'item_type must be magic_item, scroll, or spell' }, { status: 400 });
    }

    const type = item_type as ItemType;
    const client = new Anthropic({ apiKey });

    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: `You are a D&D 5th Edition rules expert. Given an item name and type, return accurate 5e stats as JSON. If the item is a well-known 5e item, use the official stats. If it's homebrew or unknown, invent balanced stats consistent with 5e conventions. Description should be 1-2 sentences, evocative and in-world. Always return valid JSON matching the schema exactly.`,
      messages: [
        {
          role: 'user',
          content: `Item name: "${name.trim()}"\nType: ${type}\n\nReturn JSON matching this schema:\n${FIELD_SCHEMAS[type]}`,
        },
      ],
    });

    const text = message.content[0]?.type === 'text' ? message.content[0].text : '';
    // Extract JSON from the response (may be wrapped in markdown code fences)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 });
    }

    const suggested = JSON.parse(jsonMatch[0]);
    return NextResponse.json(suggested);
  } catch (err) {
    console.error('POST /api/items/suggest', err);
    return NextResponse.json({ error: 'AI suggestion failed' }, { status: 500 });
  }
}
