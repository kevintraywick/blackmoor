'use client';

import { useState } from 'react';
import InventoryCreateForm from './InventoryCreateForm';
import InventoryItemGrid, { type Item } from './InventoryItemGrid';

export default function InventoryPageClient() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [editItem, setEditItem] = useState<Item | null>(null);

  function handleSelect(item: Item) {
    setSelectedItem(prev => prev?.id === item.id ? null : item);
  }

  async function sendToMarketplace() {
    if (!selectedItem) return;
    await fetch(`/api/items/${selectedItem.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ in_marketplace: true }),
    });
    setSelectedItem(null);
    setRefreshKey(k => k + 1);
  }

  function handleEdit() {
    if (!selectedItem) return;
    setEditItem(selectedItem);
    setSelectedItem(null);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Create pane */}
      <div className="border border-[#3d3530] rounded bg-[#2e3a4a]">
        <InventoryCreateForm
          key={editItem?.id ?? 'new'}
          onCreated={() => { setRefreshKey(k => k + 1); setEditItem(null); }}
          editItem={editItem}
        />
      </div>

      {/* Inventory pane */}
      <div className="relative border border-[#3d3530] rounded bg-[#2e3a4a]">
        {/* EDIT button */}
        <button
          onClick={handleEdit}
          disabled={!selectedItem}
          title={selectedItem ? 'Load item into form' : 'Select an item first'}
          className="absolute top-4 right-16 w-10 h-10 rounded-full bg-[#2d6a4f] text-white
                     text-[9px] font-bold tracking-wider flex items-center justify-center
                     hover:bg-[#3a8a65] disabled:opacity-50 transition-colors"
        >
          EDIT
        </button>

        {/* Send-to-marketplace button */}
        <button
          onClick={sendToMarketplace}
          disabled={!selectedItem}
          title={selectedItem ? 'Send to marketplace' : 'Select an item first'}
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
            selectedItemId={selectedItem?.id ?? null}
            onSelect={handleSelect}
          />
        </div>
      </div>
    </div>
  );
}
