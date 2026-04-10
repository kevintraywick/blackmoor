import DmNav from '@/components/DmNav';
import MagicPageClient from '@/components/MagicPageClient';

export default function MagicPage() {
  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
      <DmNav current="magic" />
      <MagicPageClient />
    </div>
  );
}
