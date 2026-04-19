'use client';

import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import type { PreparedCell } from '@/lib/h3-world-data';

interface Props {
  res0Cells: PreparedCell[];
  res1Cells: PreparedCell[];
  res2Cells: PreparedCell[];
  anchorCell: string;
  anchorLat: number;
  anchorLng: number;
}

// CW palette — must match GlobeClient 2D exactly. Documented in that file.
const COLOR_SPACE = '#0a0f20';
const COLOR_OCEAN = '#172540';
const COLOR_CELL = new THREE.Color('#2b3e67');
const COLOR_ANCHOR_FILL = new THREE.Color('#f06282');
const COLOR_ANCHOR_ANCESTOR_FILL = new THREE.Color('#d94668');
const COLOR_PENTAGON_FILL = new THREE.Color('#6e7480');
const COLOR_SHADOW_HIGH = new THREE.Color('rgb(255,208,96)');  // r=255 g=208 b=96

const GLOBE_RADIUS = 1;
const RES2_OUTLINE_RADIUS = 1.001; // finest outlines, beneath res-1
const RES1_OUTLINE_RADIUS = 1.002; // just above res-2 outlines + the fills
const RES0_OUTLINE_RADIUS = 1.004; // above res-1 so colors don't blend where edges overlap

// Opacity crossfade anchors — as camera distance drops from FAR to NEAR,
// the "outer" layer fades out while the "inner" layer fades in. We use two
// bands: one for outlines (res-0 ↔ res-1) and a tighter one for fills
// (res-1 ↔ res-2), since fills need to transition faster to keep cells
// from looking washed out at mid-zoom.
const OUTLINE_FADE_FAR = 3.5;
const OUTLINE_FADE_NEAR = 1.5;
const RES0_OUTLINE_OPACITY_FAR = 1.0;
const RES0_OUTLINE_OPACITY_NEAR = 0.05;

// Res-1 outline uses a triangular envelope: fades in from planetary zoom,
// peaks around the region-scale zoom, then fades OUT faster than res-0 did
// as we drill into res-2 territory.
const RES1_OUTLINE_PEAK_DISTANCE = 2.2;    // where res-1 is most legible
const RES1_OUTLINE_NEAR_END = 1.3;         // by here, res-1 is ~invisible
const RES1_OUTLINE_FLOOR = 0.1;
const RES1_OUTLINE_PEAK = 0.95;

const FILL_FADE_FAR = 2.5;
const FILL_FADE_NEAR = 1.5;

// Radii for the cell-fill layers. Res-2 sits slightly below res-1 so that
// when both are partially transparent in the crossfade band, there's no
// z-fight on shared vertices.
const RES1_FILL_RADIUS = 1.000;
const RES2_FILL_RADIUS = 0.9995;

function fadeAmount(distance: number, farEnd: number, nearEnd: number): number {
  // 0 when at/beyond FAR, 1 when at/below NEAR, linear in between.
  return Math.max(0, Math.min(1, (farEnd - distance) / (farEnd - nearEnd)));
}

/**
 * Triangular envelope — returns 0 at `far` and `near`, peaks at 1 at `peak`.
 * Used for the res-1 outline which needs to fade IN from planetary zoom,
 * hit its peak around the region-scale zoom, then fade OUT as the user
 * drills deeper into res-2 territory.
 */
function triangleFade(distance: number, far: number, peak: number, near: number): number {
  if (distance >= far) return 0;
  if (distance >= peak) return (far - distance) / (far - peak);
  if (distance >= near) return (distance - near) / (peak - near);
  return 0;
}

// Thresholds on camera distance: smaller = closer = more zoomed in.
// Orbit controls' minDistance/maxDistance bound this.
// RES_SWITCH_DISTANCE removed — the res-1/res-2 swap is now a continuous
// crossfade governed by FILL_FADE_FAR/NEAR below, not a binary threshold.

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

/**
 * Fill-ratio shading: cells blend from the base slate-blue toward warm amber
 * by how much of the cell is actually covered by Shadow. `maxShadowCount` is
 * the highest descendant count seen in the current resolution — the cell
 * with the densest Shadow presence reads as solid amber, everything else
 * grades down. `sqrt` eases the curve so a few-hex cell still shows a faint
 * warm tint rather than vanishing into the base.
 */
function colorForCell(
  c: PreparedCell,
  isAnchorCell: boolean,
  maxShadowCount: number,
  tmp: THREE.Color,
): THREE.Color {
  if (isAnchorCell) return tmp.copy(COLOR_ANCHOR_FILL);
  if (c.isAnchorAncestor) return tmp.copy(COLOR_ANCHOR_ANCESTOR_FILL);
  if (c.isPentagon) return tmp.copy(COLOR_PENTAGON_FILL);
  if (c.shadowDescendantCount > 0 && maxShadowCount > 0) {
    const t = Math.sqrt(c.shadowDescendantCount / maxShadowCount);
    return tmp.copy(COLOR_CELL).lerp(COLOR_SHADOW_HIGH, t);
  }
  return tmp.copy(COLOR_CELL);
}

function buildCellsGeometry(cells: PreparedCell[], anchorCell: string, radius: number): THREE.BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const tmp = new THREE.Color();

  // Peak Shadow density in the current resolution — every lighter-than-peak
  // ancestor grades toward amber proportionally.
  let maxShadowCount = 0;
  for (const c of cells) {
    if (c.shadowDescendantCount > maxShadowCount) maxShadowCount = c.shadowDescendantCount;
  }

  for (const c of cells) {
    const color = colorForCell(c, c.cell === anchorCell, maxShadowCount, tmp);
    const cr = color.r, cg = color.g, cb = color.b;

    const [cLat, cLng] = c.center;
    const centerPos = latLngToVec3(cLat, cLng, radius);
    const centerIdx = positions.length / 3;
    positions.push(centerPos.x, centerPos.y, centerPos.z);
    colors.push(cr, cg, cb);

    const vertIdx: number[] = [];
    for (const [lat, lng] of c.boundary) {
      const v = latLngToVec3(lat, lng, radius);
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

function buildOutlineSegments(cells: PreparedCell[], radius: number): THREE.BufferGeometry {
  // One LineSegments pair per edge of every cell, projected to the given
  // extrusion radius so the stroke floats above lower layers without z-fight.
  const positions: number[] = [];
  for (const c of cells) {
    const n = c.boundary.length;
    for (let i = 0; i < n; i++) {
      const [aLat, aLng] = c.boundary[i];
      const [bLat, bLng] = c.boundary[(i + 1) % n];
      const a = latLngToVec3(aLat, aLng, radius);
      const b = latLngToVec3(bLat, bLng, radius);
      positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
    }
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return geom;
}

function CellLayer({
  cells,
  anchorCell,
  radius,
  opacity,
}: {
  cells: PreparedCell[];
  anchorCell: string;
  radius: number;
  opacity: number;
}) {
  const geom = useMemo(() => buildCellsGeometry(cells, anchorCell, radius), [cells, anchorCell, radius]);
  if (opacity <= 0.001) return null; // skip entirely when fully faded — saves a draw call at extremes
  return (
    <mesh geometry={geom}>
      <meshBasicMaterial vertexColors side={THREE.FrontSide} transparent opacity={opacity} depthWrite={opacity > 0.95} />
    </mesh>
  );
}

function OutlineLayer({ cells, radius, color, opacity }: {
  cells: PreparedCell[];
  radius: number;
  color: string;
  opacity: number;
}) {
  const geom = useMemo(() => buildOutlineSegments(cells, radius), [cells, radius]);
  return (
    <lineSegments geometry={geom}>
      <lineBasicMaterial color={color} transparent opacity={opacity} />
    </lineSegments>
  );
}

function AnchorMarker({ lat, lng }: { lat: number; lng: number }) {
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

// Exposes a camera-reset imperative handle up to the parent so the "Go to
// Blaen Hafren" button can reset view from outside the Canvas tree.
interface CameraControllerHandle {
  goToAnchor: () => void;
}
const CameraController = forwardRef<
  CameraControllerHandle,
  { anchorLat: number; anchorLng: number; controlsRef: React.MutableRefObject<OrbitControlsImpl | null> }
>(function CameraController({ anchorLat, anchorLng, controlsRef }, ref) {
  const { camera } = useThree();
  useImperativeHandle(ref, () => ({
    goToAnchor() {
      const v = latLngToVec3(anchorLat, anchorLng, 2.5);
      camera.position.set(v.x, v.y, v.z);
      camera.lookAt(0, 0, 0);
      if (controlsRef.current) {
        controlsRef.current.target.set(0, 0, 0);
        controlsRef.current.update();
      }
    },
  }));
  return null;
});

export default function Globe3DClient({ res0Cells, res1Cells, res2Cells, anchorCell, anchorLat, anchorLng }: Props) {
  const [cameraDistance, setCameraDistance] = useState(2.5);
  const fillFade = fadeAmount(cameraDistance, FILL_FADE_FAR, FILL_FADE_NEAR);
  const res1FillOpacity = 1 - fillFade; // pure res-1 when far
  const res2FillOpacity = fillFade;     // pure res-2 when near
  const dominantRes = fillFade >= 0.5 ? 2 : 1;
  const dominantCellCount = dominantRes === 2 ? res2Cells.length : res1Cells.length;

  const initialCameraPos = useMemo(() => {
    const v = latLngToVec3(anchorLat, anchorLng, 2.5);
    return [v.x, v.y, v.z] as [number, number, number];
  }, [anchorLat, anchorLng]);

  const controllerRef = useRef<CameraControllerHandle>(null);
  const controlsRef = useRef<OrbitControlsImpl | null>(null);

  return (
    <div style={{ display: 'flex', width: '100%', height: 'calc(100vh - 120px)', background: COLOR_SPACE }}>
      {/* Left panel — button + live state */}
      <aside
        className="flex flex-col gap-4 text-xs font-sans"
        style={{ width: 240, padding: 20, borderRight: `1px solid #2a3a5e`, color: '#b8c8ea' }}
      >
        <button
          type="button"
          onClick={() => controllerRef.current?.goToAnchor()}
          className="text-[0.7rem] uppercase tracking-[0.15em] font-sans transition-colors"
          style={{
            background: 'transparent',
            border: `1px solid #3e5683`,
            color: '#ffb5c5',
            cursor: 'pointer',
            padding: '10px 12px',
            borderRadius: 2,
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(62,86,131,0.25)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
        >
          Go to Blaen Hafren
        </button>

        <div className="flex flex-col gap-1.5">
          <div>
            <span className="opacity-60">Active: </span>
            <strong style={{ color: '#d0e0ff' }}>res {dominantRes}</strong>
            <span className="opacity-60"> · {dominantCellCount.toLocaleString()} cells</span>
          </div>
          <div>
            <span className="opacity-60">Distance: </span>
            <strong style={{ color: '#d0e0ff' }}>{cameraDistance.toFixed(2)}</strong>
          </div>
        </div>

        <div className="flex flex-col gap-1.5 pt-2" style={{ borderTop: '1px solid #2a3a5e' }}>
          <LegendChip fill="#d94668" label="Shadow's home cell" />
          <LegendChip fill="#e89a48" label="Shadow presence" />
          <LegendChip fill="#6e7480" label="Astral void" />
          <LegendChip fill="#ffd060" label="Res-0 outline (continents)" />
          <LegendChip fill="#ffffff" label="Res-1 outline" />
        </div>
      </aside>

      {/* Canvas fills the rest */}
      <div style={{ flex: 1, position: 'relative' }}>
        <Canvas
          camera={{ position: initialCameraPos, fov: 35, near: 0.1, far: 100 }}
          gl={{ antialias: true }}
          style={{ background: COLOR_SPACE }}
        >
          <ambientLight intensity={1} />
          <OceanSphere />
          <CellLayer cells={res1Cells} anchorCell={anchorCell} radius={RES1_FILL_RADIUS} opacity={res1FillOpacity} />
          <CellLayer cells={res2Cells} anchorCell={anchorCell} radius={RES2_FILL_RADIUS} opacity={res2FillOpacity} />
          <OutlineLayer
            cells={res1Cells}
            radius={RES1_OUTLINE_RADIUS}
            color="#ffffff"
            opacity={RES1_OUTLINE_FLOOR + (RES1_OUTLINE_PEAK - RES1_OUTLINE_FLOOR) * triangleFade(cameraDistance, OUTLINE_FADE_FAR, RES1_OUTLINE_PEAK_DISTANCE, RES1_OUTLINE_NEAR_END)}
          />
          {/* Res-2 outlines — fade in alongside the res-2 fill crossfade so
              individual 60-km cells become distinguishable when zoomed in. */}
          <OutlineLayer
            cells={res2Cells}
            radius={RES2_OUTLINE_RADIUS}
            color="#7a9ed0"
            opacity={0.55 * fillFade}
          />
          <OutlineLayer
            cells={res0Cells}
            radius={RES0_OUTLINE_RADIUS}
            color="#ffd060"
            opacity={RES0_OUTLINE_OPACITY_FAR + (RES0_OUTLINE_OPACITY_NEAR - RES0_OUTLINE_OPACITY_FAR) * fadeAmount(cameraDistance, OUTLINE_FADE_FAR, OUTLINE_FADE_NEAR)}
          />
          <AnchorMarker lat={anchorLat} lng={anchorLng} />
          <OrbitControls
            ref={controlsRef}
            enablePan={false}
            enableDamping
            dampingFactor={0.08}
            rotateSpeed={0.6}
            zoomSpeed={0.9}
            minDistance={1.15}
            maxDistance={5}
          />
          <ZoomWatcher onChange={setCameraDistance} />
          <CameraController
            ref={controllerRef}
            anchorLat={anchorLat}
            anchorLng={anchorLng}
            controlsRef={controlsRef}
          />
        </Canvas>
      </div>
    </div>
  );
}

function LegendChip({ fill, label }: { fill: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block"
        style={{ width: 12, height: 12, background: fill, border: '1px solid #5880b4', borderRadius: 2 }}
      />
      <span>{label}</span>
    </span>
  );
}
