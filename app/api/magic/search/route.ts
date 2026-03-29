import { NextResponse } from 'next/server';

const OPEN5E_BASE = 'https://api.open5e.com/v2';

interface Open5eSpell {
  key: string;
  name: string;
  level: number;
  school: { name: string };
  casting_time: string;
  range_text: string;
  verbal: boolean;
  somatic: boolean;
  material: boolean;
  material_specified: string;
  duration: string;
  concentration: boolean;
  ritual: boolean;
  desc: string;
  higher_level: string;
}

interface Open5eItem {
  key: string;
  name: string;
  desc: string;
  category: { name: string };
  rarity: { name: string };
  requires_attunement: boolean;
}

interface NormalizedResult {
  key: string;
  name: string;
  description: string;
  metadata: Record<string, unknown>;
}

function normalizeSpell(s: Open5eSpell): NormalizedResult {
  const components: string[] = [];
  if (s.verbal) components.push('V');
  if (s.somatic) components.push('S');
  if (s.material) components.push(s.material_specified ? `M (${s.material_specified})` : 'M');

  return {
    key: s.key,
    name: s.name,
    description: s.desc + (s.higher_level ? `\n\n**At Higher Levels.** ${s.higher_level}` : ''),
    metadata: {
      level: s.level,
      school: s.school?.name ?? '',
      casting_time: s.casting_time,
      range: s.range_text,
      components: components.join(', '),
      duration: (s.concentration ? 'Concentration, ' : '') + s.duration,
      ritual: s.ritual,
    },
  };
}

function normalizeItem(item: Open5eItem): NormalizedResult {
  return {
    key: item.key,
    name: item.name,
    description: item.desc,
    metadata: {
      category: item.category?.name ?? '',
      rarity: item.rarity?.name ?? '',
      requires_attunement: item.requires_attunement,
    },
  };
}

export async function POST(request: Request) {
  try {
    const { q, category } = await request.json();
    if (!q || typeof q !== 'string') {
      return NextResponse.json({ results: [] });
    }

    let url: string;
    if (category === 'spell') {
      url = `${OPEN5E_BASE}/spells/?search=${encodeURIComponent(q)}&format=json&limit=20`;
    } else if (category === 'magic_item') {
      url = `${OPEN5E_BASE}/items/?search=${encodeURIComponent(q)}&is_magic_item=true&format=json&limit=20`;
    } else {
      return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
    }

    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) {
      return NextResponse.json({ error: 'Open5e API error' }, { status: 502 });
    }

    const data = await res.json();
    const results: NormalizedResult[] = (data.results ?? []).map(
      (r: Open5eSpell | Open5eItem) =>
        category === 'spell' ? normalizeSpell(r as Open5eSpell) : normalizeItem(r as Open5eItem)
    );

    return NextResponse.json({ results });
  } catch (err) {
    console.error('POST /api/magic/search', err);
    return NextResponse.json({ error: 'Failed to search Open5e' }, { status: 502 });
  }
}
