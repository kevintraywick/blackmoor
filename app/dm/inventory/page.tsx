import DmNav from '@/components/DmNav';
import InventoryPageClient from '@/components/InventoryPageClient';

export default function InventoryPage() {
  return (
    <div className="min-h-screen bg-[#1a1614] text-[#e8ddd0]">
      <DmNav current="inventory" />
      <div className="max-w-[780px] mx-auto px-8 py-10">
        <InventoryPageClient />
      </div>
    </div>
  );
}
