import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import { sendEmail } from '@/lib/email';

// GET /api/availability — return all availability rows
export async function GET() {
  try {
    await ensureSchema();
    const rows = await query('SELECT player_id, saturday, status FROM availability ORDER BY saturday ASC');
    return NextResponse.json(rows);
  } catch (err) {
    console.error('GET /api/availability', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}

// PUT /api/availability — upsert a single availability record
export async function PUT(req: Request) {
  try {
    await ensureSchema();
    const { player_id, saturday, status } = await req.json();

    if (!player_id || !saturday || !['in', 'out'].includes(status)) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    await query(
      `INSERT INTO availability (player_id, saturday, status)
       VALUES ($1, $2, $3)
       ON CONFLICT (player_id, saturday)
       DO UPDATE SET status = EXCLUDED.status`,
      [player_id, saturday, status]
    );

    // Check quorum and notify DM
    try {
      const [{ count }] = await query<{ count: number }>(
        `SELECT COUNT(*)::int as count FROM availability WHERE saturday = $1 AND status = 'in'`,
        [saturday]
      );

      const [campaign] = await query<{
        quorum: number;
        dm_email: string;
        quorum_notified: string[] | null;
      }>('SELECT quorum, dm_email, quorum_notified FROM campaign LIMIT 1');

      const notified = Array.isArray(campaign?.quorum_notified) ? campaign.quorum_notified : [];

      console.log('Quorum check:', { saturday, status, count, quorum: campaign?.quorum, dm_email: campaign?.dm_email, notified, hasKey: !!process.env.RESEND_API_KEY });

      if (campaign && campaign.dm_email) {
        const d = new Date(saturday + 'T12:00:00');
        const dateStr = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
        const wasNotified = notified.includes(saturday);

        // Quorum just reached — send celebration email
        if (status === 'in' && count >= campaign.quorum && !wasNotified) {
          const inPlayers = await query<{ player_name: string; character: string }>(
            `SELECT p.player_name, p.character FROM availability a
             JOIN players p ON p.id = a.player_id
             WHERE a.saturday = $1 AND a.status = 'in'
             ORDER BY p.sort_order`,
            [saturday]
          );

          const playerList = inPlayers.map(p => `  ${p.player_name} (${p.character})`).join('\n');

          await sendEmail({
            to: campaign.dm_email,
            subject: `Quorum reached for ${dateStr}`,
            text: `${count} players confirmed for ${dateStr}:\n\n${playerList}\n\nView availability: ${process.env.NEXT_PUBLIC_URL ?? 'https://blackmoor-production.up.railway.app'}/canyouplay`,
          });

          // Mark this Saturday as notified
          const updated = [...notified, saturday];
          await query(
            `UPDATE campaign SET quorum_notified = $1::jsonb WHERE id = 'default'`,
            [JSON.stringify(updated)]
          );
        }

        // Quorum lost — someone dropped out and we're now below threshold
        if (status === 'out' && count < campaign.quorum && wasNotified) {
          await sendEmail({
            to: campaign.dm_email,
            subject: `Quorum lost for ${dateStr}`,
            text: `A player dropped out — only ${count} of ${campaign.quorum} needed are confirmed for ${dateStr}.\n\nView availability: ${process.env.NEXT_PUBLIC_URL ?? 'https://blackmoor-production.up.railway.app'}/canyouplay`,
          });

          // Remove from notified so re-reaching quorum triggers a new email
          const updated = notified.filter((s: string) => s !== saturday);
          await query(
            `UPDATE campaign SET quorum_notified = $1::jsonb WHERE id = 'default'`,
            [JSON.stringify(updated)]
          );
        }
      }
    } catch (notifyErr) {
      console.error('Quorum notification failed (availability still saved):', notifyErr);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('PUT /api/availability', err);
    return NextResponse.json({ error: 'Database error' }, { status: 500 });
  }
}
