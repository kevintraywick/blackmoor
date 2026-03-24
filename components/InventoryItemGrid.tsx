'use client';

import { useEffect, useState, useCallback } from 'react';

interface Item {
  id: number;
  title: string;
  price: number;
  description: string | null;
  stat_type: 'heal' | 'magic' | 'attack' | 'damage' | null;
  stat_value: number | null;
  image_path: string | null;
  in_marketplace: boolean;
}

function statBadgeClass(type: Item['stat_type']): string {
  if (type === 'heal')   return 'bg-red-700 text-white';
  if (type === 'magic')  return 'bg-blue-700 text-green-300';
  if (type === 'attack') return 'bg-neutral-800 text-red-400';
  if (type === 'damage') return 'bg-orange-800 text-orange-200';
  return '';
}

interface Props {
  refreshKey: number;
  selectedItemId: number | null;
  onSelect: (id: number) => void;
}

export default function InventoryItemGrid({ refreshKey, selectedItemId, onSelect }: Props) {
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
        <div
          key={item.id}
          className="flex flex-col items-center cursor-pointer"
          onClick={() => onSelect(item.id)}
        >
          {/* Outer wrapper: selection ring + badge positioning context */}
          <div className={`relative group w-24 h-24 rounded-full transition-all
            ${selectedItemId === item.id
              ? 'ring-2 ring-[#c9a84c] ring-offset-2 ring-offset-[#2e3a4a]'
              : ''}`}>

            {/* Inner circle: clips image and tooltip */}
            <div className="absolute inset-0 rounded-full overflow-hidden border border-[#3d3530]">
              {item.image_path ? (
                <img
                  src={`/api/${item.image_path}`}
                  alt={item.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-[#2a2420]" />
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

            {/* Gold price badge — bottom-LEFT, black text on gold */}
            <div className="absolute -bottom-1 -left-1 w-6 h-6 rounded-full bg-[#c9a84c]
                            flex items-center justify-center text-[9px] font-bold text-black
                            border border-[#1a1614] z-10">
              {item.price}
            </div>

            {/* Stat badge — bottom-RIGHT */}
            {item.stat_type && item.stat_value !== null && (
              <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full
                              flex items-center justify-center text-[9px] font-bold
                              border border-[#1a1614] z-10 ${statBadgeClass(item.stat_type)}`}>
                {item.stat_value}
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
