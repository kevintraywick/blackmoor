'use client';

import { forwardRef, Suspense, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, useGLTF, useTexture } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import type { PreparedCell } from '@/lib/h3-world-data';

interface Props {
  res0Cells: PreparedCell[];
  res1Cells: PreparedCell[];
  res2Cells: PreparedCell[];
  res3Cells: PreparedCell[];
  res4StartingCells: PreparedCell[];
  res4HaloCells: PreparedCell[];
  anchorCell: string;
  anchorLat: number;
  anchorLng: number;
}

// CW palette — must match GlobeClient 2D exactly. Documented in that file.
const COLOR_SPACE = '#0a0f20';            // sidebar / wrapper (dark)
const COLOR_CANVAS_BG = '#f0e0c8';        // behind the globe — warm cream complement to the sky-blue sphere
const COLOR_OCEAN = '#172540';
const COLOR_CELL = new THREE.Color('#2b3e67');
const COLOR_ANCHOR_FILL = new THREE.Color('#f06282');
const COLOR_ANCHOR_ANCESTOR_FILL = new THREE.Color('#d94668');
const COLOR_PENTAGON_FILL = new THREE.Color('#6e7480');
const COLOR_SHADOW_HIGH = new THREE.Color('#ff7a2a'); // orange, matches N-pole cone

const GLOBE_RADIUS = 1;
const RES3_OUTLINE_RADIUS = 1.0005; // finest res, sits just above the fills
const RES2_OUTLINE_RADIUS = 1.001;
const RES1_OUTLINE_RADIUS = 1.002;
const RES0_OUTLINE_RADIUS = 1.004;

// Opacity crossfade anchors — as camera distance drops from FAR to NEAR,
// the "outer" layer fades out while the "inner" layer fades in. We use two
// bands: one for outlines (res-0 ↔ res-1) and a tighter one for fills
// (res-1 ↔ res-2), since fills need to transition faster to keep cells
// from looking washed out at mid-zoom.
const OUTLINE_FADE_FAR = 3.5;
const OUTLINE_FADE_NEAR = 1.5;
const RES0_OUTLINE_OPACITY_FAR = 1.0;
const RES0_OUTLINE_OPACITY_NEAR = 0.0; // fully fade out close to Earth

// Res-1 outline uses a triangular envelope: fades in from planetary zoom,
// peaks around the region-scale zoom, then fades OUT faster than res-0 did
// as we drill into res-2 territory.
const RES1_OUTLINE_PEAK_DISTANCE = 2.2;    // where res-1 is most legible
const RES1_OUTLINE_NEAR_END = 1.3;         // by here, res-1 is ~invisible
const RES1_OUTLINE_FLOOR = 0;              // fully fade out close to Earth
const RES1_OUTLINE_PEAK = 0.95;

const FILL_FADE_FAR = 2.5;
const FILL_FADE_NEAR = 1.5;

// Res-2 ↔ res-3 crossfade: once the player has zoomed past the res-2 band,
// start introducing res-3 detail for Shadow's territory.
const RES3_FADE_FAR = 1.5;
const RES3_FADE_NEAR = 1.15;

// Wolf token fade: reads as a map marker at mid-zoom, vanishes as the user
// zooms into the actual hex so it doesn't occlude the ground.
const WOLF_FADE_FAR = 1.75;
const WOLF_FADE_NEAR = 1.25;

// Anchor marker fade: a subtle "you are here" beacon at far zoom that
// disappears as the user drills all the way into the hex.
const ANCHOR_FADE_FAR = 1.4;
const ANCHOR_FADE_NEAR = 1.0;

// Radii for the cell-fill layers. Later-rendered layers sit slightly above
// earlier ones so opacity stacking is deterministic and z-fight is avoided.
const RES1_FILL_RADIUS = 1.000;
const RES2_FILL_RADIUS = 0.9995;
const RES3_FILL_RADIUS = 1.0002;

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
  showShadow: boolean,
  uniformShadow: boolean,
  tmp: THREE.Color,
): THREE.Color {
  if (uniformShadow) return tmp.copy(COLOR_SHADOW_HIGH);
  if (showShadow && isAnchorCell) return tmp.copy(COLOR_ANCHOR_FILL);
  if (c.isPentagon) return tmp.copy(COLOR_PENTAGON_FILL);
  if (showShadow && c.shadowDescendantCount > 0 && maxShadowCount > 0) {
    const t = Math.sqrt(c.shadowDescendantCount / maxShadowCount);
    return tmp.copy(COLOR_CELL).lerp(COLOR_SHADOW_HIGH, t);
  }
  return tmp.copy(COLOR_CELL);
}

function buildCellsGeometry(cells: PreparedCell[], anchorCell: string, radius: number, showShadow: boolean, skipBaseCells = false, uniformShadow = false): THREE.BufferGeometry {
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
    // At near zoom, skip "plain" cells so the Earth texture underneath shows
    // through — only Shadow territory, anchors, and pentagons paint.
    if (skipBaseCells) {
      const isInteresting =
        c.cell === anchorCell ||
        c.isPentagon ||
        c.shadowDescendantCount > 0;
      if (!isInteresting) continue;
    }
    const color = colorForCell(c, c.cell === anchorCell, maxShadowCount, showShadow, uniformShadow, tmp);
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
  showShadow,
  skipBaseCells = false,
  uniformShadow = false,
}: {
  cells: PreparedCell[];
  anchorCell: string;
  radius: number;
  opacity: number;
  showShadow: boolean;
  skipBaseCells?: boolean;
  uniformShadow?: boolean;
}) {
  const geom = useMemo(
    () => buildCellsGeometry(cells, anchorCell, radius, showShadow, skipBaseCells, uniformShadow),
    [cells, anchorCell, radius, showShadow, skipBaseCells, uniformShadow],
  );
  if (opacity <= 0.001) return null; // skip entirely when fully faded — saves a draw call at extremes
  return (
    <mesh geometry={geom}>
      <meshBasicMaterial vertexColors side={THREE.DoubleSide} transparent opacity={opacity} depthWrite={false} />
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

/**
 * Position + orient 3D children on the globe surface.
 *
 * Children are placed at lat/lng on a sphere of GLOBE_RADIUS * radiusScale,
 * and rotated so their native +Y axis points radially outward — "up" on the
 * sphere. A cone with its default Y-up axis will stand upright wherever
 * you pin it.
 *
 * To pin by H3 cell, pre-resolve the cell's lat/lng server-side and pass
 * those values through (keeps h3-js out of the client bundle).
 */
function HexPin({
  lat,
  lng,
  radiusScale = 1,
  children,
}: {
  lat: number;
  lng: number;
  radiusScale?: number;
  children: React.ReactNode;
}) {
  const { position, quaternion } = useMemo(() => {
    const pos = latLngToVec3(lat, lng, GLOBE_RADIUS * radiusScale);
    const radial = pos.clone().normalize();
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), radial);
    return { position: pos, quaternion: quat };
  }, [lat, lng, radiusScale]);
  return (
    <group position={position} quaternion={quaternion}>
      {children}
    </group>
  );
}

/**
 * Loads `/tokens/wolf.glb` and renders Shadow's campaign token. Idle rotation
 * gives it a bit of life so the wolf reads as a character, not a statue.
 */
function WolfToken({ opacity }: { opacity: number }) {
  const { scene } = useGLTF('/tokens/wolf.glb');
  const cloned = useMemo(() => {
    const c = scene.clone(true);
    c.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.material = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true });
      }
    });
    return c;
  }, [scene]);
  useEffect(() => {
    cloned.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh && mesh.material && !Array.isArray(mesh.material)) {
        (mesh.material as THREE.Material).opacity = opacity;
      }
    });
  }, [cloned, opacity]);
  if (opacity <= 0.001) return null;
  return <primitive object={cloned} scale={0.00064} />;
}
useGLTF.preload('/tokens/wolf.glb');

function AnchorMarker({ lat, lng, opacity }: { lat: number; lng: number; opacity: number }) {
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
  if (opacity <= 0.001) return null;
  return (
    <group position={pos}>
      <mesh ref={markerRef}>
        <sphereGeometry args={[0.0012, 16, 16]} />
        <meshBasicMaterial color="#ffb5c5" transparent opacity={opacity} />
      </mesh>
    </group>
  );
}

function OceanSphere() {
  // NASA Blue Marble (public domain). Equirectangular, 4096×2048 — crisp
  // enough that the sphere holds up at minDistance 1.25. Sphere UVs in
  // three.js map the texture's horizontal center (u=0.5) to +X world axis.
  // Our latLngToVec3 uses λ = -lng, which places Greenwich (lng=0) along +X
  // as expected — so no extra rotation/flip is needed.
  const map = useTexture('/textures/earth_4096.jpg');
  return (
    <mesh>
      <sphereGeometry args={[GLOBE_RADIUS * 0.999, 96, 64]} />
      <meshBasicMaterial map={map} />
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
  setDistance: (d: number) => void;
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
    setDistance(d: number) {
      // Keep current orbit direction; just change how far away the camera sits.
      const dir = camera.position.clone().normalize();
      camera.position.copy(dir.multiplyScalar(d));
      if (controlsRef.current) {
        controlsRef.current.target.set(0, 0, 0);
        controlsRef.current.update();
      }
    },
  }));
  return null;
});

export default function Globe3DClient({ res3Cells, res4StartingCells, res4HaloCells, anchorCell, anchorLat, anchorLng }: Props) {
  const [cameraDistance, setCameraDistance] = useState(2.5);
  const wolfOpacity = 1 - fadeAmount(cameraDistance, WOLF_FADE_FAR, WOLF_FADE_NEAR);
  const anchorOpacity = 1 - fadeAmount(cameraDistance, ANCHOR_FADE_FAR, ANCHOR_FADE_NEAR);
  const dominantRes = 3;
  const dominantCellCount = res3Cells.length;

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
          <div className="flex items-center gap-2">
            <span>
              <span className="opacity-60">Cam: </span>
              <strong style={{ color: '#d0e0ff' }}>{cameraDistance.toFixed(2)}</strong>
            </span>
            <button
              type="button"
              onClick={() => controllerRef.current?.setDistance(5)}
              title="Reset camera distance to 5"
              className="text-[0.65rem] uppercase tracking-[0.15em] font-sans transition-colors"
              style={{
                background: 'transparent',
                border: '1px solid #3e5683',
                color: '#8aa0c8',
                cursor: 'pointer',
                padding: '2px 6px',
                borderRadius: 2,
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#d0e0ff'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#8aa0c8'; }}
            >
              Reset
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-1.5 pt-2" style={{ borderTop: '1px solid #2a3a5e' }}>
          <LegendChip fill="#ff7a2a" label="Shadow" />
          <LegendChip fill="#6e7480" label="Astral void" />
          <LegendChip fill="#a8c0ea" label="Res-3 outline" />
        </div>
      </aside>

      {/* Canvas fills the rest */}
      <div style={{ flex: 1, position: 'relative' }}>
        <Canvas
          camera={{ position: initialCameraPos, fov: 35, near: 0.1, far: 100 }}
          gl={{ antialias: true }}
          style={{ background: COLOR_CANVAS_BG }}
        >
          <ambientLight intensity={1} />
          <Suspense fallback={null}>
            <OceanSphere />
          </Suspense>
          <OutlineLayer
            cells={res3Cells}
            radius={RES3_OUTLINE_RADIUS}
            color="#a8c0ea"
            opacity={0.5}
          />
          {/* Shadow's 3 starting hexes at res-4 (adjacent to origin). */}
          <CellLayer
            cells={res4StartingCells}
            anchorCell={anchorCell}
            radius={RES3_FILL_RADIUS}
            opacity={0.55}
            showShadow={true}
            uniformShadow
          />
          {/* White res-4 outlines for origin + 6 neighbors so the starting
              hexes read against the broader local grid. */}
          <OutlineLayer
            cells={res4HaloCells}
            radius={RES3_OUTLINE_RADIUS}
            color="#ffffff"
            opacity={0.7}
          />
          <AnchorMarker lat={anchorLat} lng={anchorLng} opacity={anchorOpacity} />

          {/* Shadow's campaign token — wolf pinned at Blaen Hafren. */}
          <Suspense fallback={null}>
            <HexPin lat={anchorLat} lng={anchorLng} radiusScale={1.003}>
              <WolfToken opacity={wolfOpacity} />
            </HexPin>
          </Suspense>

          {/* N-pole reference cone. */}
          <HexPin lat={90} lng={0} radiusScale={1.002}>
            <mesh position={[0, 0.04, 0]}>
              <coneGeometry args={[0.025, 0.08, 16]} />
              <meshBasicMaterial color="#ff7a2a" />
            </mesh>
          </HexPin>
          <OrbitControls
            ref={controlsRef}
            enablePan
            screenSpacePanning
            enableDamping
            dampingFactor={0.08}
            rotateSpeed={0.6}
            zoomSpeed={0.9}
            minDistance={1.25}
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
