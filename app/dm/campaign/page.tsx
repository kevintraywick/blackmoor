export const dynamic = 'force-dynamic';

import Image from 'next/image';
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
      <div className="relative w-full h-48 sm:h-64">
        <Image
          src="/images/campaign/campaign_banner_1.png"
          alt="Campaign"
          fill
          className="object-cover object-center"
          priority
        />
      </div>
      <CampaignPageClient initial={campaign ?? { id: 'default', name: '', world: '' }} />
    </div>
  );
}
