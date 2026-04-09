'use client';

import { useEffect, useRef } from 'react';

// Wraps the <model-viewer> web component imperatively to avoid
// TypeScript JSX intrinsic element declaration boilerplate.
// The component handles both iOS QuickLook (USDZ) and Android
// WebXR / Scene Viewer (GLB) automatically via ar-modes.

interface Props {
  glbSrc: string;
  usdzSrc: string;
}

export default function ModelViewer({ glbSrc, usdzSrc }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const mv = document.createElement('model-viewer');
    mv.setAttribute('src', glbSrc);
    mv.setAttribute('ios-src', usdzSrc);
    mv.setAttribute('ar', '');
    mv.setAttribute('ar-modes', 'webxr scene-viewer quick-look');
    mv.setAttribute('camera-controls', '');
    mv.setAttribute('shadow-intensity', '1');
    mv.setAttribute('alt', 'Encounter creature — view in AR');
    mv.style.width = '100%';
    mv.style.height = '320px';
    mv.style.background = 'transparent';
    container.appendChild(mv);

    return () => {
      container.removeChild(mv);
    };
  }, [glbSrc, usdzSrc]);

  return <div ref={containerRef} className="w-full" />;
}
