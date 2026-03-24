'use client';

import { useState } from 'react';
import InventoryCreateForm from './InventoryCreateForm';
import InventoryItemGrid from './InventoryItemGrid';

export default function InventoryPageClient() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);

  function handleSelect(id: number) {
    setSelectedItemId(prev => prev === id ? null : id);
  }

  async function sendToMarketplace() {
    if (selectedItemId === null) return;
    await fetch(`/api/items/${selectedItemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ in_marketplace: true }),
    });
    setSelectedItemId(null);
    setRefreshKey(k => k + 1);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Create pane */}
      <div className="border border-[#3d3530] rounded bg-[#2e3a4a]">
        <InventoryCreateForm onCreated={() => setRefreshKey(k => k + 1)} />
      </div>

      {/* Inventory pane */}
      <div className="relative border border-[#3d3530] rounded bg-[#2e3a4a]">
        {/* Send-to-marketplace button — top-right corner */}
        <button
          onClick={sendToMarketplace}
          disabled={selectedItemId === null}
          title={selectedItemId !== null ? 'Send to marketplace' : 'Select an item first'}
          className="absolute top-4 right-4 w-10 h-10 rounded-full bg-[#c9a84c] text-black text-xl
                     font-bold flex items-center justify-center hover:bg-[#e0bc5a]
                     disabled:opacity-50 transition-colors"
        >
          +
        </button>

        <div className="px-6 pt-5 pb-6 min-h-[480px]">
          <h2 className="font-serif text-[1.3rem] italic text-[#e8ddd0] leading-none tracking-tight mb-1">
            Inventory
          </h2>
          <p className="text-[0.65rem] uppercase tracking-[0.22em] text-[#8a7d6e] mb-4">
            Items available to add to the Marketplace
          </p>
          <div className="border-t border-[#3d3530] mb-6" />
          <InventoryItemGrid
            refreshKey={refreshKey}
            selectedItemId={selectedItemId}
            onSelect={handleSelect}
          />
        </div>
      </div>
    </div>
  );
}
