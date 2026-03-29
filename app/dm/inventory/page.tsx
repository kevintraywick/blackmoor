import DmNav from '@/components/DmNav';
import InventoryPageClient from '@/components/InventoryPageClient';

export default function InventoryPage() {
  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)]">
      <DmNav current="inventory" />
      <div className="max-w-[1000px] mx-auto px-8 py-10">
        <InventoryPageClient />
      </div>
    </div>
  );
}
