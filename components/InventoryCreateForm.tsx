'use client';

import { useRef, useState } from 'react';

interface Props {
  onCreated: () => void;
}

const STAT_OPTIONS = [
  { value: 'magic',  label: 'Magic' },
  { value: 'attack', label: 'Attack' },
  { value: 'damage', label: 'Damage' },
  { value: 'heal',   label: 'Healing' },
];

function StepCounter({
  label,
  name,
  value,
  onChange,
}: {
  label: string;
  name: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-0.5 flex-shrink-0">
      <p className="text-[0.6rem] uppercase tracking-[0.15em] text-[#8a7d6e]">{label}</p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onChange(Math.max(0, value - 1))}
          className="w-7 h-7 rounded-full bg-[#231f1c] border border-[#3d3530] text-[#8a7d6e]
                     flex items-center justify-center hover:border-[#c9a84c] hover:text-[#e8ddd0]
                     transition-colors text-base leading-none"
        >
          −
        </button>
        <input
          name={name}
          inputMode="numeric"
          value={value === 0 ? '' : String(value)}
          placeholder="0"
          onChange={e => {
            const n = parseInt(e.target.value, 10);
            onChange(isNaN(n) || n < 0 ? 0 : n);
          }}
          className="w-14 bg-[#231f1c] border border-[#3d3530] rounded px-2 py-2
                     text-[#e8ddd0] text-base focus:outline-none focus:border-[#c9a84c]
                     text-center placeholder:text-[#5a4f46]"
        />
        <button
          type="button"
          onClick={() => onChange(value + 1)}
          className="w-7 h-7 rounded-full bg-[#231f1c] border border-[#3d3530] text-[#8a7d6e]
                     flex items-center justify-center hover:border-[#c9a84c] hover:text-[#e8ddd0]
                     transition-colors text-base leading-none"
        >
          +
        </button>
      </div>
    </div>
  );
}

export default function InventoryCreateForm({ onCreated }: Props) {
  const [preview, setPreview] = useState<string | null>(null);
  const [statType, setStatType] = useState('');
  const [price, setPrice] = useState(0);
  const [statValue, setStatValue] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function handleFile(file: File) {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(URL.createObjectURL(file));
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      if (fileRef.current) {
        const dt = new DataTransfer();
        dt.items.add(file);
        fileRef.current.files = dt.files;
      }
      handleFile(file);
    }
  }

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);

    const form = formRef.current;
    if (!form) return;
    const fd = new FormData(form);

    // Don't submit stat_value if no stat type is selected
    if (!statType) fd.delete('stat_value');

    try {
      const res = await fetch('/api/items', { method: 'POST', body: fd });
      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error ?? 'Failed to create item');
      }
      form.reset();
      setPreview(null);
      setStatType('');
      setPrice(0);
      setStatValue(0);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="px-6 pt-5 pb-6 relative">
      {/* Submit button — top-right corner */}
      <button
        type="submit"
        disabled={saving}
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-[#c9a84c] text-black text-xl
                   font-bold flex items-center justify-center hover:bg-[#e0bc5a]
                   disabled:opacity-50 transition-colors"
      >
        +
      </button>

      {/* Header */}
      <div className="flex items-baseline gap-3 mb-4 pr-12">
        <h2 className="font-serif text-[1.3rem] italic text-[#e8ddd0] leading-none tracking-tight">
          Create Item
        </h2>
        <p className="text-[0.65rem] uppercase tracking-[0.22em] text-[#8a7d6e]">
          Add a new item to inventory
        </p>
      </div>
      <div className="border-t border-[#3d3530] mb-4" />

      <div className="flex gap-6 items-center flex-wrap">
        {/* Drop zone — gold border, vertically centered */}
        <div
          onDragOver={e => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className="w-24 h-24 rounded-full border-2 border-dashed border-[#c9a84c]
                     flex items-center justify-center cursor-pointer overflow-hidden
                     hover:border-[#e0bc5a] transition-colors flex-shrink-0"
        >
          {preview ? (
            <img src={preview} alt="preview" className="w-full h-full object-cover" />
          ) : (
            <span className="text-[#c9a84c] text-[0.6rem] text-center leading-tight px-2">
              Drop image
            </span>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          name="image"
          accept="image/*"
          className="hidden"
          onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
        />

        {/* Fields */}
        <div className="flex flex-col gap-3 flex-1 min-w-[200px]">
          {/* Row 1: Title + Price (gold) */}
          <div className="flex gap-3 items-end">
            <input
              name="title"
              required
              placeholder="Title"
              className="flex-1 bg-[#231f1c] border border-[#3d3530] rounded px-3 py-2
                         text-[#e8ddd0] text-sm placeholder:text-[#5a4f46] focus:outline-none
                         focus:border-[#c9a84c]"
            />
            <StepCounter label="Price (gold)" name="price" value={price} onChange={setPrice} />
          </div>

          {/* Row 2: Increases radio buttons + Increase (points) counter */}
          <div className="flex gap-3 items-end">
            <div className="flex gap-1.5 flex-1">
              {STAT_OPTIONS.map(opt => (
                <label key={opt.value} className="flex-1 cursor-pointer">
                  <input
                    type="radio"
                    name="stat_type"
                    value={opt.value}
                    checked={statType === opt.value}
                    onChange={() => setStatType(statType === opt.value ? '' : opt.value)}
                    className="sr-only"
                  />
                  <span className={`w-full flex items-center justify-center py-2 rounded text-xs border transition-colors
                    ${statType === opt.value
                      ? 'bg-[#c9a84c] text-black border-[#c9a84c]'
                      : 'bg-[#231f1c] text-[#8a7d6e] border-[#3d3530] hover:border-[#c9a84c] hover:text-[#e8ddd0]'}`}>
                    {opt.label}
                  </span>
                </label>
              ))}
            </div>
            <StepCounter label="Increase (points)" name="stat_value" value={statValue} onChange={setStatValue} />
          </div>

          <textarea
            name="description"
            rows={2}
            placeholder="Description (shown on hover)"
            className="bg-[#231f1c] border border-[#3d3530] rounded px-3 py-1.5
                       text-[#e8ddd0] text-sm placeholder:text-[#5a4f46] focus:outline-none
                       focus:border-[#c9a84c] resize-none"
          />
        </div>
      </div>

      {error && (
        <p className="mt-3 text-red-400 text-xs">{error}</p>
      )}
    </form>
  );
}
