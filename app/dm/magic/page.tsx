export const dynamic = 'force-dynamic';

import DmNav from '@/components/DmNav';
import MagicPageClient from '@/components/MagicPageClient';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import type { MagicCatalogEntry } from '@/lib/types';

export default async function MagicPage() {
  await ensureSchema();
  const catalog = await query<MagicCatalogEntry>(
    'SELECT * FROM magic_catalog ORDER BY created_at DESC'
  );

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
      <DmNav current="magic" />
      <MagicPageClient initial={catalog} />
    </div>
  );
}
