'use client';

import { resolveImageUrl } from '@/lib/imageUrl';

export interface CardFields {
  itemType: 'magic_item' | 'scroll' | 'spell';
  title: string;
  description: string;
  price: string;
  attack: string;
  damage: string;
  heal: string;
  rarity: string;
  attunement: boolean;
  level: string;
  school: string;
  castingTime: string;
  range: string;
  components: string;
  duration: string;
  imagePreview: string | null;   // blob URL or resolved path
  existingImagePath: string | null;
}

const TYPE_LABELS: Record<string, string> = {
  magic_item: 'Magic Item',
  scroll: 'Scroll',
  spell: 'Spell',
};

const TYPE_COLORS: Record<string, string> = {
  magic_item: '#7b2d8e',
  scroll: '#6b4f0e',
  spell: '#a88a3a',
};

function StatBlock({ label, value }: { label: string; value: string }) {
  const n = parseInt(value, 10) || 0;
  if (n === 0) return null;
  return (
    <div className="flex flex-col items-center">
      <span style={{ fontSize: 11, color: '#6b5c4a', fontFamily: 'var(--font-sans)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {label}
      </span>
      <span style={{ fontSize: 22, fontWeight: 700, color: '#3a2e22', fontFamily: 'var(--font-serif)' }}>
        +{n}
      </span>
    </div>
  );
}

export default function CardPreview({ fields }: { fields: CardFields }) {
  const { itemType, title, description, price, attack, damage, heal, rarity, attunement, level, school, castingTime, range, components, duration, imagePreview, existingImagePath } = fields;

  const imgSrc = imagePreview || (existingImagePath ? resolveImageUrl(existingImagePath) : null);
  const hasTitle = title.trim().length > 0;
  const priceNum = parseInt(price, 10) || 0;

  return (
    <div
      className="relative flex-shrink-0"
      style={{
        width: 340,
        height: 480,
        backgroundImage: 'url(/images/inventory/spell_cards/card_bg.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        borderRadius: 8,
      }}
    >
      {/* Inner content area — positioned within the ornate border */}
      <div className="absolute flex flex-col items-center" style={{ top: 32, left: 32, right: 32, bottom: 32 }}>

        {/* Item image */}
        <div
          className="rounded-full overflow-hidden border-2 flex items-center justify-center"
          style={{
            width: 90, height: 90,
            borderColor: TYPE_COLORS[itemType] || '#8a7452',
            backgroundColor: imgSrc ? 'transparent' : 'rgba(0,0,0,0.08)',
          }}
        >
          {imgSrc ? (
            <img src={imgSrc} alt={title || 'item'} className="w-full h-full object-cover" />
          ) : (
            <span style={{ fontSize: 10, color: '#8a7452', textAlign: 'center', padding: 8 }}>No image</span>
          )}
        </div>

        {/* Title */}
        <h3
          className="text-center font-serif font-bold leading-tight mt-2"
          style={{ fontSize: hasTitle ? 18 : 14, color: hasTitle ? '#2a1f14' : '#a08a6e', maxWidth: '100%' }}
        >
          {hasTitle ? title : 'Name your item...'}
        </h3>

        {/* Type badge */}
        <div
          className="rounded-full px-3 py-0.5 mt-1"
          style={{ backgroundColor: TYPE_COLORS[itemType], fontSize: 10, color: '#fff', fontFamily: 'var(--font-sans)', textTransform: 'uppercase', letterSpacing: '0.1em' }}
        >
          {TYPE_LABELS[itemType]}
        </div>

        {/* Type-specific fields */}
        <div className="mt-3 w-full flex flex-col items-center gap-1" style={{ flex: 1, minHeight: 0 }}>
          {itemType === 'magic_item' && (
            <>
              {rarity && (
                <span style={{ fontSize: 12, color: '#5a4a36', fontFamily: 'var(--font-serif)', fontStyle: 'italic' }}>
                  {rarity}{attunement ? ' (requires attunement)' : ''}
                </span>
              )}
              <div className="flex gap-4 mt-1">
                <StatBlock label="ATK" value={attack} />
                <StatBlock label="DMG" value={damage} />
                <StatBlock label="HEAL" value={heal} />
              </div>
            </>
          )}

          {(itemType === 'scroll' || itemType === 'spell') && (
            <div className="flex gap-3 items-center" style={{ fontSize: 12, color: '#5a4a36', fontFamily: 'var(--font-serif)' }}>
              {level && <span>Level {level}</span>}
              {school && <span style={{ fontStyle: 'italic' }}>{school}</span>}
            </div>
          )}

          {itemType === 'spell' && (castingTime || range || components || duration) && (
            <div className="w-full mt-1 grid gap-x-3 gap-y-0.5" style={{ gridTemplateColumns: '1fr 1fr', fontSize: 10, color: '#6b5c4a', fontFamily: 'var(--font-sans)' }}>
              {castingTime && <div><span className="font-bold">Cast:</span> {castingTime}</div>}
              {range && <div><span className="font-bold">Range:</span> {range}</div>}
              {components && <div><span className="font-bold">Comp:</span> {components}</div>}
              {duration && <div><span className="font-bold">Dur:</span> {duration}</div>}
            </div>
          )}

          {/* Description */}
          {description && (
            <p
              className="mt-2 text-center leading-snug"
              style={{
                fontSize: 11,
                color: '#3a2e22',
                fontFamily: 'var(--font-serif)',
                maxWidth: '100%',
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 5,
                WebkitBoxOrient: 'vertical',
              }}
            >
              {description}
            </p>
          )}
        </div>

        {/* Price at bottom */}
        <div className="flex items-center gap-1 mt-auto pt-2">
          <img src="/images/inventory/gold_coin.jpg" alt="" className="rounded-full" style={{ width: 16, height: 16 }} />
          <span style={{ fontSize: 14, fontWeight: 700, color: '#3a2e22', fontFamily: 'var(--font-serif)' }}>
            {priceNum > 0 ? priceNum : '—'}
          </span>
        </div>
      </div>
    </div>
  );
}
