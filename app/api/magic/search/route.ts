import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

interface CatalogRow {
  api_key: string;
  name: string;
  description: string;
  metadata: Record<string, unknown>;
  category: string;
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
        `SELECT api_key, name, description, metadata, category
         FROM magic_catalog
         WHERE category = $1 AND name ILIKE $2
         ORDER BY name ASC
         LIMIT 20`,
        [category, searchTerm]
      );
    } else {
      // Search all categories
      rows = await query<CatalogRow>(
        `SELECT api_key, name, description, metadata, category
         FROM magic_catalog
         WHERE name ILIKE $1
         ORDER BY name ASC
         LIMIT 30`,
        [searchTerm]
      );
    }

    const results = rows.map(r => ({
      key: r.api_key ?? r.name,
      name: r.name,
      description: r.description,
      metadata: r.metadata,
      category: r.category,
    }));

    return NextResponse.json({ results });
  } catch (err) {
    console.error('POST /api/magic/search', err);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }
}
