'use client';

import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import type { PreparedCell } from '@/lib/h3-world-data';

interface Props {
  res1Cells: PreparedCell[];
  res2Cells: PreparedCell[];
  anchorCell: string;
  anchorLat: number;
  anchorLng: number;
  anchorName: string;
}

// CW palette — must match GlobeClient 2D exactly. Documented in that file.
const COLOR_SPACE = '#0a0f20';
const COLOR_OCEAN = '#172540';
const COLOR_CELL = new THREE.Color('#2b3e67');
const COLOR_ANCHOR_FILL = new THREE.Color('#f06282');
const COLOR_ANCHOR_ANCESTOR_FILL = new THREE.Color('#d94668');
const COLOR_PENTAGON_FILL = new THREE.Color('#000000');
const COLOR_SHADOW_LOW = new THREE.Color('rgb(200,130,56)');   // r=200 g=130 b=56
const COLOR_SHADOW_HIGH = new THREE.Color('rgb(255,208,96)');  // r=255 g=208 b=96

const GLOBE_RADIUS = 1;
const OUTLINE_RADIUS = 1.002; // nudge res-1 outlines outward to avoid z-fight

// Thresholds on camera distance: smaller = closer = more zoomed in.
// Orbit controls' minDistance/maxDistance bound this.
const RES_SWITCH_DISTANCE = 1.9; // zoom in past this → res 2

const RAD = Math.PI / 180;

/** [lat, lng] on a unit sphere centered at origin → THREE.Vector3 on surface. */
function latLngToVec3(lat: number, lng: number, radius = GLOBE_RADIUS): THREE.Vector3 {
  const φ = (90 - lat) * RAD; // polar
  const λ = -lng * RAD;       // negate to match conventional orientation
  const x = radius * Math.sin(φ) * Math.cos(λ);
  const y = radius * Math.cos(φ);
  const z = radius * Math.sin(φ) * Math.sin(λ);
  return new THREE.Vector3(x, y, z);
}

function colorForCell(c: PreparedCell, isAnchorCell: boolean, tmp: THREE.Color): THREE.Color {
  if (isAnchorCell) return tmp.copy(COLOR_ANCHOR_FILL);
  if (c.isAnchorAncestor) return tmp.copy(COLOR_ANCHOR_ANCESTOR_FILL);
  if (c.isPentagon) return tmp.copy(COLOR_PENTAGON_FILL);
  if (c.shadowDescendantCount > 0) {
    const t = Math.min(1, c.shadowDescendantCount / 7);
    return tmp.copy(COLOR_SHADOW_LOW).lerp(COLOR_SHADOW_HIGH, t);
  }
  return tmp.copy(COLOR_CELL);
}

function buildCellsGeometry(cells: PreparedCell[], anchorCell: string): THREE.BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const tmp = new THREE.Color();

  for (const c of cells) {
    const color = colorForCell(c, c.cell === anchorCell, tmp);
    const cr = color.r, cg = color.g, cb = color.b;

    const [cLat, cLng] = c.center;
    const centerPos = latLngToVec3(cLat, cLng, GLOBE_RADIUS);
    const centerIdx = positions.length / 3;
    positions.push(centerPos.x, centerPos.y, centerPos.z);
    colors.push(cr, cg, cb);

    const vertIdx: number[] = [];
    for (const [lat, lng] of c.boundary) {
      const v = latLngToVec3(lat, lng, GLOBE_RADIUS);
      vertIdx.push(positions.length / 3);
      positions.push(v.x, v.y, v.z);
      colors.push(cr, cg, cb);
    }

    // Triangle fan: center → vi → vi+1
    const n = vertIdx.length;
    for (let i = 0; i < n; i++) {
      indices.push(centerIdx, vertIdx[i], vertIdx[(i + 1) % n]);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

function buildOutlineSegments(cells: PreparedCell[]): THREE.BufferGeometry {
  // One LineSegments pair per edge of every cell. Extruded very slightly so
  // the stroke floats above the fill and doesn't z-fight.
  const positions: number[] = [];
  for (const c of cells) {
    const n = c.boundary.length;
    for (let i = 0; i < n; i++) {
      const [aLat, aLng] = c.boundary[i];
      const [bLat, bLng] = c.boundary[(i + 1) % n];
      const a = latLngToVec3(aLat, aLng, OUTLINE_RADIUS);
      const b = latLngToVec3(bLat, bLng, OUTLINE_RADIUS);
      positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
    }
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return geom;
}

function CellLayer({ cells, anchorCell, visible }: { cells: PreparedCell[]; anchorCell: string; visible: boolean }) {
  const geom = useMemo(() => buildCellsGeometry(cells, anchorCell), [cells, anchorCell]);
  return (
    <mesh geometry={geom} visible={visible}>
      <meshBasicMaterial vertexColors side={THREE.FrontSide} />
    </mesh>
  );
}

function Res1Outline({ cells }: { cells: PreparedCell[] }) {
  const geom = useMemo(() => buildOutlineSegments(cells), [cells]);
  return (
    <lineSegments geometry={geom}>
      <lineBasicMaterial color="#ffffff" transparent opacity={0.92} />
    </lineSegments>
  );
}

function AnchorMarker({ lat, lng, name }: { lat: number; lng: number; name: string }) {
  const pos = useMemo(() => latLngToVec3(lat, lng, GLOBE_RADIUS * 1.01), [lat, lng]);
  const markerRef = useRef<THREE.Mesh>(null);
  // Gentle pulse on the marker so it reads as "here."
  useFrame((state) => {
    if (markerRef.current) {
      const t = state.clock.elapsedTime;
      const s = 1 + Math.sin(t * 2.5) * 0.18;
      markerRef.current.scale.setScalar(s);
    }
  });
  return (
    <group position={pos}>
      <mesh ref={markerRef}>
        <sphereGeometry args={[0.012, 16, 16]} />
        <meshBasicMaterial color="#ffb5c5" />
      </mesh>
      <Html position={[0, 0.015, 0]} center distanceFactor={6}>
        <span
          style={{
            color: '#ffb5c5',
            fontFamily: "'Geist', sans-serif",
            fontSize: 12,
            fontWeight: 500,
            whiteSpace: 'nowrap',
            textShadow: '0 0 4px #0a0f20',
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          {name}
        </span>
      </Html>
    </group>
  );
}

function OceanSphere() {
  return (
    <mesh>
      <sphereGeometry args={[GLOBE_RADIUS * 0.999, 96, 64]} />
      <meshBasicMaterial color={COLOR_OCEAN} />
    </mesh>
  );
}

// Track OrbitControls distance to auto-switch resolution.
function ZoomWatcher({ onChange }: { onChange: (distance: number) => void }) {
  useFrame(({ camera }) => {
    onChange(camera.position.length());
  });
  return null;
}

export default function Globe3DClient({ res1Cells, res2Cells, anchorCell, anchorLat, anchorLng, anchorName }: Props) {
  const [cameraDistance, setCameraDistance] = useState(2.5);
  const useRes2 = cameraDistance < RES_SWITCH_DISTANCE;
  const activeRes = useRes2 ? 2 : 1;
  const activeCellCount = useRes2 ? res2Cells.length : res1Cells.length;

  // Compute initial camera position to aim at Blaen Hafren.
  const initialCameraPos = useMemo(() => {
    const v = latLngToVec3(anchorLat, anchorLng, 2.5);
    return [v.x, v.y, v.z] as [number, number, number];
  }, [anchorLat, anchorLng]);

  return (
    <div>
      <div
        className="mb-3 flex items-center gap-4 text-xs font-sans flex-wrap"
        style={{ color: 'var(--color-text-muted)' }}
      >
        <span>
          Active: <strong>res {activeRes}</strong> ({activeCellCount.toLocaleString()} cells) ·
          Distance: <strong>{cameraDistance.toFixed(2)}</strong>
        </span>
        <LegendChip fill="#d94668" label="Shadow's home cell" />
        <LegendChip fill="#e89a48" label="Shadow presence (res-6 density)" />
        <LegendChip fill="#000000" label="Astral void (pentagon)" />
        <span className="opacity-70">Drag to spin · scroll to zoom</span>
      </div>

      <div
        className="relative rounded-sm overflow-hidden"
        style={{ background: COLOR_SPACE, border: `1px solid #3e5683`, width: '100%', aspectRatio: '1 / 1', maxWidth: 900 }}
      >
        <Canvas
          camera={{ position: initialCameraPos, fov: 35, near: 0.1, far: 100 }}
          gl={{ antialias: true }}
          style={{ background: COLOR_SPACE }}
        >
          <ambientLight intensity={1} />
          <OceanSphere />
          <CellLayer cells={res1Cells} anchorCell={anchorCell} visible={!useRes2} />
          <CellLayer cells={res2Cells} anchorCell={anchorCell} visible={useRes2} />
          <Res1Outline cells={res1Cells} />
          <AnchorMarker lat={anchorLat} lng={anchorLng} name={anchorName} />
          <OrbitControls
            enablePan={false}
            enableDamping
            dampingFactor={0.08}
            rotateSpeed={0.6}
            zoomSpeed={0.9}
            minDistance={1.15}
            maxDistance={5}
          />
          <ZoomWatcher onChange={setCameraDistance} />
        </Canvas>
      </div>

      <div className="mt-3 text-xs font-sans opacity-60">
        Swaps to res 2 at distance &lt; {RES_SWITCH_DISTANCE.toFixed(2)} · res-1 lattice always overlays in white
      </div>
    </div>
  );
}

function LegendChip({ fill, label }: { fill: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block"
        style={{ width: 14, height: 14, background: fill, border: '1px solid #5880b4', borderRadius: 2 }}
      />
      <span>{label}</span>
    </span>
  );
}

// Stop TS from flagging unused import in some Next.js bundler paths.
export type { ThreeEvent };
