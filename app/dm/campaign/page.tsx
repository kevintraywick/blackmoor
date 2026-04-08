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

  const bannerSrc = campaign?.home_banner_path || '/images/campaign/campaign_banner_1.png';
  const bannerIsUploaded = bannerSrc.startsWith('/api/');

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
      <DmNav current="campaign" />
      <div className="relative w-full h-48 sm:h-64">
        {bannerIsUploaded ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={bannerSrc}
            alt="Campaign"
            className="absolute inset-0 w-full h-full object-cover object-center"
          />
        ) : (
          <Image
            src={bannerSrc}
            alt="Campaign"
            fill
            className="object-cover object-center"
            priority
          />
        )}
      </div>
      <CampaignPageClient initial={campaign ?? { id: 'default', name: '', world: '' }} />
    </div>
  );
}
