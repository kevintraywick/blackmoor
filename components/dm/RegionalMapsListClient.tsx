'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { readImageDimensions } from '@/lib/image-dims';

/**
 * Drag-and-drop / click-to-pick affordance for adding a new regional map.
 * Creates a map_builds row (map_role='regional'), uploads the image via the
 * existing /api/map-builder/[id]/image route (which writes to Railway's
 * /data volume in production — no split-brain), then jumps to the editor.
 */
export default function RegionalMapsListClient() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function ingest(file: File) {
    if (!file.type.startsWith('image/')) {
      setStatus('Drop a PNG or JPEG');
      setTimeout(() => setStatus(null), 2000);
      return;
    }
    setStatus(`Uploading ${file.name}…`);
    try {
      const baseName = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || 'New Regional Map';
      const create = await fetch('/api/regional-maps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: baseName, mirror_horizontal: false }),
      });
      if (!create.ok) throw new Error('Could not create map');
      const { id } = await create.json();

      const dimsP = readImageDimensions(file).catch(() => ({ width: 0, height: 0 }));
      const fd = new FormData();
      fd.append('file', file);
      const up = await fetch(`/api/map-builder/${id}/image`, { method: 'POST', body: fd });
      const upJson = await up.json();
      if (!up.ok || !upJson.ok) throw new Error('Upload failed');

      const dims = await dimsP;
      await fetch(`/api/map-builder/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_path: upJson.image_path,
          image_width_px: dims.width || null,
          image_height_px: dims.height || null,
        }),
      });
      setStatus('Opening editor…');
      router.push(`/dm/regional-maps/${id}`);
    } catch (err) {
      console.error(err);
      setStatus('Upload failed — try again');
      setTimeout(() => setStatus(null), 2500);
    }
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={e => { if (e.currentTarget === e.target) setDragOver(false); }}
      onDrop={e => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) void ingest(file);
      }}
      onClick={() => inputRef.current?.click()}
      style={{
        height: 110,
        borderRadius: 4,
        border: `2px dashed ${dragOver ? '#7ac2ff' : 'var(--color-border)'}`,
        background: dragOver ? 'rgba(122,194,255,0.06)' : 'transparent',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        cursor: 'pointer',
        transition: 'border-color 0.15s ease, background 0.15s ease',
      }}
      className="font-serif"
    >
      <div style={{ color: '#7ac2ff', fontSize: 16 }}>
        + Drop a regional map here, or click to choose a file
      </div>
      <div style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>
        {status ?? 'PNG or JPEG · uploads straight to the deployed app'}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        style={{ display: 'none' }}
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) void ingest(file);
          e.target.value = '';
        }}
      />
    </div>
  );
}
