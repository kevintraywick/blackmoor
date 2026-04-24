'use client';

import { forwardRef, Suspense, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Html, OrbitControls, useGLTF, useTexture } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import type { PreparedCell } from '@/lib/h3-world-data';
import { CARTOGRAPHY, type Location } from '@/lib/cartography';
import { latToTileY, lngToTileX, tileBoundsLatLng } from '@/lib/tile-math';
import { cellToLatLng, cellToParent, getHexagonEdgeLengthAvg, gridDisk, latLngToCell } from 'h3-js';

interface LabeledRes2Cell {
  cell: string;
  lat: number;
  lng: number;
  number: number;
}

interface CloudCell {
  cell: string;
  lat: number;
  lng: number;
}

// Cloud placement, by labeled-hex number. Edit these to add/remove clouds.
// `WITH_NEIGHBORS` adds the hex + its 6 immediate neighbors (~7 cells each).
// `EXACT` adds just the named hex. Numbers refer to the labels rendered on
// the globe — server-assigned for 1-169, click-assigned for 170+.
const CLOUD_NUMBERS_WITH_NEIGHBORS: number[] = [12, 27, 28, 44, 74, 85, 88, 119];
const CLOUD_NUMBERS_EXACT: number[] = [163, 168, 169];

// Ship placement — exact hex numbers only (no neighbor expansion).
const SHIP_NUMBERS_EXACT: number[] = [41, 70, 91, 117, 158];

interface Props {
  res0Cells: PreparedCell[];
  res1Cells: PreparedCell[];
  res2Cells: PreparedCell[];
  res3Cells: PreparedCell[];
  res4CampaignCells: PreparedCell[];
  res4EligibleCells: PreparedCell[];
  labeledRes2Cells: LabeledRes2Cell[];
  liveCloudCellsPrecip: CloudCell[];
  anchorCell: string;
  anchorLat: number;
  anchorLng: number;
}

// CW palette — must match GlobeClient 2D exactly. Documented in that file.
const COLOR_SPACE = '#0a0f20';            // sidebar / wrapper (dark)
const COLOR_CANVAS_BG = '#8a8a8a';        // behind the globe — darker neutral grey
const COLOR_OCEAN = '#172540';
const COLOR_CELL = new THREE.Color('#2b3e67');
const COLOR_ANCHOR_FILL = new THREE.Color('#f06282');
const COLOR_ANCHOR_ANCESTOR_FILL = new THREE.Color('#d94668');
const COLOR_PENTAGON_FILL = new THREE.Color('#6e7480');
const COLOR_SHADOW_HIGH = new THREE.Color('#ff7a2a'); // orange, matches N-pole cone

const GLOBE_RADIUS = 1;
// Earth in world units: 1 unit = 6371 km. Used by cloudScale().
const EARTH_RADIUS_KM = 6371;
// A cloud at a given H3 resolution gets scaled to CLOUD_FILL_RATIO × the
// cell's vertex-radius. 0.70 matches the eyeball values that had been in
// place for res-0 (0.120) and res-2 (0.018), so the switch is a no-op —
// and now res-1 and res-3 automatically get proportional sizes too.
const CLOUD_FILL_RATIO = 0.70;
function cloudScale(res: number): number {
  const edgeKm = getHexagonEdgeLengthAvg(res, 'km');
  const cellRadiusWorld = edgeKm / EARTH_RADIUS_KM;
  return CLOUD_FILL_RATIO * cellRadiusWorld;
}
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

// Territory wolf: sized to fill the origin res-4 hex, fades in as the
// camera drops toward 1.25 (the camera minDistance).
const TERRITORY_WOLF_FADE_FAR = 1.5;
const TERRITORY_WOLF_FADE_NEAR = 1.25;

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

/** Great-circle bearing from (lat1,lng1) to (lat2,lng2), in radians. 0 = N, π/2 = E. */
function sphericalBearingRad(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const φ1 = lat1 * RAD;
  const φ2 = lat2 * RAD;
  const Δλ = (lng2 - lng1) * RAD;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return Math.atan2(y, x);
}

/** Inverse of latLngToVec3 — surface point on the globe → [lat, lng]. */
function vec3ToLatLng(v: THREE.Vector3): [number, number] {
  const r = v.length();
  const lat = 90 - Math.acos(Math.max(-1, Math.min(1, v.y / r))) * (180 / Math.PI);
  const lng = -Math.atan2(v.z, v.x) * (180 / Math.PI);
  return [lat, lng];
}

/**
 * Fill-ratio shading: cells blend from the base slate-blue toward warm amber
 * by how much of the cell is actually covered by Shadow. `maxShadowCount` is
 * the highest descendant count seen in the current resolution — the cell
 * with the densest Shadow presence reads as solid amber, everything else
 * grades down. `sqrt` eases the curve so a few-hex cell still shows a faint
 * warm tint rather than vanishing into the base.
 */
const COLOR_WHITE = new THREE.Color('#ffffff');

function colorForCell(
  c: PreparedCell,
  isAnchorCell: boolean,
  maxShadowCount: number,
  showShadow: boolean,
  uniformShadow: boolean,
  uniformWhite: boolean,
  tmp: THREE.Color,
): THREE.Color {
  if (uniformShadow) return tmp.copy(COLOR_SHADOW_HIGH);
  if (uniformWhite) return tmp.copy(COLOR_WHITE);
  if (showShadow && isAnchorCell) return tmp.copy(COLOR_ANCHOR_FILL);
  if (c.isPentagon) return tmp.copy(COLOR_PENTAGON_FILL);
  if (showShadow && c.shadowDescendantCount > 0 && maxShadowCount > 0) {
    const t = Math.sqrt(c.shadowDescendantCount / maxShadowCount);
    return tmp.copy(COLOR_CELL).lerp(COLOR_SHADOW_HIGH, t);
  }
  return tmp.copy(COLOR_CELL);
}

function buildCellsGeometry(cells: PreparedCell[], anchorCell: string, radius: number, showShadow: boolean, skipBaseCells = false, uniformShadow = false, uniformWhite = false): THREE.BufferGeometry {
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
    const color = colorForCell(c, c.cell === anchorCell, maxShadowCount, showShadow, uniformShadow, uniformWhite, tmp);
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
  uniformWhite = false,
}: {
  cells: PreparedCell[];
  anchorCell: string;
  radius: number;
  opacity: number;
  showShadow: boolean;
  skipBaseCells?: boolean;
  uniformShadow?: boolean;
  uniformWhite?: boolean;
}) {
  const geom = useMemo(
    () => buildCellsGeometry(cells, anchorCell, radius, showShadow, skipBaseCells, uniformShadow, uniformWhite),
    [cells, anchorCell, radius, showShadow, skipBaseCells, uniformShadow, uniformWhite],
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
function WolfToken({ opacity, scale = 0.000512 }: { opacity: number; scale?: number }) {
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
  return <primitive object={cloned} scale={scale} />;
}
useGLTF.preload('/tokens/wolf.glb');

/**
 * Wolf token sized to fill a res-4 hex. Res-4 edge ~22.6 km, diameter
 * (vertex-to-vertex) ~45 km; Earth radius in world units = 1 = 6371 km,
 * so hex diameter ≈ 0.0071 world units. We auto-measure the GLB's bounding
 * box and scale to that target so the token reads as "this hex is Shadow's".
 */
function TerritoryWolfToken({ opacity }: { opacity: number }) {
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
  const scale = useMemo(() => {
    const box = new THREE.Box3().setFromObject(cloned);
    const size = new THREE.Vector3();
    box.getSize(size);
    const native = Math.max(size.x, size.z, 0.0001);
    const targetSize = 0.006;
    return targetSize / native;
  }, [cloned]);
  useEffect(() => {
    cloned.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh && mesh.material && !Array.isArray(mesh.material)) {
        (mesh.material as THREE.Material).opacity = opacity;
      }
    });
  }, [cloned, opacity]);
  if (opacity <= 0.001) return null;
  return <primitive object={cloned} scale={scale} />;
}

/**
 * Renders the cloud GLB as one InstancedMesh per submesh. Geometry and
 * material are shared across all instances so memory cost stays flat as we
 * add more cloud cells. Each instance's transform = (hex pose on sphere) ×
 * (the submesh's local matrix inside the GLB), preserving the original
 * cloud composition per cell.
 */
function CloudFleet({
  positions,
  res,
  scaleFactor = 1,
  opacity = 0.5,
  surfaceOffset = 1.012,
  color = '#d8e6f5',
}: {
  positions: CloudCell[];
  res: number;
  scaleFactor?: number;
  opacity?: number;
  surfaceOffset?: number;
  color?: string;
}) {
  const scale = cloudScale(res) * scaleFactor;
  const { scene } = useGLTF('/models/weather/clouds.glb');

  const cloudMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthWrite: false,
    }),
    [color, opacity],
  );

  const submeshes = useMemo(() => {
    scene.updateMatrixWorld(true);
    const out: Array<{
      geometry: THREE.BufferGeometry;
      localMatrix: THREE.Matrix4;
    }> = [];
    scene.traverse((obj) => {
      const m = obj as THREE.Mesh;
      if (m.isMesh) {
        out.push({
          geometry: m.geometry,
          localMatrix: m.matrixWorld.clone(),
        });
      }
    });
    return out;
  }, [scene]);

  // Per-cell random heading, lazily initialized once and reused across
  // re-renders so a cloud doesn't spin to a new angle every time something
  // unrelated (zoom, click) re-runs the matrices memo.
  const yAngleByCell = useRef<Map<string, number>>(new Map());

  const baseMatrices = useMemo(() => {
    const upY = new THREE.Vector3(0, 1, 0);
    const sclVec = new THREE.Vector3(scale, scale, scale);
    return positions.map(({ cell, lat, lng }) => {
      let angle = yAngleByCell.current.get(cell);
      if (angle === undefined) {
        angle = Math.random() * Math.PI * 2;
        yAngleByCell.current.set(cell, angle);
      }
      const pos = latLngToVec3(lat, lng, GLOBE_RADIUS * surfaceOffset);
      const radial = pos.clone().normalize();
      const qRadial = new THREE.Quaternion().setFromUnitVectors(upY, radial);
      const qSpin = new THREE.Quaternion().setFromAxisAngle(upY, angle);
      const quat = qRadial.multiply(qSpin);
      return new THREE.Matrix4().compose(pos, quat, sclVec);
    });
  }, [positions, scale, surfaceOffset]);

  const refs = useRef<(THREE.InstancedMesh | null)[]>([]);
  useEffect(() => {
    submeshes.forEach((m, mi) => {
      const im = refs.current[mi];
      if (!im) return;
      const tmp = new THREE.Matrix4();
      baseMatrices.forEach((base, i) => {
        tmp.copy(base).multiply(m.localMatrix);
        im.setMatrixAt(i, tmp);
      });
      im.instanceMatrix.needsUpdate = true;
      im.count = baseMatrices.length;
    });
  }, [submeshes, baseMatrices]);

  if (positions.length === 0) return null;
  return (
    <>
      {submeshes.map((m, mi) => (
        <instancedMesh
          key={mi}
          ref={(ref) => { refs.current[mi] = ref; }}
          args={[m.geometry, cloudMaterial, positions.length]}
          frustumCulled={false}
        />
      ))}
    </>
  );
}
useGLTF.preload('/models/weather/clouds.glb');

/**
 * Ship fleet — same instancing pattern as CloudFleet, but keeps the GLB's
 * original PBR materials (cloned per submesh so the opacity override doesn't
 * leak back into the cached scene). Random Y heading per cell stays stable
 * across re-renders via yAngleByCell.
 */
function ShipFleet({ positions, headingByCell, color = '#c83232', opacity = 0.5, scale = 0.001 }: {
  positions: CloudCell[];
  headingByCell?: Map<string, number>; // compass bearing in radians
  color?: string;
  opacity?: number;
  scale?: number;
}) {
  const { scene } = useGLTF('/models/ships/ship.glb');

  // Single shared material across every ship submesh and instance — a
  // tinted, half-transparent flat material reads as a marker, not a model.
  const shipMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthWrite: false,
    }),
    [color, opacity],
  );

  const submeshes = useMemo(() => {
    scene.updateMatrixWorld(true);
    const out: Array<{
      geometry: THREE.BufferGeometry;
      localMatrix: THREE.Matrix4;
    }> = [];
    scene.traverse((obj) => {
      const m = obj as THREE.Mesh;
      if (m.isMesh) {
        out.push({
          geometry: m.geometry,
          localMatrix: m.matrixWorld.clone(),
        });
      }
    });
    return out;
  }, [scene]);

  const yAngleByCell = useRef<Map<string, number>>(new Map());

  // Radial-align + spin (the working version). Spin angle comes from
  // headingByCell when provided (so adjacent ships in the same cluster
  // share an angle and read as a fleet); otherwise stable random per cell.
  const baseMatrices = useMemo(() => {
    const upY = new THREE.Vector3(0, 1, 0);
    const sclVec = new THREE.Vector3(scale, scale, scale);
    return positions.map(({ cell, lat, lng }) => {
      const pos = latLngToVec3(lat, lng, GLOBE_RADIUS * 1.012);
      const up = pos.clone().normalize();
      let angle = headingByCell?.get(cell);
      if (angle === undefined) {
        angle = yAngleByCell.current.get(cell);
        if (angle === undefined) {
          angle = Math.random() * Math.PI * 2;
          yAngleByCell.current.set(cell, angle);
        }
      }
      const qRadial = new THREE.Quaternion().setFromUnitVectors(upY, up);
      const qSpin = new THREE.Quaternion().setFromAxisAngle(upY, angle);
      const quat = qRadial.multiply(qSpin);
      return new THREE.Matrix4().compose(pos, quat, sclVec);
    });
  }, [positions, scale, headingByCell]);

  const refs = useRef<(THREE.InstancedMesh | null)[]>([]);
  useEffect(() => {
    submeshes.forEach((m, mi) => {
      const im = refs.current[mi];
      if (!im) return;
      const tmp = new THREE.Matrix4();
      baseMatrices.forEach((base, i) => {
        tmp.copy(base).multiply(m.localMatrix);
        im.setMatrixAt(i, tmp);
      });
      im.instanceMatrix.needsUpdate = true;
      im.count = baseMatrices.length;
    });
  }, [submeshes, baseMatrices]);

  if (positions.length === 0) return null;
  return (
    <>
      {submeshes.map((m, mi) => (
        <instancedMesh
          key={mi}
          ref={(ref) => { refs.current[mi] = ref; }}
          args={[m.geometry, shipMaterial, positions.length]}
          frustumCulled={false}
        />
      ))}
    </>
  );
}
useGLTF.preload('/models/ships/ship.glb');

// Renders /api/world-events as small colored spheres. Color encodes event
// type (wildfire orange, earthquake yellow, etc.). Bare-mesh per event —
// counts are typically <300, well within budget for plain meshes.
interface EventMarker {
  id: string;
  type: string;
  lat: number;
  lng: number;
  title: string;
}

const EVENT_COLORS: Record<string, string> = {
  wildfires: '#ff6b1a',
  severestorms: '#9b3ee8',
  volcanoes: '#dc2626',
  sealakeice: '#7dd3fc',
  snow: '#f0f0f0',
  dusthaze: '#d4a373',
  manmade: '#71717a',
  watercolor: '#10b981',
  temperatureextremes: '#ec4899',
  earthquake: '#fbbf24',
  drought: '#facc15',
  floods: '#3b82f6',
  landslides: '#92400e',
};
const EVENT_LABELS: Record<string, string> = {
  wildfires: 'Wildfires',
  severestorms: 'Severe storms',
  volcanoes: 'Volcanoes',
  sealakeice: 'Sea/lake ice',
  snow: 'Snow',
  dusthaze: 'Dust/haze',
  manmade: 'Manmade',
  watercolor: 'Water color',
  temperatureextremes: 'Temp extremes',
  earthquake: 'Earthquakes',
  drought: 'Drought',
  floods: 'Floods',
  landslides: 'Landslides',
};
const EVENT_DEFAULT_COLOR = '#a1a1aa';

function EventMarkers({ events }: { events: EventMarker[] }) {
  return (
    <>
      {events.map(e => {
        const pos = latLngToVec3(e.lat, e.lng, GLOBE_RADIUS * 1.005);
        const color = EVENT_COLORS[e.type] ?? EVENT_DEFAULT_COLOR;
        return (
          <mesh key={e.id} position={pos}>
            <sphereGeometry args={[0.015, 12, 12]} />
            <meshBasicMaterial color={color} />
          </mesh>
        );
      })}
    </>
  );
}

// Earth texture + local terrain tiles are both clipped to Shadow's 7
// res-4 campaign hexes. Outside those hexes, the globe is slate — the
// world exists, but you only see the territory that "belongs" to Shadow.
const SLATE_COLOR = '#14171d';
const SHADOW_EARTH_RADIUS = GLOBE_RADIUS * 1.0; // just above the slate sphere (0.999)
const LOCAL_TILE_MAX_DISTANCE = 1.5;
const LOCAL_TILE_ZOOM = 9;
const LOCAL_TILE_TINT = '#ffffff'; // watercolor is already earth-toned; no tint
const LOCAL_TILE_RADIUS = GLOBE_RADIUS * 1.0008; // slightly above the Earth patches

function terrainTileUrl(z: number, x: number, y: number): string {
  // Stadia-hosted Stamen Watercolor. Works from localhost without an API
  // key (Stadia allows low-volume dev traffic by Referer). For production
  // we'll need a free Stadia key added via .env + URL param.
  return `https://tiles.stadiamaps.com/tiles/stamen_watercolor/${z}/${x}/${y}.jpg`;
}

// Three.js default sphere UV mapping expressed as a lat/lng function. Lets
// us sample the Blue Marble jpg at any point without going through the
// full sphereGeometry.
function equirectUV(lat: number, lng: number): [number, number] {
  const pos = latLngToVec3(lat, lng, 1);
  const u = 0.5 - Math.atan2(pos.z, pos.x) / (2 * Math.PI);
  const v = 0.5 - Math.asin(pos.y) / Math.PI;
  return [u, v];
}

// Builds a fan-triangulated hex patch: centroid + 6 boundary vertices,
// 6 triangles. UVs come from the provided uvFn so the same geometry can
// be textured from Blue Marble OR a slippy-map tile.
function buildHexPatchGeometry(
  boundary: Array<[number, number]>,
  center: [number, number],
  radius: number,
  uvFn: (lat: number, lng: number) => [number, number],
): THREE.BufferGeometry {
  const geom = new THREE.BufferGeometry();
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  // Vertex 0 = centroid
  const cp = latLngToVec3(center[0], center[1], radius);
  positions.push(cp.x, cp.y, cp.z);
  const [cu, cv] = uvFn(center[0], center[1]);
  uvs.push(cu, cv);

  // Vertices 1..n = boundary
  for (const [lat, lng] of boundary) {
    const p = latLngToVec3(lat, lng, radius);
    positions.push(p.x, p.y, p.z);
    const [u, v] = uvFn(lat, lng);
    uvs.push(u, v);
  }

  const n = boundary.length;
  for (let i = 0; i < n; i++) {
    indices.push(0, i + 1, ((i + 1) % n) + 1);
  }

  geom.setIndex(indices);
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  return geom;
}

function ShadowEarthPatches({ cells }: { cells: PreparedCell[] }) {
  const map = useTexture('/textures/earth_4096.jpg');
  const patches = useMemo(() => {
    return cells.map(c => ({
      cell: c.cell,
      geom: buildHexPatchGeometry(c.boundary, c.center, SHADOW_EARTH_RADIUS, equirectUV),
    }));
  }, [cells]);
  useEffect(() => () => patches.forEach(p => p.geom.dispose()), [patches]);
  return (
    <>
      {patches.map(p => (
        <mesh key={p.cell} geometry={p.geom}>
          <meshBasicMaterial map={map} />
        </mesh>
      ))}
    </>
  );
}

function ShadowTerrainHex({ cellData }: { cellData: PreparedCell }) {
  const [lat, lng] = cellData.center;
  const tileX = lngToTileX(lng, LOCAL_TILE_ZOOM);
  const tileY = latToTileY(lat, LOCAL_TILE_ZOOM);
  const texture = useTexture(terrainTileUrl(LOCAL_TILE_ZOOM, tileX, tileY));
  const geom = useMemo(() => {
    const bounds = tileBoundsLatLng(LOCAL_TILE_ZOOM, tileX, tileY);
    const uvFn = (la: number, ln: number): [number, number] => {
      const u = (ln - bounds.w) / (bounds.e - bounds.w);
      const v = (bounds.n - la) / (bounds.n - bounds.s);
      return [u, v];
    };
    return buildHexPatchGeometry(cellData.boundary, cellData.center, LOCAL_TILE_RADIUS, uvFn);
  }, [cellData, tileX, tileY]);
  useEffect(() => () => geom.dispose(), [geom]);
  return (
    <mesh geometry={geom}>
      <meshBasicMaterial map={texture} color={LOCAL_TILE_TINT} toneMapped={false} />
    </mesh>
  );
}

function ShadowTerrainPatches({ cells, cameraDistance }: { cells: PreparedCell[]; cameraDistance: number }) {
  if (cameraDistance > LOCAL_TILE_MAX_DISTANCE) return null;
  return (
    <Suspense fallback={null}>
      {cells.map(c => <ShadowTerrainHex key={c.cell} cellData={c} />)}
    </Suspense>
  );
}

// Cartography markers: dot + label for each named location. Labels only
// render at Tier 2 zoom or closer (cameraDistance ≤ 3.0) — keeps planetary
// view uncluttered.
const LOCATION_LABEL_MAX_DISTANCE = 3.0;
function LocationMarkers({ locations, cameraDistance }: { locations: Location[]; cameraDistance: number }) {
  const showLabels = cameraDistance <= LOCATION_LABEL_MAX_DISTANCE;
  return (
    <>
      {locations.map(loc => {
        const pos = latLngToVec3(loc.lat, loc.lng, GLOBE_RADIUS * 1.006);
        return (
          <group key={loc.id} position={pos}>
            <mesh>
              <sphereGeometry args={[0.0028, 16, 12]} />
              <meshBasicMaterial color="#ffcd5a" />
            </mesh>
            {showLabels && (
              <Html
                center={false}
                zIndexRange={[38, 0]}
                style={{ pointerEvents: 'none', userSelect: 'none', transform: 'translate(8px, -6px)' }}
              >
                <div style={{
                  color: '#f3e7cd',
                  fontFamily: "'EB Garamond', ui-serif, Georgia, serif",
                  fontSize: 13,
                  fontStyle: 'italic',
                  textShadow: '0 1px 2px rgba(0,0,0,0.9), 0 0 4px rgba(0,0,0,0.7)',
                  whiteSpace: 'nowrap',
                  letterSpacing: '0.02em',
                }}>
                  {loc.name}
                </div>
              </Html>
            )}
          </group>
        );
      })}
    </>
  );
}

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

function OceanSphere({ onSurfaceClick }: { onSurfaceClick?: (lat: number, lng: number) => void }) {
  // Slate void. Earth texture + terrain tiles only render inside Shadow's
  // 7 res-4 hexes via ShadowEarthPatches / ShadowTerrainPatches. The rest
  // of the globe reads as "unknown territory."
  return (
    <mesh
      onClick={onSurfaceClick ? (e) => {
        e.stopPropagation();
        const [lat, lng] = vec3ToLatLng(e.point);
        onSurfaceClick(lat, lng);
      } : undefined}
    >
      <sphereGeometry args={[GLOBE_RADIUS * 0.999, 96, 64]} />
      <meshBasicMaterial color={SLATE_COLOR} />
    </mesh>
  );
}

// Renders numeric labels at the centroids of the labeled res-2 hexes.
// Labels sit just above the surface, face camera, ignore pointer events so
// the underlying sphere click still fires.
function Res2Labels({ labels }: { labels: LabeledRes2Cell[] }) {
  return (
    <>
      {labels.map(l => {
        const pos = latLngToVec3(l.lat, l.lng, GLOBE_RADIUS * 1.006);
        return (
          <Html
            key={l.cell}
            position={pos}
            center
            zIndexRange={[40, 0]}
            style={{ pointerEvents: 'none', userSelect: 'none' }}
          >
            <div style={{
              color: '#ffffff',
              fontSize: 10,
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontWeight: 700,
              background: 'rgba(0,0,0,0.55)',
              padding: '1px 4px',
              borderRadius: 3,
              lineHeight: 1,
              whiteSpace: 'nowrap',
            }}>
              {l.number}
            </div>
          </Html>
        );
      })}
    </>
  );
}

// Track OrbitControls distance to auto-switch resolution.
function ZoomWatcher({ onChange }: { onChange: (distance: number) => void }) {
  useFrame(({ camera }) => {
    onChange(camera.position.length());
  });
  return null;
}

// Shifts the rendered scene down within the viewport via the camera's view
// offset, leaving empty space at the top. Negative y in setViewOffset
// extends the frustum's top edge upward, pushing visible content down.
const VIEW_OFFSET_FRACTION = 0.18;
function ViewOffset({ fraction = VIEW_OFFSET_FRACTION }: { fraction?: number }) {
  const { camera, size } = useThree();
  useEffect(() => {
    const persp = camera as THREE.PerspectiveCamera;
    if (!persp.isPerspectiveCamera) return;
    persp.setViewOffset(size.width, size.height, 0, -size.height * fraction, size.width, size.height);
    persp.updateProjectionMatrix();
    return () => {
      persp.clearViewOffset();
      persp.updateProjectionMatrix();
    };
  }, [camera, size.width, size.height, fraction]);
  return null;
}

// Exposes a camera-reset imperative handle up to the parent so the "Go to
// Blaen Hafren" button can reset view from outside the Canvas tree.
interface CameraControllerHandle {
  goToAnchor: () => void;
  setDistance: (d: number) => void;
  flyToAnchor: (distance: number) => void;
}
const CameraController = forwardRef<
  CameraControllerHandle,
  { anchorLat: number; anchorLng: number; controlsRef: React.MutableRefObject<OrbitControlsImpl | null> }
>(function CameraController({ anchorLat, anchorLng, controlsRef }, ref) {
  const { camera } = useThree();
  const anim = useRef<{
    startPos: THREE.Vector3;
    targetPos: THREE.Vector3;
    lookTarget: THREE.Vector3;
    startTime: number | null;
    duration: number;
  } | null>(null);

  useFrame(({ clock }) => {
    if (!anim.current) return;
    if (anim.current.startTime === null) anim.current.startTime = clock.elapsedTime;
    const t = Math.min(1, (clock.elapsedTime - anim.current.startTime) / anim.current.duration);
    const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
    camera.position.lerpVectors(anim.current.startPos, anim.current.targetPos, eased);
    camera.lookAt(anim.current.lookTarget);
    if (controlsRef.current) {
      controlsRef.current.target.copy(anim.current.lookTarget);
      controlsRef.current.update();
    }
    if (t >= 1) anim.current = null;
  });

  useImperativeHandle(ref, () => ({
    goToAnchor() {
      const v = latLngToVec3(anchorLat, anchorLng, 2.6);
      camera.position.set(v.x, v.y, v.z);
      camera.lookAt(0, 0, 0);
      if (controlsRef.current) {
        controlsRef.current.target.set(0, 0, 0);
        controlsRef.current.minDistance = 1.25;
        controlsRef.current.update();
      }
    },
    setDistance(d: number) {
      const dir = camera.position.clone().normalize();
      camera.position.copy(dir.multiplyScalar(d));
      if (controlsRef.current) {
        controlsRef.current.target.set(0, 0, 0);
        controlsRef.current.minDistance = 1.25;
        controlsRef.current.update();
      }
    },
    flyToAnchor(originDistance: number) {
      // Oblique view: camera sits south of the anchor at 40° elevation,
      // looking at the anchor. `originDistance` is the desired camera-to-
      // Earth-center distance at the end of the tween (matches the HUD
      // readout). Solves for anchor-offset `d` at the given pitch.
      const P = latLngToVec3(anchorLat, anchorLng, GLOBE_RADIUS);
      const up = P.clone().normalize();
      const globalNorth = new THREE.Vector3(0, 1, 0);
      const north = globalNorth.clone()
        .sub(up.clone().multiplyScalar(globalNorth.dot(up)))
        .normalize();
      const elevationRad = 40 * Math.PI / 180;
      const sinA = Math.sin(elevationRad);
      const cosA = Math.cos(elevationRad);
      // |P + d*(up*sinA - north*cosA)|² = originDistance²
      // → d² + 2*sinA*d + (1 - originDistance²) = 0
      const disc = sinA * sinA + (originDistance * originDistance - 1);
      const d = disc > 0 ? -sinA + Math.sqrt(disc) : 0.1;
      const offset = up.clone().multiplyScalar(sinA * d)
        .add(north.clone().multiplyScalar(-cosA * d));
      anim.current = {
        startPos: camera.position.clone(),
        targetPos: P.clone().add(offset),
        lookTarget: P,
        startTime: null,
        duration: 1.2,
      };
      // Target is on the surface now — let zoom go closer than the
      // planet-scale 1.25 floor. A floor of 0.1 keeps the camera outside
      // the Earth surface at any orbit angle around the anchor.
      if (controlsRef.current) {
        controlsRef.current.minDistance = 0.1;
      }
    },
  }));
  return null;
});

export default function Globe3DClient({ res2Cells, res3Cells, res4CampaignCells, res4EligibleCells, labeledRes2Cells, liveCloudCellsPrecip, anchorCell, anchorLat, anchorLng }: Props) {
  const [cameraDistance, setCameraDistance] = useState(2.5);
  const fillFade = fadeAmount(cameraDistance, FILL_FADE_FAR, FILL_FADE_NEAR);
  const res3Fade = fadeAmount(cameraDistance, RES3_FADE_FAR, RES3_FADE_NEAR);
  const wolfOpacity = 1 - fadeAmount(cameraDistance, WOLF_FADE_FAR, WOLF_FADE_NEAR);
  const territoryWolfOpacity = fadeAmount(cameraDistance, TERRITORY_WOLF_FADE_FAR, TERRITORY_WOLF_FADE_NEAR);
  const anchorOpacity = 1 - fadeAmount(cameraDistance, ANCHOR_FADE_FAR, ANCHOR_FADE_NEAR);
  const dominantRes = 3;
  const dominantCellCount = res3Cells.length;

  const initialCameraPos = useMemo(() => {
    // Open looking outward from the anchor (Blaen Hafren) — same framing as
    // the Reset button, so the wolf token sits near screen center on first
    // load and the N-pole cone reads above it. Combined with ViewOffset, the
    // globe sits in the lower portion of the viewport.
    const v = latLngToVec3(anchorLat, anchorLng, 2.6);
    return [v.x, v.y, v.z] as [number, number, number];
  }, [anchorLat, anchorLng]);

  const controllerRef = useRef<CameraControllerHandle>(null);
  const controlsRef = useRef<OrbitControlsImpl | null>(null);

  const labelByCell = useMemo(() => {
    const m = new Map<string, number>();
    labeledRes2Cells.forEach(l => m.set(l.cell, l.number));
    return m;
  }, [labeledRes2Cells]);

  const [selectedRes2, setSelectedRes2] = useState<{ cell: string; lat: number; lng: number } | null>(null);
  const [extraLabels, setExtraLabels] = useState<LabeledRes2Cell[]>([]);
  const [geoVisible, setGeoVisible] = useState(true);
  const [weatherVisible, setWeatherVisible] = useState(true);
  const [eventsVisible, setEventsVisible] = useState(true);

  const [worldEvents, setWorldEvents] = useState<EventMarker[]>([]);
  useEffect(() => {
    fetch('/api/world-events')
      .then(r => (r.ok ? r.json() : null))
      .then(data => { if (data?.events) setWorldEvents(data.events as EventMarker[]); })
      .catch(() => {});
  }, []);

  // Filter events to the N-hemisphere *and* within 25 grid steps of
  // Shadow's res-2 anchor hex. Resolves each event's lat/lng to a res-2
  // cell once, then checks membership in a pre-built Set.
  const EVENT_RING_K = 25;
  const shadowNearbyEvents = useMemo(() => {
    if (worldEvents.length === 0) return worldEvents;
    const shadowRes2 = cellToParent(anchorCell, 2);
    const ring = new Set(gridDisk(shadowRes2, EVENT_RING_K));
    return worldEvents.filter(e => {
      if (e.lat <= 0) return false;
      const cell = latLngToCell(e.lat, e.lng, 2);
      return ring.has(cell);
    });
  }, [worldEvents, anchorCell]);

  // Shadow's Earth / terrain patches cover both the 7-hex campaign and the
  // eligible-origin halo. Deduped since the campaign hexes are often a
  // subset of eligibles in the generator output.
  const shadowVisibleCells = useMemo<PreparedCell[]>(() => {
    const seen = new Set<string>();
    const out: PreparedCell[] = [];
    for (const c of [...res4CampaignCells, ...res4EligibleCells]) {
      if (seen.has(c.cell)) continue;
      seen.add(c.cell);
      out.push(c);
    }
    return out;
  }, [res4CampaignCells, res4EligibleCells]);

  const eventCountsByType = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of shadowNearbyEvents) m.set(e.type, (m.get(e.type) ?? 0) + 1);
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [shadowNearbyEvents]);

  const handleSurfaceClick = (lat: number, lng: number) => {
    const cell = latLngToCell(lat, lng, 2);
    setSelectedRes2({ cell, lat, lng });
    if (!labelByCell.has(cell)) {
      setExtraLabels(prev => {
        if (prev.some(l => l.cell === cell)) return prev;
        const [cLat, cLng] = cellToLatLng(cell);
        return [
          ...prev,
          { cell, lat: cLat, lng: cLng, number: labeledRes2Cells.length + prev.length + 1 },
        ];
      });
    }
  };

  const allLabels = useMemo(() => [...labeledRes2Cells, ...extraLabels], [labeledRes2Cells, extraLabels]);
  const numberFor = (cell: string): number | undefined =>
    labelByCell.get(cell) ?? extraLabels.find(l => l.cell === cell)?.number;

  // Stable per-session "dropped" set — 20% of locally-configured cloud
  // cells are randomly skipped to thin out the pattern. Lazy-init on first
  // pass so refreshes bring a new drop pattern but clicks don't re-roll it.
  const droppedCloudCellsRef = useRef<Set<string> | null>(null);

  // Cloud placement is keyed by hex number, derived from the combined label
  // set. This lets us reference click-assigned numbers (170+) — they only
  // resolve once the user has clicked the hex this session.
  const derivedCloudCells = useMemo<CloudCell[]>(() => {
    const cellByNumber = new Map<number, LabeledRes2Cell>();
    for (const l of allLabels) cellByNumber.set(l.number, l);

    const seen = new Set<string>();
    const out: CloudCell[] = [];
    const push = (cell: string, lat: number, lng: number) => {
      if (seen.has(cell)) return;
      seen.add(cell);
      out.push({ cell, lat, lng });
    };
    for (const n of CLOUD_NUMBERS_WITH_NEIGHBORS) {
      const base = cellByNumber.get(n);
      if (!base) continue;
      for (const neighbor of gridDisk(base.cell, 1)) {
        const [lat, lng] = cellToLatLng(neighbor);
        push(neighbor, lat, lng);
      }
    }
    for (const n of CLOUD_NUMBERS_EXACT) {
      const c = cellByNumber.get(n);
      if (c) push(c.cell, c.lat, c.lng);
    }

    // Lazily freeze a 20% drop set on first pass. New cells added later
    // (via click → CLOUD_NUMBERS_EXACT match) fall outside the frozen set
    // and always render, which is the right behavior for "I just chose
    // this hex, show it".
    if (!droppedCloudCellsRef.current) {
      const drop = new Set<string>();
      for (const c of out) {
        if (Math.random() < 0.2) drop.add(c.cell);
      }
      droppedCloudCellsRef.current = drop;
    }
    return out.filter(c => !droppedCloudCellsRef.current!.has(c.cell));
  }, [allLabels]);

  const derivedShipCells = useMemo<CloudCell[]>(() => {
    const cellByNumber = new Map<number, LabeledRes2Cell>();
    for (const l of allLabels) cellByNumber.set(l.number, l);
    const out: CloudCell[] = [];
    for (const n of SHIP_NUMBERS_EXACT) {
      const c = cellByNumber.get(n);
      if (c) out.push({ cell: c.cell, lat: c.lat, lng: c.lng });
    }
    return out;
  }, [allLabels]);

  // Cluster ships by H3 adjacency (within 2 grid steps at res 2). All
  // ships in a cluster share one Y-spin angle so they read as a fleet.
  // Angle is seeded from the cluster's first cell ID — stable, tied to
  // the hex tile itself, no land detection.
  const shipHeadingByCell = useMemo<Map<string, number>>(() => {
    const headings = new Map<string, number>();
    if (derivedShipCells.length === 0) return headings;

    const N = derivedShipCells.length;
    const parent = Array.from({ length: N }, (_, i) => i);
    const find = (i: number): number => {
      while (parent[i] !== i) {
        parent[i] = parent[parent[i]];
        i = parent[i];
      }
      return i;
    };
    const union = (a: number, b: number) => {
      const ra = find(a); const rb = find(b);
      if (ra !== rb) parent[ra] = rb;
    };
    for (let i = 0; i < N; i++) {
      const disk = new Set(gridDisk(derivedShipCells[i].cell, 2));
      for (let j = i + 1; j < N; j++) {
        if (disk.has(derivedShipCells[j].cell)) union(i, j);
      }
    }

    const clusters = new Map<number, number[]>();
    for (let i = 0; i < N; i++) {
      const r = find(i);
      if (!clusters.has(r)) clusters.set(r, []);
      clusters.get(r)!.push(i);
    }
    // Hash a cell ID to a stable [0, 2π) angle so reloads pick the same
    // direction per cluster.
    const angleFromCell = (cellId: string): number => {
      let h = 0;
      for (let i = 0; i < cellId.length; i++) {
        h = ((h << 5) - h + cellId.charCodeAt(i)) | 0;
      }
      return ((h >>> 0) % 10000) / 10000 * Math.PI * 2;
    };
    for (const members of clusters.values()) {
      const seedCell = derivedShipCells[members[0]].cell;
      const angle = angleFromCell(seedCell);
      for (const idx of members) {
        headings.set(derivedShipCells[idx].cell, angle);
      }
    }
    return headings;
  }, [derivedShipCells]);

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
          {cameraDistance <= LOCAL_TILE_MAX_DISTANCE && (
            <div className="text-[0.6rem] opacity-50" style={{ lineHeight: 1.4 }}>
              Tiles © Stamen Design · Stadia Maps · OSM contributors
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1.5 pt-2" style={{ borderTop: '1px solid #2a3a5e' }}>
          <div className="text-[0.65rem] uppercase tracking-[0.15em] opacity-70">Layers</div>
          <LayerToggle label="Geo" on={geoVisible} onToggle={() => setGeoVisible(v => !v)} />
          <LayerToggle label="Weather" on={weatherVisible} onToggle={() => setWeatherVisible(v => !v)} />
          <LayerToggle label="Events" on={eventsVisible} onToggle={() => setEventsVisible(v => !v)} />
        </div>

        {eventCountsByType.length > 0 && (
          <div className="flex flex-col gap-1.5 pt-2" style={{ borderTop: '1px solid #2a3a5e' }}>
            <div className="text-[0.65rem] uppercase tracking-[0.15em] opacity-70">Events</div>
            {eventCountsByType.map(([type, count]) => (
              <LegendChip
                key={type}
                fill={EVENT_COLORS[type] ?? EVENT_DEFAULT_COLOR}
                label={`${EVENT_LABELS[type] ?? type} (${count})`}
              />
            ))}
          </div>
        )}

        <div className="flex flex-col gap-1.5 pt-2" style={{ borderTop: '1px solid #2a3a5e' }}>
          <LegendChip fill="#ff7a2a" label="Shadow" />
          <LegendChip fill="#ffffff" label="Eligible" />
          <LegendChip fill="#6e7480" label="Astral void" />
          <LegendChip fill="#7a9ed0" label="Res-2 outline" />
          <LegendChip fill="#a8c0ea" label="Res-3 outline" />
        </div>

        <div className="flex flex-col gap-1.5 pt-2" style={{ borderTop: '1px solid #2a3a5e' }}>
          <div className="text-[0.65rem] uppercase tracking-[0.15em] opacity-70">Selected hex (res 2)</div>
          {selectedRes2 ? (
            <div className="flex flex-col gap-0.5" style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
              <div>
                <span className="opacity-60">#</span>
                <strong style={{ color: '#ffd479' }}>{numberFor(selectedRes2.cell)}</strong>
              </div>
              <div style={{ wordBreak: 'break-all', color: '#d0e0ff' }}>{selectedRes2.cell}</div>
              <div className="opacity-70">
                {selectedRes2.lat.toFixed(3)}, {selectedRes2.lng.toFixed(3)}
              </div>
            </div>
          ) : (
            <div className="opacity-50 italic">click the globe</div>
          )}
        </div>
      </aside>

      {/* Canvas fills the rest */}
      <div style={{ flex: 1, position: 'relative' }}>
        <Canvas
          camera={{ position: initialCameraPos, fov: 35, near: 0.005, far: 100 }}
          gl={{ antialias: true }}
          style={{ background: COLOR_CANVAS_BG }}
        >
          <ambientLight intensity={1} />
          {geoVisible && (
            <OceanSphere onSurfaceClick={handleSurfaceClick} />
          )}
          {geoVisible && (
            <Suspense fallback={null}>
              <ShadowEarthPatches cells={shadowVisibleCells} />
            </Suspense>
          )}
          {geoVisible && (
            <ShadowTerrainPatches
              cells={shadowVisibleCells}
              cameraDistance={cameraDistance}
            />
          )}
          {weatherVisible && (
            <>
              {/* Clouds = "rain is happening here" — precipitation > 0.05 mm
                  in any res-2 hex within 10 grid steps of Shadow's anchor.
                  Manual cloud config + global N-hemi cloud_cover layers
                  are parked while we test this rule. */}
              <Suspense fallback={null}>
                <CloudFleet positions={liveCloudCellsPrecip} res={2} surfaceOffset={1.0132} />
              </Suspense>
            </>
          )}
          <Suspense fallback={null}>
            <ShipFleet positions={derivedShipCells} headingByCell={shipHeadingByCell} />
          </Suspense>

          {eventsVisible && <EventMarkers events={shadowNearbyEvents} />}
          {/* <LocationMarkers locations={CARTOGRAPHY} cameraDistance={cameraDistance} /> — hidden until sizing/labels are reworked */}
          {/* <Res2Labels labels={allLabels} /> — labels hidden; still power cloud/ship config + side panel */}
          <OutlineLayer
            cells={res2Cells}
            radius={RES2_OUTLINE_RADIUS}
            color="#7a9ed0"
            opacity={0.55 /* DEBUG: forced on (was 0.55 * fillFade) */}
          />
          <OutlineLayer
            cells={res3Cells}
            radius={RES3_OUTLINE_RADIUS}
            color="#a8c0ea"
            opacity={0.45 * res3Fade}
          />
          {/* Eligible origins — res-4 hexes a new campaign may anchor to
              (within 20 hexes of Shadow's outermost). White, low opacity. */}
          <CellLayer
            cells={res4EligibleCells}
            anchorCell={anchorCell}
            radius={RES3_FILL_RADIUS}
            opacity={0.22}
            showShadow={false}
            uniformWhite
          />
          {/* Shadow's 7-hex campaign — origin + 6 adjacent hexes, orange. */}
          <CellLayer
            cells={res4CampaignCells}
            anchorCell={anchorCell}
            radius={RES3_FILL_RADIUS}
            opacity={0.55}
            showShadow={true}
            uniformShadow
          />
          <OutlineLayer
            cells={res4CampaignCells}
            radius={RES3_OUTLINE_RADIUS}
            color="#ffffff"
            opacity={0.7}
          />
          <AnchorMarker lat={anchorLat} lng={anchorLng} opacity={anchorOpacity} />

          {/* Planetary wolf token — visible at planetary zoom, fades out
              between 1.75 → 1.25 so it's gone before Tier 3 tiles take over. */}
          <Suspense fallback={null}>
            <HexPin lat={anchorLat} lng={anchorLng} radiusScale={1.003}>
              <group
                onClick={e => {
                  e.stopPropagation();
                  controllerRef.current?.flyToAnchor(1.1);
                }}
                onPointerOver={e => {
                  e.stopPropagation();
                  document.body.style.cursor = 'pointer';
                }}
                onPointerOut={() => {
                  document.body.style.cursor = '';
                }}
              >
                <WolfToken opacity={wolfOpacity} />
              </group>
            </HexPin>
          </Suspense>

          {/* Territory wolf hidden at terrain level — it previously faded in
              between 1.5 → 1.25, exactly where Tier 3 tiles render, which
              caused the oversized 3D wolf to stomp on the map. Keep off
              until we redesign it as a small screen-space marker. */}

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
          <ViewOffset />
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

function LayerToggle({ label, on, onToggle }: { label: string; on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="text-[0.7rem] uppercase tracking-[0.12em] font-sans transition-colors"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        background: 'transparent',
        border: `1px solid ${on ? '#4a7a5a' : '#3e5683'}`,
        color: on ? '#7ac28a' : '#6b7a98',
        cursor: 'pointer',
        padding: '4px 8px',
        borderRadius: 2,
      }}
    >
      <span>{label}</span>
      <span style={{
        display: 'inline-block',
        width: 10,
        height: 10,
        borderRadius: '50%',
        background: on ? '#2d8a4e' : 'transparent',
        border: `1.5px solid ${on ? '#2d8a4e' : '#6b7a98'}`,
      }} />
    </button>
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
