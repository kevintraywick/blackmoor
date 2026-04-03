'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import InventoryCreateForm from './InventoryCreateForm';
import InventoryItemGrid, { type Item } from './InventoryItemGrid';
import CardPreview, { type CardFields } from './CardPreview';

const DEFAULT_FIELDS: CardFields = {
  itemType: 'magic_item',
  title: '',
  description: '',
  price: '',
  attack: '',
  damage: '',
  heal: '',
  rarity: '',
  attunement: false,
  level: '',
  school: '',
  castingTime: '',
  range: '',
  components: '',
  duration: '',
  riskPercent: '',
  imagePreview: null,
  existingImagePath: null,
};

export default function InventoryPageClient() {
  const [fields, setFieldsRaw] = useState<CardFields>({ ...DEFAULT_FIELDS });
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [imagePrompt, setImagePrompt] = useState('');
  const [promptLoading, setPromptLoading] = useState(false);
  const [promptCopied, setPromptCopied] = useState(false);
  const fileRef = useRef<File | null>(null);

  // Track what we last suggested for to avoid re-calling
  const lastSuggestRef = useRef<string>('');

  function setFields(update: Partial<CardFields>) {
    setFieldsRaw(prev => ({ ...prev, ...update }));
  }

  // --- Auto-fill via AI ---
  useEffect(() => {
    const key = `${fields.itemType}::${fields.title.trim().toLowerCase()}`;
    if (fields.title.trim().length < 2 || key === lastSuggestRef.current) return;

    const timer = setTimeout(async () => {
      if (key === lastSuggestRef.current) return;
      lastSuggestRef.current = key;
      setSuggesting(true);
      try {
        const res = await fetch('/api/items/suggest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: fields.title.trim(), item_type: fields.itemType }),
        });
        if (!res.ok) return; // 503 = no key, just skip
        const data = await res.json();

        // Apply suggested values — only fill fields that are currently empty
        setFieldsRaw(prev => ({
          ...prev,
          description: prev.description || data.description || '',
          price: prev.price || String(data.price ?? ''),
          attack: prev.attack || String(data.attack ?? ''),
          damage: prev.damage || String(data.damage ?? ''),
          heal: prev.heal || String(data.heal ?? ''),
          rarity: prev.rarity || data.rarity || '',
          attunement: prev.attunement || data.attunement || false,
          level: prev.level || String(data.level ?? ''),
          school: prev.school || data.school || '',
          castingTime: prev.castingTime || data.casting_time || '',
          range: prev.range || data.range || '',
          components: prev.components || data.components || '',
          duration: prev.duration || data.duration || '',
          riskPercent: prev.riskPercent || (data.risk_percent != null ? String(data.risk_percent) : ''),
        }));
      } catch {
        // Silent failure
      } finally {
        setSuggesting(false);
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [fields.title, fields.itemType]);

  // --- Auto-generate MJ image prompt from description ---
  const lastPromptDescRef = useRef<string>('');
  useEffect(() => {
    const desc = fields.description.trim();
    const name = fields.title.trim();
    if (desc.length < 10 || !name || desc === lastPromptDescRef.current) return;

    const timer = setTimeout(async () => {
      if (desc === lastPromptDescRef.current) return;
      lastPromptDescRef.current = desc;
      setPromptLoading(true);
      try {
        const res = await fetch('/api/items/image-prompt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, item_type: fields.itemType, description: desc }),
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data.prompt) setImagePrompt(data.prompt);
      } catch {
        // Silent
      } finally {
        setPromptLoading(false);
      }
    }, 1200);

    return () => clearTimeout(timer);
  }, [fields.description, fields.title, fields.itemType]);

  // --- File handling ---
  function handleFileSelected(file: File) {
    fileRef.current = file;
    if (fields.imagePreview) URL.revokeObjectURL(fields.imagePreview);
    setFields({ imagePreview: URL.createObjectURL(file) });
  }

  // --- Publish ---
  async function handlePublish() {
    if (saving || !fields.title.trim()) return;
    setSaving(true);
    setError(null);

    const fd = new FormData();
    fd.set('title', fields.title);
    fd.set('description', fields.description);
    fd.set('item_type', fields.itemType);
    fd.set('price', fields.price || '0');

    if (fields.itemType === 'magic_item') {
      fd.set('attack', fields.attack || '0');
      fd.set('damage', fields.damage || '0');
      fd.set('heal', fields.heal || '0');
      fd.set('rarity', fields.rarity);
      fd.set('attunement', String(fields.attunement));
    }
    if (fields.itemType === 'scroll' || fields.itemType === 'spell') {
      fd.set('level', fields.level || '0');
      fd.set('school', fields.school);
      if (fields.riskPercent) fd.set('risk_percent', fields.riskPercent);
    }
    if (fields.itemType === 'spell') {
      fd.set('casting_time', fields.castingTime);
      fd.set('range', fields.range);
      fd.set('components', fields.components);
      fd.set('duration', fields.duration);
    }

    if (fileRef.current) {
      fd.set('image', fileRef.current);
    }
    if (fields.existingImagePath) {
      fd.set('existing_image_path', fields.existingImagePath);
    }

    try {
      const res = await fetch('/api/items', { method: 'POST', body: fd });
      if (!res.ok) {
        const { error: errMsg } = await res.json();
        throw new Error(errMsg ?? 'Failed to create item');
      }
      // Reset
      if (fields.imagePreview) URL.revokeObjectURL(fields.imagePreview);
      fileRef.current = null;
      lastSuggestRef.current = '';
      lastPromptDescRef.current = '';
      setFieldsRaw({ ...DEFAULT_FIELDS });
      setImagePrompt('');
      setEditItem(null);
      setRefreshKey(k => k + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setSaving(false);
    }
  }

  // --- Edit / Select / Delete ---
  function handleSelect(item: Item) {
    setSelectedItem(prev => prev?.id === item.id ? null : item);
  }

  function handleEdit() {
    if (!selectedItem) return;
    const item = selectedItem;
    setFieldsRaw({
      itemType: (item.item_type as CardFields['itemType']) ?? 'magic_item',
      title: item.title,
      description: item.description ?? '',
      price: String(item.price),
      attack: String(item.attack ?? ''),
      damage: String(item.damage ?? ''),
      heal: String(item.heal ?? ''),
      rarity: item.rarity ?? '',
      attunement: item.attunement ?? false,
      level: String(item.level ?? ''),
      school: item.school ?? '',
      castingTime: item.casting_time ?? '',
      range: item.range ?? '',
      components: item.components ?? '',
      duration: item.duration ?? '',
      riskPercent: item.risk_percent != null ? String(item.risk_percent) : '',
      imagePreview: null,
      existingImagePath: item.image_path,
    });
    lastSuggestRef.current = `${item.item_type ?? 'magic_item'}::${item.title.trim().toLowerCase()}`;
    setEditItem(item);
    setSelectedItem(null);
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

  async function handleDeleteConfirmed() {
    if (!selectedItem) return;
    await fetch(`/api/items/${selectedItem.id}`, { method: 'DELETE' });
    setConfirmDelete(false);
    setSelectedItem(null);
    setRefreshKey(k => k + 1);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Builder + Preview — side by side */}
      <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
        {/* Pane 1: Card Builder + Publish */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 480, flexShrink: 0 }}>
          <InventoryCreateForm
            fields={fields}
            setFields={setFields}
            onFileSelected={handleFileSelected}
            onSubmit={handlePublish}
            saving={saving}
            error={error}
            suggesting={suggesting}
          />
          {/* Publish button */}
          <button
            onClick={handlePublish}
            disabled={saving || !fields.title.trim()}
            className="w-full py-3 rounded font-serif text-[1.05rem] font-bold transition-colors
                       disabled:opacity-40"
            style={{
              backgroundColor: '#c9a84c',
              color: '#1a1614',
            }}
          >
            {saving ? 'Publishing...' : 'Publish to Inventory'}
          </button>
        </div>

        {/* Pane 2: Card Preview + Prompt */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <CardPreview fields={fields} />

          {/* MJ Image Prompt box — stretches to align bottom with Publish */}
          <div className="w-full border border-[var(--color-border)] rounded-md bg-[#1e1b18] relative flex flex-col"
            style={{ maxWidth: 340, flex: 1 }}>
            <div className="px-3 pt-2 pb-1">
              <span className="text-[0.6rem] uppercase tracking-[0.12em] text-[var(--color-text-muted)] font-sans">
                Image Prompt
              </span>
            </div>
            <div className="px-3 pb-3 flex-1 flex">
              <textarea
                value={imagePrompt}
                onChange={e => setImagePrompt(e.target.value)}
                placeholder={promptLoading ? 'Generating prompt...' : 'Describe your item for Midjourney...'}
                className="w-full bg-transparent border border-[var(--color-border)] rounded px-2 py-1.5
                  text-[0.8rem] text-[var(--color-text)] font-sans resize-none flex-1
                  outline-none focus:border-[var(--color-gold)] placeholder:text-[var(--color-text-dim)]"
              />
            </div>
            {/* Copy arrow — right side, vertically centered */}
            <button
              onClick={async () => {
                if (!imagePrompt) return;
                await navigator.clipboard.writeText(imagePrompt);
                setPromptCopied(true);
                setTimeout(() => setPromptCopied(false), 2000);
              }}
              disabled={!imagePrompt}
              className="absolute flex items-center justify-center transition-colors
                disabled:opacity-30"
              style={{
                right: -44, bottom: -16,
                width: 36, height: 36, borderRadius: '50%',
                border: '2px solid #4a7a5a',
                color: promptCopied ? '#5ab87a' : '#4a7a5a',
                fontSize: 18,
              }}
              title={promptCopied ? 'Copied!' : 'Copy prompt to clipboard'}
            >
              {promptCopied ? '✓' : '📋'}
            </button>
          </div>
        </div>
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
