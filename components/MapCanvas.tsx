'use client';

import { useEffect, useRef, useCallback } from 'react';
import type { MapRow, PlayerMapRow } from '@/lib/types';

type AnyMapRow = MapRow | PlayerMapRow;

interface MapCanvasProps {
  mapData: AnyMapRow;
  mode: 'dm' | 'player';
  width: number;
  height: number;
  onTileClick?: (col: number, row: number, isDrag: boolean) => void;
  activeNoteCoord?: [number, number] | null;
}

export default function MapCanvas({
  mapData,
  mode,
  width,
  height,
  onTileClick,
  activeNoteCoord,
}: MapCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const isDragging = useRef(false);
  const renderRef = useRef<() => void>(() => {});

  // Build image URL from image_path
  const imageUrl = mapData.image_path
    ? `/api/maps/image/${mapData.image_path}`
    : null;

  // ── Render ──────────────────────────────────────────────────────────────────
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const { grid_type, cols, rows, offset_x, offset_y, tile_px, revealed_tiles } = mapData;
    const dm_notes = mode === 'dm' ? (mapData as MapRow).dm_notes ?? [] : [];

    // Scale factors — grid params defined at natural image size
    const naturalW = img?.naturalWidth || W;
    const naturalH = img?.naturalHeight || H;
    const scaleX = W / naturalW;
    const scaleY = H / naturalH;

    // ── Draw background image ──────────────────────────────────────────────
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#0d0b09';
    ctx.fillRect(0, 0, W, H);
    if (img) ctx.drawImage(img, 0, 0, W, H);

    // ── Helper: tile rect (square) ─────────────────────────────────────────
    function squareRect(col: number, row: number) {
      const tileW = tile_px * scaleX;
      const tileH = tile_px * scaleY;
      return {
        x: col * tileW + offset_x * scaleX,
        y: row * tileH + offset_y * scaleY,
        w: tileW,
        h: tileH,
      };
    }

    // ── Helper: hex center (flat-top) ──────────────────────────────────────
    function hexCenter(col: number, row: number) {
      const R = (tile_px / 2) * scaleX;
      const W2 = R * 2;
      const H2 = R * Math.sqrt(3);
      const ox = offset_x * scaleX;
      const oy = offset_y * scaleY;
      return {
        cx: col * W2 * 0.75 + ox + R,
        cy: row * H2 + oy + H2 / 2 + (col % 2 === 1 ? H2 / 2 : 0),
        R,
      };
    }

    // ── Helper: draw hex path ──────────────────────────────────────────────
    function hexPath(cx: number, cy: number, R: number) {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 180) * (60 * i);
        const px = cx + R * Math.cos(angle);
        const py = cy + R * Math.sin(angle);
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();
    }

    // ── Player mode: fog then reveal ───────────────────────────────────────
    if (mode === 'player') {
      ctx.fillStyle = 'rgba(0,0,0,0.88)';
      ctx.fillRect(0, 0, W, H);

      // Reveal tiles by clipping back to image
      revealed_tiles.forEach(([col, row]) => {
        if (grid_type === 'square') {
          const { x, y, w, h } = squareRect(col, row);
          if (img) {
            ctx.drawImage(img, x, y, w, h, x, y, w, h);
          } else {
            ctx.clearRect(x, y, w, h);
          }
        } else {
          const { cx, cy, R } = hexCenter(col, row);
          ctx.save();
          hexPath(cx, cy, R);
          ctx.clip();
          if (img) ctx.drawImage(img, 0, 0, W, H);
          ctx.restore();
        }
      });
    }

    // ── DM mode: green tint on revealed tiles ─────────────────────────────
    if (mode === 'dm') {
      revealed_tiles.forEach(([col, row]) => {
        ctx.fillStyle = 'rgba(60,140,60,0.22)';
        if (grid_type === 'square') {
          const { x, y, w, h } = squareRect(col, row);
          ctx.fillRect(x, y, w, h);
        } else {
          const { cx, cy, R } = hexCenter(col, row);
          hexPath(cx, cy, R);
          ctx.fill();
        }
      });
    }

    // ── Grid lines ─────────────────────────────────────────────────────────
    ctx.strokeStyle = 'rgba(200,180,150,0.18)';
    ctx.lineWidth = 0.5;

    if (grid_type === 'square') {
      const tileW = tile_px * scaleX;
      const tileH = tile_px * scaleY;
      const ox = offset_x * scaleX;
      const oy = offset_y * scaleY;
      for (let c = 0; c <= cols; c++) {
        ctx.beginPath();
        ctx.moveTo(c * tileW + ox, oy);
        ctx.lineTo(c * tileW + ox, rows * tileH + oy);
        ctx.stroke();
      }
      for (let r = 0; r <= rows; r++) {
        ctx.beginPath();
        ctx.moveTo(ox, r * tileH + oy);
        ctx.lineTo(cols * tileW + ox, r * tileH + oy);
        ctx.stroke();
      }
    } else {
      for (let col = 0; col < cols; col++) {
        for (let row = 0; row < rows; row++) {
          const { cx, cy, R } = hexCenter(col, row);
          hexPath(cx, cy, R);
          ctx.stroke();
        }
      }
    }

    // ── DM only: note dots + hover + active note highlight ─────────────────
    if (mode === 'dm') {
      dm_notes.forEach(({ col, row }) => {
        if (grid_type === 'square') {
          const { x, y, w } = squareRect(col, row);
          ctx.fillStyle = 'rgba(180,60,60,0.9)';
          ctx.beginPath();
          ctx.arc(x + w - 5, y + 5, 3.5, 0, Math.PI * 2);
          ctx.fill();
        } else {
          const { cx, cy, R } = hexCenter(col, row);
          ctx.fillStyle = 'rgba(180,60,60,0.9)';
          ctx.beginPath();
          ctx.arc(cx + R * 0.6, cy - R * 0.6, 3.5, 0, Math.PI * 2);
          ctx.fill();
        }
      });

      if (activeNoteCoord) {
        const [col, row] = activeNoteCoord;
        ctx.strokeStyle = 'rgba(200,168,76,0.8)';
        ctx.lineWidth = 2;
        if (grid_type === 'square') {
          const { x, y, w, h } = squareRect(col, row);
          ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
        } else {
          const { cx, cy, R } = hexCenter(col, row);
          hexPath(cx, cy, R - 1);
          ctx.stroke();
        }
      }
    }
  }, [mapData, mode, activeNoteCoord]);

  // Keep renderRef in sync with the latest render function
  useEffect(() => { renderRef.current = render; }, [render]);

  // ── Load image and re-render ───────────────────────────────────────────────
  useEffect(() => {
    if (!imageUrl) { renderRef.current(); return; }
    const img = new Image();
    img.onload = () => { imgRef.current = img; renderRef.current(); };
    img.onerror = () => { imgRef.current = null; renderRef.current(); };
    img.src = imageUrl;
  }, [imageUrl]); // render removed — use renderRef.current() to avoid refetch on every mapData change

  // Re-render when data changes
  useEffect(() => { render(); }, [render]);

  // ── Click / drag to tile ───────────────────────────────────────────────────
  function pixelToTile(clientX: number, clientY: number): [number, number] | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const px = (clientX - rect.left) * (canvas.width / rect.width);
    const py = (clientY - rect.top) * (canvas.height / rect.height);

    const { grid_type, cols, rows, offset_x, offset_y, tile_px } = mapData;
    const naturalW = imgRef.current?.naturalWidth || canvas.width;
    const naturalH = imgRef.current?.naturalHeight || canvas.height;
    const scaleX = canvas.width / naturalW;
    const scaleY = canvas.height / naturalH;

    if (grid_type === 'square') {
      const tileW = tile_px * scaleX;
      const tileH = tile_px * scaleY;
      const col = Math.floor((px - offset_x * scaleX) / tileW);
      const row = Math.floor((py - offset_y * scaleY) / tileH);
      if (col < 0 || col >= cols || row < 0 || row >= rows) return null;
      return [col, row];
    } else {
      // Flat-top hex, even-q offset
      const R = (tile_px / 2) * scaleX;
      const H2 = R * Math.sqrt(3);
      const ox = offset_x * scaleX;
      const oy = offset_y * scaleY;
      const x = px - ox - R;
      const y = py - oy - H2 / 2;
      const q = (2 / 3 * x) / R;
      const r = (-1 / 3 * x + Math.sqrt(3) / 3 * y) / R;
      const s = -q - r;
      let rq = Math.round(q), rr = Math.round(r), rs = Math.round(s);
      const dq = Math.abs(rq - q), dr = Math.abs(rr - r), ds = Math.abs(rs - s);
      if (dq > dr && dq > ds) rq = -rr - rs;
      else if (dr > ds) rr = -rq - rs;
      const col = rq;
      const row = rr + Math.floor(rq / 2);
      if (col < 0 || col >= cols || row < 0 || row >= rows) return null;
      return [col, row];
    }
  }

  function handleMouseDown(e: React.MouseEvent) {
    if (!onTileClick) return;
    isDragging.current = true;
    const tile = pixelToTile(e.clientX, e.clientY);
    if (tile) onTileClick(tile[0], tile[1], false);
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!onTileClick || !isDragging.current) return;
    const tile = pixelToTile(e.clientX, e.clientY);
    if (tile) onTileClick(tile[0], tile[1], true);
  }

  function handleMouseUp() { isDragging.current = false; }

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ display: 'block', width: '100%', height: '100%' }}
      onMouseDown={mode === 'dm' ? handleMouseDown : undefined}
      onMouseMove={mode === 'dm' ? handleMouseMove : undefined}
      onMouseUp={mode === 'dm' ? handleMouseUp : undefined}
      onMouseLeave={mode === 'dm' ? handleMouseUp : undefined}
    />
  );
}
