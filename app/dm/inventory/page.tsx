import DmNav from '@/components/DmNav';

export default function InventoryPage() {
  return (
    <div className="min-h-screen bg-[#1a1614] text-[#e8ddd0]">
      <DmNav current="inventory" />

      <div className="max-w-[780px] mx-auto px-8 py-10">
        <h1 className="font-serif text-[2rem] italic text-[#e8ddd0] leading-none tracking-tight">Inventory</h1>
        <p className="text-[0.65rem] uppercase tracking-[0.22em] text-[#8a7d6e] mt-1.5 mb-6">
          Items available to add to the Marketplace
        </p>

        <div className="border border-[#3d3530] rounded min-h-[480px]" />
      </div>
    </div>
  );
}
