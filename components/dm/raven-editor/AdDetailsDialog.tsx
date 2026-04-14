'use client';

import { useState } from 'react';

/**
 * Modal that pops up after an ad image has been uploaded. Collects the real
 * product URL + overlay text (e.g. "ONLY $15!!!") and creates a
 * raven_ad_products row via /api/raven-post/ads.
 *
 * Cancel discards the image (DM can re-drop). Submit stores the ad and
 * returns the new product id to the editor so it can set `ad_product_id`
 * on the draft.
 */

interface Props {
  imageUrl: string;
  onCancel: () => void;
  onSubmit: (adProductId: string) => void;
}

export default function AdDetailsDialog({ imageUrl, onCancel, onSubmit }: Props) {
  const [realUrl, setRealUrl] = useState('');
  const [overlay, setOverlay] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!realUrl.trim()) { setError('Real URL is required'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/raven-post/ads', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          image_url: imageUrl,
          real_url: realUrl.trim(),
          overlay_text: overlay.trim(),
        }),
      });
      if (!res.ok) {
        const { error: msg } = await res.json().catch(() => ({ error: 'Save failed' }));
        setError(msg ?? 'Save failed');
        return;
      }
      const { id } = await res.json() as { id: string };
      onSubmit(id);
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onCancel}
    >
      <form
        onClick={e => e.stopPropagation()}
        onSubmit={handleSubmit}
        style={{
          width: 420,
          background: 'var(--color-surface, #1f1a17)',
          border: '1px solid var(--color-border, #3d2e22)',
          color: 'var(--color-text, #e8dfc5)',
          padding: 20,
          fontFamily: 'EB Garamond, serif',
        }}
      >
        <h3 style={{ margin: '0 0 12px', color: 'var(--color-gold, #c9a84c)', fontSize: '1.1rem' }}>
          Ad details
        </h3>

        <img
          src={imageUrl}
          alt=""
          style={{
            width: '100%',
            height: 120,
            objectFit: 'cover',
            border: '1px solid var(--color-border, #3d2e22)',
            marginBottom: 12,
          }}
        />

        <label style={{ display: 'block', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 4 }}>
          Real URL <span style={{ color: '#c07a8a' }}>*</span>
        </label>
        <input
          type="url"
          value={realUrl}
          onChange={e => setRealUrl(e.target.value)}
          placeholder="https://dnddice.com/products/..."
          required
          autoFocus
          style={{
            width: '100%',
            background: 'var(--color-bg-card, #1a1410)',
            border: '1px solid var(--color-border, #3d2e22)',
            color: 'var(--color-text, #e8dfc5)',
            padding: '8px 10px',
            fontFamily: 'EB Garamond, serif',
            marginBottom: 12,
          }}
        />

        <label style={{ display: 'block', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 4 }}>
          Overlay text <span style={{ fontStyle: 'italic', textTransform: 'none', letterSpacing: 0, color: '#8b7a5a' }}>(optional — e.g. "ONLY $15!!!")</span>
        </label>
        <input
          type="text"
          value={overlay}
          onChange={e => setOverlay(e.target.value)}
          placeholder="ONLY $15!!!"
          style={{
            width: '100%',
            background: 'var(--color-bg-card, #1a1410)',
            border: '1px solid var(--color-border, #3d2e22)',
            color: 'var(--color-text, #e8dfc5)',
            padding: '8px 10px',
            fontFamily: 'EB Garamond, serif',
            marginBottom: 12,
          }}
        />

        {error && <p style={{ color: '#c07a8a', fontSize: '0.85rem', margin: '0 0 12px' }}>{error}</p>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            style={{
              background: 'transparent',
              border: '1px solid var(--color-border, #3d2e22)',
              color: 'var(--color-text, #e8dfc5)',
              padding: '6px 14px',
              fontFamily: 'EB Garamond, serif',
              fontSize: '0.85rem',
              cursor: saving ? 'wait' : 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            style={{
              background: 'var(--color-gold, #c9a84c)',
              border: 'none',
              color: '#1a1410',
              padding: '6px 14px',
              fontFamily: 'EB Garamond, serif',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: saving ? 'wait' : 'pointer',
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? 'Saving…' : 'Save ad'}
          </button>
        </div>
      </form>
    </div>
  );
}
