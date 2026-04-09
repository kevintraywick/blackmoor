'use client';

import type { RavenItem } from '@/lib/types';

interface Props {
  item: RavenItem;
  onClose: () => void;
}

// Modal that reveals the real-world details of an in-fiction ad on click.
// The ad's printed body stays in-fiction; only here do real-world price /
// link / vendor info show.
export default function RavenAdModal({ item, onClose }: Props) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        className="bg-[var(--color-surface)] border border-[var(--color-border)] p-6 max-w-[420px] w-full"
        style={{ borderRadius: 0 }}
      >
        <div className="flex justify-between items-start mb-3">
          <h3 className="font-serif text-[var(--color-gold)] text-base">In the workshop</h3>
          <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-gold)] text-xl leading-none">×</button>
        </div>
        {item.ad_image_url && (
          // Use plain <img> not next/image — uploaded paths can carry query strings
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.ad_image_url}
            alt=""
            style={{ width: '100%', height: 'auto', marginBottom: 12 }}
          />
        )}
        {item.ad_real_copy && (
          <p className="font-serif text-[var(--color-text)] text-sm mb-3">{item.ad_real_copy}</p>
        )}
        {item.ad_real_link && (
          <a
            href={item.ad_real_link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-4 py-2 border border-[var(--color-gold)] text-[var(--color-gold)] hover:bg-[rgba(201,168,76,0.1)] font-serif text-sm uppercase tracking-widest"
          >
            View →
          </a>
        )}
      </div>
    </div>
  );
}
