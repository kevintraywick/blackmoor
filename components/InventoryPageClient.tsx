'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
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
  const searchParams = useSearchParams();
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

  // Prefill from /dm/magic → "Create Card". One-shot on mount.
  // Brings over type, title, description, and the magic card art.
  const prefilledRef = useRef(false);
  useEffect(() => {
    if (prefilledRef.current) return;
    const type = searchParams?.get('type');
    const title = searchParams?.get('title') ?? '';
    const description = searchParams?.get('description') ?? '';
    const image = searchParams?.get('image') ?? '';
    if (!type && !title && !description && !image) return;
    prefilledRef.current = true;

    const validTypes: Array<'magic_item' | 'scroll' | 'spell'> = ['magic_item', 'scroll', 'spell'];
    setFieldsRaw(prev => ({
      ...prev,
      itemType: validTypes.includes(type as 'magic_item' | 'scroll' | 'spell')
        ? (type as 'magic_item' | 'scroll' | 'spell')
        : prev.itemType,
      title: title || prev.title,
      description: description || prev.description,
    }));

    if (image) {
      // Fetch the magic card art and convert to a File so the inventory's
      // existing upload flow handles it identically to a drag-and-drop.
      fetch(image)
        .then(r => r.ok ? r.blob() : Promise.reject(new Error(String(r.status))))
        .then(blob => {
          const ext = (blob.type.split('/')[1] || 'png').replace('jpeg', 'jpg');
          const file = new File([blob], `prefill.${ext}`, { type: blob.type || 'image/png' });
          fileRef.current = file;
          setFieldsRaw(prev => ({ ...prev, imagePreview: URL.createObjectURL(file) }));
        })
        .catch(() => {
          // Silent — DM can drop their own image.
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      {/* Inventory pane — Row 1 */}
      <div className="relative border border-[var(--color-border)] rounded bg-[var(--color-surface)]">
        <div className="px-6 pt-5 pb-6">
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
            <h2 className="font-serif text-[1.3rem] italic text-[var(--color-text)] leading-none tracking-tight" style={{ marginRight: 'auto' }}>
              Add to Market
            </h2>
            {confirmDelete ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span className="font-serif italic text-[var(--color-text)] text-[0.85rem]">Are you sure?</span>
                <button
                  onClick={handleDeleteConfirmed}
                  className="rounded-full text-white font-sans font-bold uppercase tracking-widest
                             hover:opacity-80 transition-colors"
                  style={{ backgroundColor: '#7b1a1a', fontSize: '0.6rem', paddingLeft: 12, paddingRight: 12, paddingTop: 4, paddingBottom: 4 }}
                >
                  Yes
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="rounded-full font-sans font-bold uppercase tracking-widest
                             border border-[var(--color-border)] text-[var(--color-text-muted)]
                             hover:text-[var(--color-text)] hover:border-[var(--color-text-dim)] transition-colors"
                  style={{ fontSize: '0.6rem', paddingLeft: 12, paddingRight: 12, paddingTop: 4, paddingBottom: 4 }}
                >
                  No
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <button
                  onClick={() => selectedItem && setConfirmDelete(true)}
                  disabled={!selectedItem}
                  title={selectedItem ? 'Delete item' : 'Select an item first'}
                  className="rounded-full text-white font-sans font-bold uppercase tracking-widest
                             hover:opacity-80 disabled:opacity-50 transition-colors"
                  style={{ backgroundColor: '#7b1a1a', fontSize: '0.6rem', paddingLeft: 12, paddingRight: 12, paddingTop: 4, paddingBottom: 4 }}
                >
                  Delete
                </button>
                <button
                  onClick={handleEdit}
                  disabled={!selectedItem}
                  title={selectedItem ? 'Load item into form' : 'Select an item first'}
                  className="rounded-full text-white font-sans font-bold uppercase tracking-widest
                             hover:opacity-80 disabled:opacity-50 transition-colors"
                  style={{ backgroundColor: '#2d6a4f', fontSize: '0.6rem', paddingLeft: 12, paddingRight: 12, paddingTop: 4, paddingBottom: 4 }}
                >
                  Edit
                </button>
                <button
                  onClick={sendToMarketplace}
                  disabled={!selectedItem}
                  title={selectedItem ? 'Send to marketplace' : 'Select an item first'}
                  className="rounded-full font-sans font-bold uppercase tracking-widest
                             hover:opacity-80 disabled:opacity-50 transition-colors"
                  style={{ backgroundColor: 'var(--color-gold)', color: '#1a1614', fontSize: '0.6rem', paddingLeft: 12, paddingRight: 12, paddingTop: 4, paddingBottom: 4 }}
                >
                  → Market
                </button>
              </div>
            )}
          </div>
          <div className="border-t border-[var(--color-border)] mb-6" />
          <InventoryItemGrid
            refreshKey={refreshKey}
            selectedItemId={selectedItem?.id ?? null}
            onSelect={handleSelect}
          />
        </div>
      </div>

      {/* Builder + Preview — side by side */}
      <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
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
            {saving ? 'Adding...' : 'Add to Market Inventory'}
          </button>
        </div>

        {/* Pane 2: Card Preview */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <CardPreview fields={fields} />
        </div>
      </div>

    </div>
  );
}
