'use client';

import { useState, type DragEvent } from 'react';
import { useRouter } from 'next/navigation';

// Drop target on the DM Campaign page for uploading home splash art and
// campaign banner images. Classification by filename substring:
//   *splash*  → home splash slot (app/page.tsx background)
//   *banner*  → campaign banner slot (DM Campaign page header image)
//   neither / both → popover with radio selectors (Splash / Banner / Other)
//
// On successful upload, the relevant campaign column is set server-side and
// we call router.refresh() so the banner above this panel rerenders.

type Slot = 'splash' | 'banner' | 'other';

export default function HomeArtDropCircle() {
  const router = useRouter();
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<File | null>(null);
  const [pendingSlot, setPendingSlot] = useState<Slot>('splash');

  async function upload(file: File, slot: Slot) {
    setUploading(true);
    setError(null);
    setStatus(null);
    try {
      const fd = new FormData();
      fd.append('image', file);
      fd.append('slot', slot);
      const res = await fetch('/api/uploads/splash', { method: 'POST', body: fd });
      const data = (await res.json()) as { path?: string; filename?: string; error?: string };
      if (!res.ok) {
        setError(data.error ?? 'Upload failed');
        return;
      }
      if (slot === 'splash') setStatus('Set as home splash');
      else if (slot === 'banner') setStatus('Set as campaign banner');
      else setStatus(`Saved as ${data.filename}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  function classify(file: File): Slot | null {
    const lower = file.name.toLowerCase();
    const hasSplash = lower.includes('splash');
    const hasBanner = lower.includes('banner');
    if (hasSplash && !hasBanner) return 'splash';
    if (hasBanner && !hasSplash) return 'banner';
    return null;
  }

  function handleFile(file: File) {
    setError(null);
    setStatus(null);
    if (!file.type.startsWith('image/')) {
      setError('That doesn’t look like an image.');
      return;
    }
    const slot = classify(file);
    if (slot) {
      upload(file, slot);
      return;
    }
    // Ambiguous — open the radio dialog
    setPending(file);
    setPendingSlot('splash');
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  function confirmPending() {
    if (!pending) return;
    const file = pending;
    const slot = pendingSlot;
    setPending(null);
    upload(file, slot);
  }

  function cancelPending() {
    setPending(null);
  }

  return (
    <div className="flex flex-col items-center gap-4 relative">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className="rounded-full flex items-center justify-center transition-transform"
        style={{
          width: 64,
          height: 64,
          border: `2px dashed ${dragOver ? '#4a7a5a' : 'rgba(201,168,76,0.4)'}`,
          background: '#2e2825',
          transform: dragOver ? 'scale(1.05)' : 'scale(1)',
          cursor: uploading ? 'wait' : 'copy',
        }}
        title="Drop a splash or banner image"
      >
        <span className="text-[var(--color-gold)] text-xl leading-none">⬇</span>
      </div>
      <span className="text-[0.7rem] uppercase tracking-[0.15em] text-[var(--color-text-muted)] font-sans">
        Home Art
      </span>

      {uploading && (
        <span className="text-[0.65rem] text-[var(--color-text-muted)] font-sans">Uploading…</span>
      )}
      {status && !uploading && (
        <span className="text-[0.65rem] text-[var(--color-gold)] font-sans">{status}</span>
      )}
      {error && (
        <span className="text-[0.65rem] text-[#c07a8a] font-sans text-center max-w-[200px]">{error}</span>
      )}

      {/* Radio dialog for ambiguous filenames */}
      {pending && (
        <div
          className="absolute top-24 right-0 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-4 z-50"
          style={{ width: 220 }}
        >
          <p className="text-[0.65rem] uppercase tracking-[0.15em] text-[var(--color-text-muted)] font-sans mb-2">
            Classify image
          </p>
          <p className="text-[0.75rem] text-[var(--color-text)] font-serif italic mb-3 truncate" title={pending.name}>
            {pending.name}
          </p>
          <div className="flex flex-col gap-2 mb-4">
            {(['splash', 'banner', 'other'] as const).map((slot) => {
              const selected = pendingSlot === slot;
              return (
                <button
                  key={slot}
                  onClick={() => setPendingSlot(slot)}
                  className="flex items-center gap-2 text-left font-serif text-sm text-[var(--color-text)] hover:text-[var(--color-gold)] transition-colors"
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      border: '2px solid #5a4f46',
                      background: selected ? '#4a7a5a' : 'transparent',
                      color: '#fff',
                      fontSize: 10,
                      lineHeight: 1,
                    }}
                  >
                    {selected ? '✓' : ''}
                  </span>
                  <span className="capitalize">{slot}</span>
                </button>
              );
            })}
          </div>
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={cancelPending}
              className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors px-2 py-1"
              style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
            >
              Cancel
            </button>
            <button
              onClick={confirmPending}
              className="text-xs font-sans uppercase tracking-wider px-3 py-1 rounded transition-colors"
              style={{ background: '#c9a84c', color: '#1a1614', border: 'none', cursor: 'pointer' }}
            >
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
