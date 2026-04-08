---
name: ar-asset-optimizer
description: "Assess, optimize, and validate GLB + USDZ models used by the AR encounter page. Run this whenever a new AR asset is added to public/models/ or whenever an existing asset is updated. Targets a ~1-2 MB hero model budget."
---

# AR Asset Optimizer

The `/ar` page renders spawn models in two formats: **GLB** for the R3F preview and Android Scene Viewer, **USDZ** for iOS QuickLook. Unoptimized exports from Blender/Fab are routinely 20–40 MB — this skill shrinks them 20–90× without visible quality loss.

**Invoke whenever** a new `.glb` or `.usdz` file lands in `public/models/` (e.g. the DM adds a new creature/prop — that tool doesn't exist yet, see TODO in CLAUDE.md).

## When to use

- A new `.glb` or `.usdz` file is dropped into `public/models/`
- An existing AR model is replaced
- The user asks "optimize this model" / "shrink this glb" / "why is the AR page slow"
- Git shows a new model > 2 MB

## Budget

| Asset type | Target size | Textures |
|---|---:|---|
| Hero / primary spawn | **≤ 2 MB** | 1024×1024 JPG (color/ORM) + PNG (normal) |
| Background prop | ≤ 500 KB | 512×512 JPG |
| Icon-scale | ≤ 100 KB | 256×256 JPG |

A 4K texture at 32-bit is 64 MB in GPU memory. Mobile phones have 1–4 GB VRAM shared with every other app. Never ship 4K textures for AR.

## Assessment (do this first)

```bash
cd /tmp && npx --yes @gltf-transform/cli inspect /Users/moon/blackmoor/public/models/<file>.glb
```

Look for:
- **Texture resolution** — anything >1024 for a hero model is bloat
- **Texture mimeType** — PNG for color/ORM is ~5× bigger than JPG for no benefit
- **Multiple top-level nodes** when only one is rendered (stray Cubes, duplicate meshes)
- **TANGENT attribute** — normal-mapped meshes must have this or lighting breaks
- **Vertex count** — usually not the problem; a 5K-vert model is fine

For USDZ, `unzip -l` to list contents. Every file in `0/*.jpg` or `0/*.png` is a texture; count them and check sizes.

## Optimization pipeline — GLB

Use `scripts/optimize-glb.mjs` (sibling of this SKILL.md). It performs:

1. **Prune unused top-level nodes** — pass `KEEP_NODE` as argv[3] to specify which node to keep (default: the only one, or the first).
2. **`prune()` + `dedup()` + `flatten()` + `join()`** — drop orphans left behind.
3. **MikkTSpace tangents** — `unweld → tangents → weld`. Required for normal maps to look correct.
4. **Resize + re-encode textures** — 1024×1024 JPG q85 for color/ORM, 1024×1024 PNG for normal (lossy normals cause visible banding in lighting).
5. **Draco geometry compression** — tiny gain here but free.
6. **Final prune pass.**

```bash
cd /tmp/glb-opt  # or create if missing: npm init -y && npm i @gltf-transform/core @gltf-transform/functions @gltf-transform/extensions sharp draco3dgltf mikktspace
node /Users/moon/blackmoor/.claude/skills/ar-asset-optimizer/scripts/optimize-glb.mjs \
  /Users/moon/blackmoor/public/models/<in>.glb \
  /Users/moon/blackmoor/public/models/<out>.glb \
  [KeepNodeName]
```

**Don't use WebP for GLB textures** — gltf-transform's textureCompress writes WebP bytes but fails to declare `EXT_texture_webp` in `extensionsUsed`, producing a technically-invalid file that some loaders reject. Use JPG/PNG.

## Optimization pipeline — USDZ

USDZ is a zip archive containing a `.usdc` (binary USD) scene + textures under `0/`. Optimization is more manual because there's no all-in-one CLI.

Use `scripts/optimize-usdz.sh`. It performs:

1. **Unzip** to a working directory.
2. **`usdcat file.usdc -o file.usda`** — convert binary USD to ASCII so we can text-edit it. (`usdcat` + `usdzip` come from the Pixar USD toolkit; they're in `/usr/bin/` on macOS.)
3. **`strip-prims.py`** — drop top-level material + mesh prim blocks for any node we don't want, brace-matched.
4. **Delete corresponding texture files** from the `0/` subdirectory.
5. **`magick ... -resize 1024x1024\> -quality 80`** — resize remaining JPG textures in place.
6. **`usdcat back to .usdc`** — re-serialize the modified scene.
7. **`usdzip`** — repack the archive. The order matters: `.usdc` first, then texture files.
8. **`usdchecker`** — validate the final archive. It must say "Success!".

```bash
bash /Users/moon/blackmoor/.claude/skills/ar-asset-optimizer/scripts/optimize-usdz.sh \
  /Users/moon/blackmoor/public/models/<in>.usdz \
  /Users/moon/blackmoor/public/models/<out>.usdz \
  [PrimNameToStrip]
```

## Validation

After every optimization:

```bash
# GLB — must be zero errors, zero warnings
cd /tmp && npx --yes @gltf-transform/cli validate /Users/moon/blackmoor/public/models/<file>.glb

# USDZ — must print "Success!"
usdchecker /Users/moon/blackmoor/public/models/<file>.usdz
```

Acceptable info-level notes:
- `UNSUPPORTED_EXTENSION KHR_draco_mesh_compression` — the validator doesn't understand Draco; Three.js handles it
- `UNUSED_OBJECT bufferViews/N` — harmless orphan

Any other error/warning: investigate. Do NOT ship a file that fails validation.

## Visual sanity check

- **USDZ**: `open -a Preview <file>.usdz` — macOS Preview renders USDZ natively.
- **GLB**: macOS doesn't support GLB in QuickLook. Use [gltf-viewer.donmccurdy.com](https://gltf-viewer.donmccurdy.com) (drag-and-drop in browser) or recommend the user does so.

## Reporting

When reporting results, use this table format:

| | Before | After | Δ |
|---|---:|---:|---:|
| File size | X MB | Y KB | N× |
| Textures | A × 4K PNG | B × 1K JPG | — |
| GPU VRAM | X MB | Y MB | N× |

Include the validator status line and a one-sentence quality note.

## Rollback

Keep the original file alongside the optimized one until the user confirms the result looks right:

```bash
mv public/models/<file>.glb public/models/<file>.big.glb.bak
cp /tmp/optimized.glb public/models/<file>.glb
```

If the user says "looks broken" or "geometry missing," restore from `.bak` and try with gentler settings (2K textures, higher JPG quality, or keep PNG).

## Known pitfalls

- **Tangent generation skips welded primitives.** MikkTSpace requires unwelded geometry. Pipeline: `unweld() → tangents() → weld()`. Missing this step skips tangent generation silently; the normal map still "works" but lighting will look subtly wrong.
- **gltf-transform WebP output is non-conformant.** See note above — use JPG/PNG.
- **USDZ texture paths are embedded in the usdc.** If you rename textures, you must also edit the usdc references. Easier to keep original filenames and only edit/delete contents.
- **`usdzip` order matters.** The `.usdc` file must come first in the archive; `usdzip` enforces this.
- **Normal maps need PNG or high-quality JPG.** Lossy compression produces visible banding in specular highlights. Use PNG when in doubt.
- **`ensureSchema` memoization** doesn't apply here but adjacent projects may — if you touch code that affects build, restart the dev server.

## Skill files

- `SKILL.md` — this file
- `scripts/optimize-glb.mjs` — GLB optimization script (Node + gltf-transform)
- `scripts/optimize-usdz.sh` — USDZ optimization pipeline (bash + usdcat/usdzip + imagemagick)
- `scripts/strip-prims.py` — brace-matched USDA prim remover (called by optimize-usdz.sh)
