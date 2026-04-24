import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

interface CatalogRow {
  id: string;
  api_key: string;
  name: string;
  description: string;
  metadata: Record<string, unknown>;
  category: string;
  image_path: string;
}

export async function POST(request: Request) {
  try {
    const { q, category } = await request.json();
    if (!q || typeof q !== 'string') {
      return NextResponse.json({ results: [] });
    }

    const searchTerm = `%${q}%`;

    let rows: CatalogRow[];
    if (category && category !== 'all') {
      rows = await query<CatalogRow>(
        `SELECT id, api_key, name, description, metadata, category, image_path
         FROM magic_catalog
         WHERE category = $1 AND name ILIKE $2
         ORDER BY name ASC
         LIMIT 20`,
        [category, searchTerm]
      );
    } else {
      // Search all categories
      rows = await query<CatalogRow>(
        `SELECT id, api_key, name, description, metadata, category, image_path
         FROM magic_catalog
         WHERE name ILIKE $1
         ORDER BY name ASC
         LIMIT 30`,
        [searchTerm]
      );
    }

    const results = rows.map(r => ({
      id: r.id,
      key: r.api_key ?? r.name,
      name: r.name,
      description: r.description,
      metadata: r.metadata,
      category: r.category,
      image_path: r.image_path ?? '',
    }));

    return NextResponse.json({ results });
  } catch (err) {
    console.error('POST /api/magic/search', err);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
