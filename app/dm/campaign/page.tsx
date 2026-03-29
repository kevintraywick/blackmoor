export const dynamic = 'force-dynamic';

import DmNav from '@/components/DmNav';
import CampaignPageClient from '@/components/CampaignPageClient';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import type { Campaign } from '@/lib/types';

export default async function CampaignPage() {
  await ensureSchema();
  const [campaign] = await query<Campaign>(
    'SELECT * FROM campaign LIMIT 1'
  );

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
      <DmNav current="campaign" />
      <CampaignPageClient initial={campaign ?? { id: 'default', name: '', world: '' }} />
    </div>
  );
}
