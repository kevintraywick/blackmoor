'use client';

import { useState } from 'react';
import InventoryCreateForm from './InventoryCreateForm';
import InventoryItemGrid from './InventoryItemGrid';

export default function InventoryPageClient() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="flex flex-col gap-4">
      {/* Create pane */}
      <div className="border border-[#3d3530] rounded bg-[#7a3c10]">
        <InventoryCreateForm onCreated={() => setRefreshKey(k => k + 1)} />
      </div>

      {/* Inventory pane */}
      <div className="border border-[#3d3530] rounded bg-[#7a3c10]">
        <div className="px-6 pt-5 pb-6 min-h-[480px]">
          <h2 className="font-serif text-[1.3rem] italic text-[#e8ddd0] leading-none tracking-tight mb-1">
            Inventory
          </h2>
          <p className="text-[0.65rem] uppercase tracking-[0.22em] text-[#8a7d6e] mb-4">
            Items available to add to the Marketplace
          </p>
          <div className="border-t border-[#3d3530] mb-6" />
          <InventoryItemGrid refreshKey={refreshKey} />
        </div>
      </div>
    </div>
  );
}
