import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const ALLOWED_TYPES = ['magic_item', 'scroll', 'spell'] as const;
type ItemType = (typeof ALLOWED_TYPES)[number];

const FIELD_SCHEMAS: Record<ItemType, string> = {
  magic_item: '{ "description": string, "attack": number, "damage": number, "heal": number, "rarity": "Common"|"Uncommon"|"Rare"|"Very Rare"|"Legendary", "attunement": boolean, "price": number }',
  scroll: '{ "description": string, "level": number (0=cantrip), "school": "Abjuration"|"Conjuration"|"Divination"|"Enchantment"|"Evocation"|"Illusion"|"Necromancy"|"Transmutation", "risk_percent": number (default 10*level for levels 1-5; suggest a value for 6+), "price": number }',
  spell: '{ "description": string, "level": number (0=cantrip), "school": "Abjuration"|"Conjuration"|"Divination"|"Enchantment"|"Evocation"|"Illusion"|"Necromancy"|"Transmutation", "casting_time": string, "range": string, "components": string, "duration": string, "risk_percent": number (default 10*level for levels 1-5; suggest a value for 6+), "price": number }',
};

// --- 5e SRD API lookup ---

const SRD_BASE = 'https://www.dnd5eapi.co/api/2014';

interface SrdSpell {
  name: string;
  desc: string[];
  level: number;
  school: { name: string };
  casting_time: string;
  range: string;
  components: string[];
  material?: string;
  duration: string;
}

interface SrdMagicItem {
  name: string;
  desc: string[];
  rarity: { name: string };
}

interface SrdEquipment {
  name: string;
  desc?: string[];
  cost?: { quantity: number; unit: string };
  damage?: { damage_dice: string };
}

/** Convert a name to the SRD index format: "Bag of Holding" -> "bag-of-holding" */
function toIndex(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');
}

/** Estimate a gold price for a spell scroll based on level (DMG guidelines) */
function scrollPrice(level: number): number {
  const prices: Record<number, number> = { 0: 25, 1: 75, 2: 150, 3: 300, 4: 500, 5: 1000, 6: 2000, 7: 5000, 8: 10000, 9: 25000 };
  return prices[level] ?? 100;
}

/** Calculate risk percent: 10% per level for 1-5, suggest for 6+ */
function riskPercent(level: number): number {
  if (level <= 0) return 0;
  if (level <= 5) return level * 10;
  return 50 + (level - 5) * 5; // 55, 60, 65, 70 for 6-9
}

/** Try looking up a spell from the 5e SRD API */
async function lookupSpell(index: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`${SRD_BASE}/spells/${index}`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    const spell: SrdSpell = await res.json();
    const comps = spell.components.join(', ') + (spell.material ? ` (${spell.material})` : '');
    const desc = spell.desc.join(' ').slice(0, 200);
    return {
      description: desc,
      level: spell.level,
      school: spell.school.name,
      casting_time: spell.casting_time,
      range: spell.range,
      components: comps,
      duration: spell.duration,
      risk_percent: riskPercent(spell.level),
      price: scrollPrice(spell.level),
      _source: 'srd',
    };
  } catch {
    return null;
  }
}

/** Try looking up a magic item from the 5e SRD API */
async function lookupMagicItem(index: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`${SRD_BASE}/magic-items/${index}`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    const item: SrdMagicItem = await res.json();
    const desc = item.desc.join(' ').slice(0, 200);
    return {
      description: desc,
      rarity: item.rarity.name,
      attunement: item.desc.some(d => d.toLowerCase().includes('requires attunement')),
      attack: 0,
      damage: 0,
      heal: 0,
      price: 0,
      _source: 'srd',
    };
  } catch {
    return null;
  }
}

/** Try looking up equipment (weapons/armor/gear) as a magic item fallback */
async function lookupEquipment(index: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`${SRD_BASE}/equipment/${index}`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    const equip: SrdEquipment = await res.json();
    const desc = equip.desc?.join(' ').slice(0, 200) || '';
    const gpMultiplier: Record<string, number> = { cp: 0.01, sp: 0.1, ep: 0.5, gp: 1, pp: 10 };
    const price = equip.cost ? Math.round(equip.cost.quantity * (gpMultiplier[equip.cost.unit] ?? 1)) : 0;
    return {
      description: desc,
      rarity: 'Common',
      attunement: false,
      attack: 0,
      damage: equip.damage ? parseInt(equip.damage.damage_dice) || 0 : 0,
      heal: 0,
      price,
      _source: 'srd',
    };
  } catch {
    return null;
  }
}

/** Try the 5e SRD API first based on item type */
async function lookupSrd(name: string, type: ItemType): Promise<Record<string, unknown> | null> {
  const index = toIndex(name);
  if (type === 'spell' || type === 'scroll') {
    return lookupSpell(index);
  }
  // magic_item: try magic-items first, then equipment
  const item = await lookupMagicItem(index);
  if (item) return item;
  return lookupEquipment(index);
}

// --- Claude Haiku fallback ---

async function suggestWithAI(name: string, type: ItemType, apiKey: string): Promise<Record<string, unknown> | null> {
  const client = new Anthropic({ apiKey });
  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    system: `You are a D&D 5th Edition rules expert. Given an item name and type, return accurate 5e stats as JSON. If the item is a well-known 5e item, use the official stats. If it's homebrew or unknown, invent balanced stats consistent with 5e conventions. Description should be 1-2 sentences, evocative and in-world. Always return valid JSON matching the schema exactly.`,
    messages: [
      {
        role: 'user',
        content: `Item name: "${name}"\nType: ${type}\n\nReturn JSON matching this schema:\n${FIELD_SCHEMAS[type]}`,
      },
    ],
  });

  const text = message.content[0]?.type === 'text' ? message.content[0].text : '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  return { ...JSON.parse(jsonMatch[0]), _source: 'ai' };
}

// --- Handler ---

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, item_type } = body as { name?: string; item_type?: string };

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return NextResponse.json({ error: 'name is required (min 2 chars)' }, { status: 400 });
    }
    if (!item_type || !ALLOWED_TYPES.includes(item_type as ItemType)) {
      return NextResponse.json({ error: 'item_type must be magic_item, scroll, or spell' }, { status: 400 });
    }

    const trimmed = name.trim();
    const type = item_type as ItemType;

    // 1) Try the free 5e SRD API first
    const srdResult = await lookupSrd(trimmed, type);
    if (srdResult) {
      return NextResponse.json(srdResult);
    }

    // 2) Fall back to Claude Haiku for homebrew/unknown items
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'AI suggestions unavailable' }, { status: 503 });
    }

    const aiResult = await suggestWithAI(trimmed, type, apiKey);
    if (!aiResult) {
      return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 });
    }

    return NextResponse.json(aiResult);
  } catch (err) {
    console.error('POST /api/items/suggest', err);
    return NextResponse.json({ error: 'Suggestion failed' }, { status: 500 });
  }
}
