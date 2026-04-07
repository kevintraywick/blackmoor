'use client';

import { Suspense, Component, useRef, type ReactNode } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import type { Group, Mesh } from 'three';

// Loads /public/models/creature.glb — spins slowly in the encounter preview.
// Falls back to a gold wireframe crystal if the model isn't present yet.

function RotatingModel() {
  const { scene } = useGLTF('/models/creature.glb');
  const ref = useRef<Group>(null);
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.4;
  });
  return <primitive ref={ref} object={scene} scale={1.5} position={[0, -0.5, 0]} />;
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

export default function ARViewer() {
  return (
    <div className="w-full" style={{ height: '260px' }}>
      <SceneErrorBoundary>
        <Canvas camera={{ position: [0, 0.5, 3] }}>
          <ambientLight intensity={0.5} />
          <pointLight position={[2, 4, 2]} intensity={1.5} color="#c9a84c" />
          <pointLight position={[-2, -1, -2]} intensity={0.3} color="#8b3a3a" />
          <Suspense fallback={<GoldCrystal />}>
            <RotatingModel />
          </Suspense>
        </Canvas>
      </SceneErrorBoundary>
    </div>
  );
}
