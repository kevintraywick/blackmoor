'use client';

import { Suspense, Component, useRef, useMemo, type ReactNode } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import type { Group, Mesh, Object3D } from 'three';

// Loads the spawn's GLB from /public/models/ — spins slowly in the encounter
// preview. Falls back to a gold wireframe crystal if the model isn't present.

interface ARViewerProps {
  glbSrc: string;
}

// Names of stray top-level nodes sometimes left in exported GLBs
// (e.g. Blender's default Cube). Strip these before rendering so they
// don't dominate the frame in the R3F preview.
const STRIP_NODE_NAMES = new Set(['Cube']);

function RotatingModel({ glbSrc }: ARViewerProps) {
  const { scene } = useGLTF(glbSrc);
  const ref = useRef<Group>(null);

  // Clone the loaded scene and remove any stray top-level stage geometry.
  // Cloning avoids mutating the cached scene shared across mounts.
  const cleaned = useMemo(() => {
    const clone = scene.clone(true);
    const toRemove: Object3D[] = [];
    for (const child of clone.children) {
      if (STRIP_NODE_NAMES.has(child.name)) toRemove.push(child);
    }
    for (const child of toRemove) clone.remove(child);
    return clone;
  }, [scene]);

  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.4;
  });
  return <primitive ref={ref} object={cleaned} scale={1.5} position={[0, -0.5, 0]} />;
}

function GoldCrystal() {
  const ref = useRef<Mesh>(null);
  useFrame((_, delta) => {
    if (ref.current) {
      ref.current.rotation.y += delta * 0.5;
      ref.current.rotation.x += delta * 0.12;
    }
  });
  return (
    <mesh ref={ref}>
      <icosahedronGeometry args={[1, 0]} />
      <meshStandardMaterial color="#c9a84c" wireframe />
    </mesh>
  );
}

class SceneErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        <Canvas camera={{ position: [0, 0, 3] }}>
          <ambientLight intensity={0.6} />
          <pointLight position={[2, 3, 2]} intensity={1} color="#c9a84c" />
          <GoldCrystal />
        </Canvas>
      );
    }
    return this.props.children;
  }
}

export default function ARViewer({ glbSrc }: ARViewerProps) {
  return (
    <div className="w-full" style={{ height: '260px' }}>
      <SceneErrorBoundary>
        <Canvas camera={{ position: [0, 0.5, 3] }}>
          <ambientLight intensity={0.5} />
          <pointLight position={[2, 4, 2]} intensity={1.5} color="#c9a84c" />
          <pointLight position={[-2, -1, -2]} intensity={0.3} color="#8b3a3a" />
          <Suspense fallback={<GoldCrystal />}>
            <RotatingModel glbSrc={glbSrc} />
          </Suspense>
        </Canvas>
      </SceneErrorBoundary>
    </div>
  );
}
