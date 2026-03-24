'use client';

import { useRef, useState } from 'react';

interface Props {
  onCreated: () => void;
}

export default function InventoryCreateForm({ onCreated }: Props) {
  const [preview, setPreview] = useState<string | null>(null);
  const [statType, setStatType] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function handleFile(file: File) {
    if (preview) {
      URL.revokeObjectURL(preview);
    }
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);

    const form = formRef.current;
    if (!form) return;
    const fd = new FormData(form);

    try {
      const res = await fetch('/api/items', { method: 'POST', body: fd });
      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error ?? 'Failed to create item');
      }
      form.reset();
      setPreview(null);
      setStatType('');
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="px-6 pt-5 pb-6">
      <h2 className="font-serif text-[1.3rem] italic text-[#e8ddd0] leading-none tracking-tight mb-1">
        Create Item
      </h2>
      <p className="text-[0.65rem] uppercase tracking-[0.22em] text-[#8a7d6e] mb-4">
        Add a new item to inventory
      </p>
      <div className="border-t border-[#3d3530] mb-4" />

      <div className="flex gap-6 items-start flex-wrap">
        {/* Drop zone */}
        <div
          onDragOver={e => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className="w-24 h-24 rounded-full border-2 border-dashed border-[#3d3530]
                     flex items-center justify-center cursor-pointer overflow-hidden
                     hover:border-[#c9a84c] transition-colors flex-shrink-0"
        >
          {preview ? (
            <img src={preview} alt="preview" className="w-full h-full object-cover" />
          ) : (
            <span className="text-[#8a7d6e] text-[0.6rem] text-center leading-tight px-2">
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
        <div className="flex flex-col gap-2 flex-1 min-w-[200px]">
          <div className="flex gap-3">
            <input
              name="title"
              required
              placeholder="Title"
              className="flex-1 bg-[#231f1c] border border-[#3d3530] rounded px-3 py-1.5
                         text-[#e8ddd0] text-sm placeholder:text-[#5a4f46] focus:outline-none
                         focus:border-[#c9a84c]"
            />
            <input
              name="price"
              type="number"
              min="0"
              required
              placeholder="Gold"
              className="w-20 bg-[#231f1c] border border-[#3d3530] rounded px-3 py-1.5
                         text-[#e8ddd0] text-sm placeholder:text-[#5a4f46] focus:outline-none
                         focus:border-[#c9a84c]"
            />
          </div>

          <div className="flex gap-3">
            <select
              name="stat_type"
              value={statType}
              onChange={e => setStatType(e.target.value)}
              className="w-28 bg-[#231f1c] border border-[#3d3530] rounded px-3 py-1.5
                         text-[#e8ddd0] text-sm focus:outline-none focus:border-[#c9a84c]"
            >
              <option value="">No stat</option>
              <option value="heal">Heal</option>
              <option value="magic">Magic</option>
              <option value="attack">Attack</option>
            </select>
            {statType && (
              <input
                name="stat_value"
                type="number"
                required
                placeholder="Value"
                className="w-20 bg-[#231f1c] border border-[#3d3530] rounded px-3 py-1.5
                           text-[#e8ddd0] text-sm placeholder:text-[#5a4f46] focus:outline-none
                           focus:border-[#c9a84c]"
              />
            )}
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

        {/* Submit */}
        <button
          type="submit"
          disabled={saving}
          className="self-center w-10 h-10 rounded-full bg-[#c9a84c] text-black text-xl
                     font-bold flex items-center justify-center hover:bg-[#e0bc5a]
                     disabled:opacity-50 transition-colors flex-shrink-0"
        >
          +
        </button>
      </div>

      {error && (
        <p className="mt-3 text-red-400 text-xs">{error}</p>
      )}
    </form>
  );
}
