# Inventory Items — Design Spec

**Date:** 2026-03-23

---

## Goal

Allow the DM to create inventory items on `/dm/inventory`. Items have an image, title, gold price, optional stat badge (heal/magic/attack), and a description. Created items appear as 96px circles in the inventory grid. Images are stored on Railway Volume at `/data/uploads/items/`.

---

## Data Model

New table `items` in Postgres:

```sql
CREATE TABLE items (
  id          SERIAL PRIMARY KEY,
  title       TEXT        NOT NULL,
  price       INTEGER     NOT NULL,        -- gold coins
  description TEXT,
  stat_type   TEXT        CHECK (stat_type IN ('heal', 'magic', 'attack')),
  stat_value  INTEGER,
  image_path  TEXT,                        -- relative: 'uploads/items/<filename>'
  created_at  TIMESTAMPTZ DEFAULT now()
);
```

`stat_type` and `stat_value` are both nullable — items without a stat get no bottom-left badge.

---

## API Routes

### `POST /api/items`
- Content-Type: `multipart/form-data`
- Fields: `image` (file), `title`, `price`, `description`, `stat_type` (optional), `stat_value` (optional)
- Saves image to `/data/uploads/items/<uuid>.<ext>`
- Inserts row into `items` table
- Returns created item as JSON

### `GET /api/items`
- Returns all items ordered by `created_at DESC` as JSON array

### `GET /api/uploads/items/[filename]`
- Streams file from `/data/uploads/items/[filename]`
- Sets appropriate `Content-Type` header
- Returns 404 if file not found

---

## Schema Migration

`ensureSchema()` in `lib/schema.ts` gains the `items` table creation SQL (idempotent `CREATE TABLE IF NOT EXISTS`).

---

## UI: `/dm/inventory` Page Layout

Two panes, top to bottom:

1. **Create pane** — smaller, `min-h-[200px]`
2. **Inventory pane** — item grid, `min-h-[480px]`

Both share `border border-[#3d3530] rounded bg-[#7a3c10]` styling with a gap between them.

---

## Create Pane — `InventoryCreateForm` (client component)

Fields:
- **Image drop zone**: `400×120px` dashed-border area. Accepts drag-drop or click-to-browse. Shows thumbnail preview once an image is selected. Accepts `.png`, `.jpg`, `.webp`, `.gif`.
- **Title**: text input
- **Price**: number input, label "Gold"
- **Stat type**: `<select>` — options: `(none)`, `Heal`, `Magic`, `Attack`
- **Stat value**: number input, only shown/required when stat type is not none
- **Description**: `<textarea>`, 3 rows
- **`+` button**: submits form via `fetch` POST with `FormData`

On submit:
- Disable button, show "Saving…"
- POST to `/api/items`
- On success: reset form, trigger inventory grid refresh
- On error: show inline error message

---

## Inventory Pane — `InventoryItemGrid` (client component)

Fetches `GET /api/items` on mount and after each successful create.

Renders items in a `flex flex-wrap gap-6` grid.

### Item Card

```
┌─────────────────────┐
│   [96px circle]     │
│  ┌─────────────┐    │
│  │    image    │    │
│  └─────────────┘    │
│     Title text      │
└─────────────────────┘
```

Structure (relative wrapper, 96px circle):

```
<div class="relative group w-24 h-24 rounded-full overflow-hidden">
  <img src="/api/uploads/items/[filename]" class="object-cover w-full h-full" />

  <!-- Gold badge: bottom-right -->
  <div class="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-[#c9a84c]
              flex items-center justify-center text-[9px] font-bold text-black">
    {price}
  </div>

  <!-- Stat badge: bottom-left (conditional) -->
  <!-- heal:   bg-red-700 text-white -->
  <!-- magic:  bg-blue-700 text-green-300 -->
  <!-- attack: bg-neutral-800 text-red-400 -->
  <div class="absolute bottom-0 left-0 w-6 h-6 rounded-full
              flex items-center justify-center text-[9px] font-bold">
    {stat_value}
  </div>

  <!-- Hover tooltip -->
  <div class="absolute inset-0 invisible group-hover:visible
              bg-black/80 flex items-center justify-center p-2
              text-[10px] text-[#e8ddd0] text-center leading-tight">
    {description}
  </div>
</div>
<p class="text-[0.65rem] text-center text-[#e8ddd0] mt-1 w-24 truncate">{title}</p>
```

---

## File Structure

```
app/
  api/
    items/
      route.ts              (GET, POST)
    uploads/
      items/
        [filename]/
          route.ts          (GET — file streaming)
  dm/
    inventory/
      page.tsx              (server component, updated)
components/
  InventoryCreateForm.tsx   (client)
  InventoryItemGrid.tsx     (client)
lib/
  schema.ts                 (updated — adds items table)
```

---

## Constraints & Notes

- Images live at `/data/uploads/items/` on the Railway Volume. The directory is created on first upload if it doesn't exist (`fs.mkdirSync(..., { recursive: true })`).
- No image resizing — store as-is, display via CSS `object-cover`.
- No delete/edit for items in this spec — inventory is append-only for now.
- `stat_value` is an integer (e.g. `+5` heal, `+3` magic, `+7` attack). Display as bare number.
- The inventory page itself remains a server component; create form and grid are client components embedded in it.
