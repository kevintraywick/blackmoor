#!/usr/bin/env node
// AR GLB optimizer — used by the ar-asset-optimizer skill.
//
// Usage:
//   node optimize-glb.mjs <in.glb> <out.glb> [KeepNodeName]
//
// Runs the full pipeline:
//   1. Strip every top-level scene node except KeepNodeName (if specified)
//   2. Prune orphaned materials/textures/meshes/accessors
//   3. dedup + flatten + join + resample
//   4. MikkTSpace tangents (unweld → tangents → weld) — normal maps need this
//   5. Resize textures to 1024×1024, JPG q85 for color/ORM, PNG for normal
//   6. Draco geometry compression
//   7. Final prune pass
//
// Requires the following packages (install once in a scratch dir):
//   npm i @gltf-transform/core @gltf-transform/functions @gltf-transform/extensions \
//         sharp draco3dgltf mikktspace

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import {
  prune,
  dedup,
  resample,
  textureCompress,
  draco,
  flatten,
  join,
  tangents,
  unweld,
  weld,
} from '@gltf-transform/functions';
import { generateTangents } from 'mikktspace';
import draco3d from 'draco3dgltf';
import sharp from 'sharp';

const IN = process.argv[2];
const OUT = process.argv[3];
const KEEP_NODE = process.argv[4]; // optional

if (!IN || !OUT) {
  console.error('usage: optimize-glb.mjs <in.glb> <out.glb> [KeepNodeName]');
  process.exit(1);
}

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    'draco3d.decoder': await draco3d.createDecoderModule(),
    'draco3d.encoder': await draco3d.createEncoderModule(),
  });

const doc = await io.read(IN);
const root = doc.getRoot();
const scene = root.listScenes()[0];

// 1. Strip every top-level scene node whose name isn't the one we want to keep.
if (KEEP_NODE) {
  for (const node of scene.listChildren()) {
    if (node.getName() !== KEEP_NODE) {
      console.log(`removing top-level node: ${node.getName()}`);
      node.dispose();
    }
  }
}

// 2. Standard pruning pipeline. Drops orphans left behind by node removal.
await doc.transform(
  prune({ keepAttributes: false, keepIndices: false }),
  dedup(),
  flatten(),
  join({ keepMeshes: false, keepNamed: false }),
  resample(),
);

// 3. Generate MikkTSpace tangents. Required for normal maps — without
// TANGENT attributes, most loaders fall back to runtime generation which
// is non-portable across implementations.
await doc.transform(
  unweld(),
  tangents({ generateTangents }),
  weld(),
);

// 4. Resize textures to 1024 and re-encode.
// JPG for color/ORM/emissive (small, universal).
// PNG for normal maps (lossless — JPG causes specular banding).
// Do NOT use WebP: gltf-transform fails to declare EXT_texture_webp,
// producing a technically-invalid file some loaders reject.
await doc.transform(
  textureCompress({
    encoder: sharp,
    resize: [1024, 1024],
    targetFormat: 'jpeg',
    quality: 85,
    slots: /baseColor|metallicRoughness|emissive|occlusion/i,
  }),
  textureCompress({
    encoder: sharp,
    resize: [1024, 1024],
    targetFormat: 'png',
    slots: /normal/i,
  }),
);

// 5. Draco geometry compression. Marginal savings on small meshes but free.
await doc.transform(draco({ method: 'edgebreaker' }));

// 6. Final prune.
await doc.transform(prune());

await io.write(OUT, doc);
console.log(`\nwrote ${OUT}`);
