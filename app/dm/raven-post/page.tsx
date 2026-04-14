export const dynamic = 'force-dynamic';

import DmNav from '@/components/DmNav';
import RavenPostEditor from '@/components/dm/raven-editor/RavenPostEditor';
import { getIssueDraft } from '@/lib/raven-issue-draft';
import { formatShireDate } from '@/lib/shire-date';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';

export default async function DmRavenPostPage() {
  await ensureSchema();
  const [draft, campaignRows] = await Promise.all([
    getIssueDraft(),
    query<{ raven_volume: number; raven_issue: number }>(
      `SELECT raven_volume, raven_issue FROM campaign WHERE id = 'default'`,
    ),
  ]);

  const volume = campaignRows[0]?.raven_volume ?? 1;
  const issue = campaignRows[0]?.raven_issue ?? 1;
  const inFictionDate = draft.in_fiction_date || formatShireDate();

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
      <DmNav current="raven-post" />

      <div className="max-w-[1000px] mx-auto px-8 py-10">
        <RavenPostEditor
          initialDraft={draft}
          volume={volume}
          issue={issue}
          inFictionDate={inFictionDate}
        />
      </div>
    </div>
  );
}
