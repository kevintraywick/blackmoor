'use client';

import { useState } from 'react';
import InventoryCreateForm from './InventoryCreateForm';
import InventoryItemGrid, { type Item } from './InventoryItemGrid';

export default function InventoryPageClient() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function handleSelect(item: Item) {
    setSelectedItem(prev => prev?.id === item.id ? null : item);
  }

  async function sendToMarketplace() {
    if (!selectedItem) return;
    await fetch(`/api/items/${selectedItem.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ marketplace_action: 'add' }),
    });
    setSelectedItem(null);
    setRefreshKey(k => k + 1);
  }

  function handleEdit() {
    if (!selectedItem) return;
    setEditItem(selectedItem);
    setSelectedItem(null);
  }

  async function handleDeleteConfirmed() {
    if (!selectedItem) return;
    await fetch(`/api/items/${selectedItem.id}`, { method: 'DELETE' });
    setConfirmDelete(false);
    setSelectedItem(null);
    setRefreshKey(k => k + 1);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Create pane */}
      <div className="border border-[var(--color-border)] rounded bg-[#2e3a4a]">
        <InventoryCreateForm
          key={editItem?.id ?? 'new'}
          onCreated={() => { setRefreshKey(k => k + 1); setEditItem(null); }}
          editItem={editItem}
        />
      </div>

      {/* Inventory pane */}
      <div className="relative border border-[var(--color-border)] rounded bg-[#2e3a4a]">
        {/* DELETE button */}
        <button
          onClick={() => selectedItem && setConfirmDelete(true)}
          disabled={!selectedItem}
          title={selectedItem ? 'Delete item' : 'Select an item first'}
          className="absolute top-4 right-28 w-10 h-10 rounded-full bg-red-700 text-white
                     text-lg font-bold flex items-center justify-center
                     hover:bg-red-600 disabled:opacity-50 transition-colors"
        >
          ✕
        </button>

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
          className="absolute top-4 right-4 w-10 h-10 rounded-full bg-[var(--color-gold)] text-black text-xl
                     font-bold flex items-center justify-center hover:bg-[#e0bc5a]
                     disabled:opacity-50 transition-colors"
        >
          +
        </button>

        <div className="px-6 pt-5 pb-6 min-h-[480px]">
          <h2 className="font-serif text-[1.3rem] italic text-[var(--color-text)] leading-none tracking-tight mb-1">
            Inventory
          </h2>
          <p className="text-[0.65rem] uppercase tracking-[0.22em] text-[var(--color-text-muted)] mb-4">
            Items available to add to the Marketplace
          </p>
          <div className="border-t border-[var(--color-border)] mb-6" />
          <InventoryItemGrid
            refreshKey={refreshKey}
            selectedItemId={selectedItem?.id ?? null}
            onSelect={handleSelect}
          />
        </div>
      </div>

      {/* Delete confirmation dialog */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded px-8 py-6 max-w-sm w-full mx-4 shadow-xl">
            <p className="font-serif text-[1.1rem] italic text-[var(--color-text)] mb-6 text-center">
              Do you wish to delete this item?
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={handleDeleteConfirmed}
                className="px-6 py-2 rounded bg-red-700 text-white text-sm font-bold
                           hover:bg-red-600 transition-colors"
              >
                Delete
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-6 py-2 rounded border border-[var(--color-border)] text-[var(--color-text-muted)] text-sm
                           hover:text-[var(--color-text)] hover:border-[var(--color-text-dim)] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
