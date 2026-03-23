import DmNav from '@/components/DmNav';

export default function InventoryPage() {
  return (
    <div className="min-h-screen bg-[#1a1614] text-[#e8ddd0]">
      <DmNav current="inventory" />

      <div className="max-w-[780px] mx-auto px-8 py-10">
        <div className="border border-[#3d3530] rounded bg-[#4a2208]">
          <div className="px-6 pt-5 pb-6 min-h-[480px]">
            <h2 className="font-serif text-[1.3rem] italic text-[#e8ddd0] leading-none tracking-tight mb-1">Inventory</h2>
            <p className="text-[0.65rem] uppercase tracking-[0.22em] text-[#8a7d6e] mb-4">Items available to add to the Marketplace</p>
            <div className="border-t border-[#3d3530]" />
          </div>
        </div>
      </div>
    </div>
  );
}
