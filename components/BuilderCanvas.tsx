'use client';

import { useEffect, useRef, useCallback } from 'react';
import { hexCenter, hexPath, pixelToHex, visibleHexRange, gridBounds } from '@/lib/hex-math';
import type { TileState } from '@/lib/types';

export type BuilderTool = 'build' | 'select' | 'visible' | 'obscure' | 'print';

interface BuilderCanvasProps {
  cols: number;
  rows: number;
  hexSize: number;         // world-space radius of a hex (px)
  tiles: Map<number, TileState>;
  activeTool: BuilderTool;
  onTileClick?: (col: number, row: number, isDrag: boolean) => void;
  onCameraChange?: (camera: { x: number; y: number; zoom: number }) => void;
  onPointerUp?: () => void;
}

/** Pack a col,row pair into a single number key for Map lookups. */
export function packKey(col: number, row: number): number {
  return col * 10000 + row;
}

export default function BuilderCanvas({
  cols,
  rows,
  hexSize,
  tiles,
  activeTool,
  onTileClick,
  onCameraChange,
  onPointerUp: onPointerUpProp,
}: BuilderCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cameraRef = useRef({ x: 0, y: 0, zoom: 1 });
  const isDragging = useRef(false);
  const isPanning = useRef(false);
  const lastPan = useRef({ x: 0, y: 0 });
  const dirtyRef = useRef(true);
  const rafRef = useRef<number>(0);

  // Refs to avoid stale closures in event handlers
  const toolRef = useRef(activeTool);
  toolRef.current = activeTool;
  const tilesRef = useRef(tiles);
  tilesRef.current = tiles;
  const colsRef = useRef(cols);
  colsRef.current = cols;
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  const markDirty = useCallback(() => { dirtyRef.current = true; }, []);

  // Mark dirty when props change
  useEffect(markDirty, [tiles, cols, rows, hexSize, markDirty]);

  // ── Screen pixel → world pixel ─────────────────────────────────────────────
  function screenToWorld(screenX: number, screenY: number) {
    const cam = cameraRef.current;
    return {
      wx: (screenX - cam.x) / cam.zoom,
      wy: (screenY - cam.y) / cam.zoom,
    };
  }

  // ── Render loop ────────────────────────────────────────────────────────────
  const renderLoop = useCallback(() => {
    if (!dirtyRef.current) {
      rafRef.current = requestAnimationFrame(renderLoop);
      return;
    }
    dirtyRef.current = false;

    const canvas = canvasRef.current;
    if (!canvas) { rafRef.current = requestAnimationFrame(renderLoop); return; }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const cam = cameraRef.current;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#12100e';
    ctx.fillRect(0, 0, W, H);

    // Apply camera transform
    ctx.setTransform(cam.zoom, 0, 0, cam.zoom, cam.x, cam.y);

    // Viewport bounds in world space (for culling)
    const viewX = -cam.x / cam.zoom;
    const viewY = -cam.y / cam.zoom;
    const viewW = W / cam.zoom;
    const viewH = H / cam.zoom;

    const range = visibleHexRange(viewX, viewY, viewW, viewH, hexSize, colsRef.current, rowsRef.current);

    // Batch inactive hexes
    ctx.fillStyle = 'rgba(200,180,150,0.06)';
    for (let c = range.minCol; c <= range.maxCol; c++) {
      for (let r = range.minRow; r <= range.maxRow; r++) {
        const key = packKey(c, r);
        if (tilesRef.current.has(key) && tilesRef.current.get(key)!.active) continue;
        const { cx, cy } = hexCenter(c, r, hexSize);
        hexPath(ctx, cx, cy, hexSize);
        ctx.fill();
      }
    }

    // Batch active hexes
    ctx.fillStyle = 'rgba(74,122,170,0.35)';
    for (let c = range.minCol; c <= range.maxCol; c++) {
      for (let r = range.minRow; r <= range.maxRow; r++) {
        const key = packKey(c, r);
        const tile = tilesRef.current.get(key);
        if (!tile?.active) continue;
        const { cx, cy } = hexCenter(c, r, hexSize);
        hexPath(ctx, cx, cy, hexSize);
        ctx.fill();
      }
    }

    // Grid lines
    ctx.strokeStyle = 'rgba(200,180,150,0.12)';
    ctx.lineWidth = 0.5 / cam.zoom; // constant screen-space thickness
    for (let c = range.minCol; c <= range.maxCol; c++) {
      for (let r = range.minRow; r <= range.maxRow; r++) {
        const { cx, cy } = hexCenter(c, r, hexSize);
        hexPath(ctx, cx, cy, hexSize);
        ctx.stroke();
      }
    }

    // Obscured tiles — orange fill
    ctx.fillStyle = 'rgba(210,140,50,0.35)';
    for (let c = range.minCol; c <= range.maxCol; c++) {
      for (let r = range.minRow; r <= range.maxRow; r++) {
        const key = packKey(c, r);
        const tile = tilesRef.current.get(key);
        if (!tile?.obscured) continue;
        const { cx, cy } = hexCenter(c, r, hexSize);
        hexPath(ctx, cx, cy, hexSize);
        ctx.fill();
      }
    }

    // Visible tiles — lighter blue fill
    ctx.fillStyle = 'rgba(130,190,255,0.30)';
    for (let c = range.minCol; c <= range.maxCol; c++) {
      for (let r = range.minRow; r <= range.maxRow; r++) {
        const key = packKey(c, r);
        const tile = tilesRef.current.get(key);
        if (!tile?.visible) continue;
        const { cx, cy } = hexCenter(c, r, hexSize);
        hexPath(ctx, cx, cy, hexSize);
        ctx.fill();
      }
    }

    rafRef.current = requestAnimationFrame(renderLoop);
  }, [hexSize]);

  useEffect(() => {
    // Size canvas to container
    const canvas = canvasRef.current;
    if (canvas) {
      const rect = canvas.parentElement!.getBoundingClientRect();
      canvas.width = rect.width * devicePixelRatio;
      canvas.height = rect.height * devicePixelRatio;
    }

    // Start zoomed in so hexes are clearly visible (~40px on screen per hex radius)
    if (canvas) {
      const bounds = gridBounds(cols, rows, hexSize);
      const cam = cameraRef.current;
      // Target: each hex radius appears as ~40 screen pixels
      cam.zoom = (40 * devicePixelRatio) / hexSize;
      // Center on the middle of the grid
      cam.x = canvas.width / 2 - (bounds.width / 2) * cam.zoom;
      cam.y = canvas.height / 2 - (bounds.height / 2) * cam.zoom;
      dirtyRef.current = true;
    }

    rafRef.current = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [renderLoop, cols, rows, hexSize]);

  // Resize on window resize
  useEffect(() => {
    function handleResize() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.parentElement!.getBoundingClientRect();
      canvas.width = rect.width * devicePixelRatio;
      canvas.height = rect.height * devicePixelRatio;
      dirtyRef.current = true;
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // ── Pointer events ─────────────────────────────────────────────────────────
  function canvasXY(e: React.PointerEvent) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      sx: (e.clientX - rect.left) * devicePixelRatio,
      sy: (e.clientY - rect.top) * devicePixelRatio,
    };
  }

  function handlePointerDown(e: React.PointerEvent) {
    const { sx, sy } = canvasXY(e);
    const tool = toolRef.current;

    // Middle-click = always pan (no explicit pan tool anymore)
    if (e.button === 1) {
      isPanning.current = true;
      lastPan.current = { x: sx, y: sy };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }

    if ((tool === 'build' || tool === 'visible' || tool === 'obscure') && onTileClick) {
      isDragging.current = true;
      const { wx, wy } = screenToWorld(sx, sy);
      const tile = pixelToHex(wx, wy, hexSize, colsRef.current, rowsRef.current);
      if (tile) onTileClick(tile[0], tile[1], false);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }
  }

  function handlePointerMove(e: React.PointerEvent) {
    const { sx, sy } = canvasXY(e);

    if (isPanning.current) {
      const dx = sx - lastPan.current.x;
      const dy = sy - lastPan.current.y;
      cameraRef.current.x += dx;
      cameraRef.current.y += dy;
      lastPan.current = { x: sx, y: sy };
      dirtyRef.current = true;
      onCameraChange?.(cameraRef.current);
      return;
    }

    if (isDragging.current && (toolRef.current === 'build' || toolRef.current === 'visible' || toolRef.current === 'obscure') && onTileClick) {
      const { wx, wy } = screenToWorld(sx, sy);
      const tile = pixelToHex(wx, wy, hexSize, colsRef.current, rowsRef.current);
      if (tile) onTileClick(tile[0], tile[1], true);
    }
  }

  function handlePointerUp() {
    isDragging.current = false;
    isPanning.current = false;
    onPointerUpProp?.();
  }

  // ── Scroll wheel zoom at cursor ────────────────────────────────────────────
  function handleWheel(e: React.WheelEvent) {
    e.preventDefault();
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const sx = (e.clientX - rect.left) * devicePixelRatio;
    const sy = (e.clientY - rect.top) * devicePixelRatio;

    const cam = cameraRef.current;
    const oldZoom = cam.zoom;
    const factor = 1 - e.deltaY * 0.001;
    cam.zoom = Math.max(0.1, Math.min(10, cam.zoom * factor));

    // Adjust offset so world point under cursor stays fixed
    cam.x = sx - (sx - cam.x) * (cam.zoom / oldZoom);
    cam.y = sy - (sy - cam.y) * (cam.zoom / oldZoom);

    dirtyRef.current = true;
    onCameraChange?.(cam);
  }

  return (
    <canvas
      ref={canvasRef}
      style={{ display: 'block', width: '100%', height: '100%', cursor: activeTool === 'select' ? 'default' : 'crosshair' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onWheel={handleWheel}
    />
  );
}
