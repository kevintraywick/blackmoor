import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import type { Invitation } from '@/lib/types';

// GET /api/invitations — return all invitations
export async function GET() {
  try {
    await ensureSchema();
    const rows = await query<Invitation>('SELECT * FROM invitations ORDER BY created_at DESC');
    return NextResponse.json(rows);
  } catch (err) {
    console.error('GET /api/invitations', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

// POST /api/invitations — create a new invitation
export async function POST(req: Request) {
  try {
    await ensureSchema();
    const { dates } = await req.json();

    if (!Array.isArray(dates) || dates.length < 1 || dates.length > 5) {
      return NextResponse.json({ error: 'Provide 1-5 dates' }, { status: 400 });
    }

    // Validate date format
    for (const d of dates) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
        return NextResponse.json({ error: `Invalid date format: ${d}` }, { status: 400 });
      }
    }

    // Sort dates and compute slug from earliest
    const sorted = [...dates].sort();
    const earliest = new Date(sorted[0] + 'T12:00:00');
    const monthAbbr = earliest.toLocaleDateString('en-US', { month: 'short' }).toLowerCase();
    const day = String(earliest.getDate()).padStart(2, '0');
    const baseSlug = `${monthAbbr}_${day}`;

    // Check for slug collision
    let slug = baseSlug;
    let suffix = 1;
    while (true) {
      const existing = await query('SELECT id FROM invitations WHERE slug = $1', [slug]);
      if (existing.length === 0) break;
      suffix++;
      slug = `${baseSlug}_${suffix}`;
    }

    // Build label
    const label = `${earliest.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} Invitation`;

    const [row] = await query<Invitation>(
      `INSERT INTO invitations (slug, label, dates) VALUES ($1, $2, $3::jsonb) RETURNING *`,
      [slug, label, JSON.stringify(sorted)]
    );

    return NextResponse.json(row);
  } catch (err) {
    console.error('POST /api/invitations', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
