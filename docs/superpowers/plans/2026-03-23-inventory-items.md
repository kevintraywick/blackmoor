# Inventory Items — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** DM can create items with image, title, price, stat, and description on `/dm/inventory`; items appear as 96px circles with badges and hover tooltip.

**Architecture:** Railway Volume at `/data/uploads/items/` for images; Postgres `items` table; Next.js API routes for CRUD + file serving; two client components (`InventoryCreateForm`, `InventoryItemGrid`) embedded in the existing inventory page.

**Tech Stack:** Next.js 15 App Router, TypeScript, Tailwind CSS v4, `fs` (Node), Postgres via `lib/db.ts`

---

### Task 1: DB schema — add `items` table

**Files:**
- Modify: `lib/schema.ts`

- [ ] **Read `lib/schema.ts`** to understand existing `ensureSchema` function

- [ ] **Add `items` table SQL** inside `ensureSchema`:

```sql
CREATE TABLE IF NOT EXISTS items (
  id          SERIAL PRIMARY KEY,
  title       TEXT        NOT NULL,
  price       INTEGER     NOT NULL,
  description TEXT,
  stat_type   TEXT        CHECK (stat_type IN ('heal', 'magic', 'attack')),
  stat_value  INTEGER,
  image_path  TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);
```

- [ ] **Verify** the SQL is inside the same `ensureSchema` transaction/call as other tables

- [ ] **Commit**

```bash
git add lib/schema.ts
git commit -m "feat: add items table to schema"
```

---

### Task 2: GET and POST `/api/items` route

**Files:**
- Create: `app/api/items/route.ts`

- [ ] **Create `app/api/items/route.ts`**:

```typescript
import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { ensureSchema } from '@/lib/schema';
import { writeFile, mkdir } from 'fs/promises';
import { join, extname } from 'path';
import { randomUUID } from 'crypto';

const UPLOAD_DIR = '/data/uploads/items';

export async function GET() {
  await ensureSchema();
  const rows = await query('SELECT * FROM items ORDER BY created_at DESC');
  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  await ensureSchema();
  const formData = await request.formData();

  const image = formData.get('image') as File | null;
  const title = formData.get('title') as string;
  const price = parseInt(formData.get('price') as string, 10);
  const description = (formData.get('description') as string) || null;
  const statType = (formData.get('stat_type') as string) || null;
  const statValue = formData.get('stat_value')
    ? parseInt(formData.get('stat_value') as string, 10)
    : null;

  if (!title || isNaN(price)) {
    return NextResponse.json({ error: 'title and price are required' }, { status: 400 });
  }

  let imagePath: string | null = null;

  if (image && image.size > 0) {
    await mkdir(UPLOAD_DIR, { recursive: true });
    const ext = extname(image.name) || '.png';
    const filename = `${randomUUID()}${ext}`;
    const buffer = Buffer.from(await image.arrayBuffer());
    await writeFile(join(UPLOAD_DIR, filename), buffer);
    imagePath = `uploads/items/${filename}`;
  }

  const rows = await query(
    `INSERT INTO items (title, price, description, stat_type, stat_value, image_path)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [title, price, description, statType || null, statValue, imagePath]
  );

  return NextResponse.json(rows[0], { status: 201 });
}
```

- [ ] **Commit**

```bash
git add app/api/items/route.ts
git commit -m "feat: add GET/POST /api/items route"
```

---

### Task 3: File-serving route `/api/uploads/items/[filename]`

**Files:**
- Create: `app/api/uploads/items/[filename]/route.ts`

- [ ] **Create the route**:

```typescript
import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join, extname } from 'path';

const UPLOAD_DIR = '/data/uploads/items';

const MIME: Record<string, string> = {
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif':  'image/gif',
};

interface Props {
  params: Promise<{ filename: string }>;
}

export async function GET(_: Request, { params }: Props) {
  const { filename } = await params;

  // Prevent path traversal
  if (filename.includes('/') || filename.includes('..')) {
    return new NextResponse('Not found', { status: 404 });
  }

  try {
    const buffer = await readFile(join(UPLOAD_DIR, filename));
    const ext = extname(filename).toLowerCase();
    const contentType = MIME[ext] ?? 'application/octet-stream';
    return new NextResponse(buffer, {
      headers: { 'Content-Type': contentType },
    });
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }
}
```

- [ ] **Commit**

```bash
git add "app/api/uploads/items/[filename]/route.ts"
git commit -m "feat: add file-serving route for item images"
```

---

### Task 4: `InventoryCreateForm` client component

**Files:**
- Create: `components/InventoryCreateForm.tsx`

- [ ] **Create component**:

```typescript
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

    const form = formRef.current!;
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
```

- [ ] **Commit**

```bash
git add components/InventoryCreateForm.tsx
git commit -m "feat: add InventoryCreateForm client component"
```

---

### Task 5: `InventoryItemGrid` client component

**Files:**
- Create: `components/InventoryItemGrid.tsx`

- [ ] **Define item type and stat badge helper**, then create component:

```typescript
'use client';

import { useEffect, useState, useCallback } from 'react';

interface Item {
  id: number;
  title: string;
  price: number;
  description: string | null;
  stat_type: 'heal' | 'magic' | 'attack' | null;
  stat_value: number | null;
  image_path: string | null;
}

function statBadgeClass(type: Item['stat_type']): string {
  if (type === 'heal')   return 'bg-red-700 text-white';
  if (type === 'magic')  return 'bg-blue-700 text-green-300';
  if (type === 'attack') return 'bg-neutral-800 text-red-400';
  return '';
}

interface Props {
  refreshKey: number;
}

export default function InventoryItemGrid({ refreshKey }: Props) {
  const [items, setItems] = useState<Item[]>([]);

  const load = useCallback(async () => {
    const res = await fetch('/api/items');
    if (res.ok) setItems(await res.json());
  }, []);

  useEffect(() => { load(); }, [load, refreshKey]);

  if (items.length === 0) {
    return (
      <p className="text-[#5a4f46] text-sm italic">No items yet.</p>
    );
  }

  return (
    <div className="flex flex-wrap gap-6">
      {items.map(item => (
        <div key={item.id} className="flex flex-col items-center">
          <div className="relative group w-24 h-24 rounded-full overflow-hidden border border-[#3d3530]">
            {item.image_path ? (
              <img
                src={`/api/${item.image_path}`}
                alt={item.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-[#2a2420]" />
            )}

            {/* Gold price badge */}
            <div className="absolute bottom-0.5 right-0.5 w-6 h-6 rounded-full bg-[#c9a84c]
                            flex items-center justify-center text-[9px] font-bold text-black
                            border border-[#1a1614]">
              {item.price}
            </div>

            {/* Stat badge */}
            {item.stat_type && item.stat_value !== null && (
              <div className={`absolute bottom-0.5 left-0.5 w-6 h-6 rounded-full
                              flex items-center justify-center text-[9px] font-bold
                              border border-[#1a1614] ${statBadgeClass(item.stat_type)}`}>
                {item.stat_value}
              </div>
            )}

            {/* Hover tooltip */}
            {item.description && (
              <div className="absolute inset-0 invisible group-hover:visible
                              bg-black/85 flex items-center justify-center p-2
                              text-[10px] text-[#e8ddd0] text-center leading-tight">
                {item.description}
              </div>
            )}
          </div>

          <p className="text-[0.65rem] text-center text-[#e8ddd0] mt-1 w-24 truncate">
            {item.title}
          </p>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Commit**

```bash
git add components/InventoryItemGrid.tsx
git commit -m "feat: add InventoryItemGrid client component"
```

---

### Task 6: Wire up `/dm/inventory` page

**Files:**
- Modify: `app/dm/inventory/page.tsx`

- [ ] **Read `app/dm/inventory/page.tsx`** first

- [ ] **Create a client wrapper** `InventoryPageClient` inline or in a separate file that holds `refreshKey` state and passes `onCreated` / `refreshKey` props:

```typescript
// app/dm/inventory/page.tsx
import DmNav from '@/components/DmNav';
import InventoryPageClient from '@/components/InventoryPageClient';

export default function InventoryPage() {
  return (
    <div className="min-h-screen bg-[#1a1614] text-[#e8ddd0]">
      <DmNav current="inventory" />
      <div className="max-w-[780px] mx-auto px-8 py-10">
        <InventoryPageClient />
      </div>
    </div>
  );
}
```

- [ ] **Create `components/InventoryPageClient.tsx`**:

```typescript
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
```

- [ ] **Commit**

```bash
git add app/dm/inventory/page.tsx components/InventoryPageClient.tsx
git commit -m "feat: wire up inventory page with create form and item grid"
```

---

## Done

Verify end-to-end:
1. Visit `/dm/inventory`
2. Drop an image, fill in title + price + description, optionally set a stat, press `+`
3. Item circle appears in grid below with gold badge, optional stat badge, and hover tooltip
4. Image is served from `/api/uploads/items/[filename]`
