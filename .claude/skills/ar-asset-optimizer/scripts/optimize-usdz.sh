#!/usr/bin/env bash
# AR USDZ optimizer — used by the ar-asset-optimizer skill.
#
# Usage:
#   optimize-usdz.sh <in.usdz> <out.usdz> [PrimNameToStrip]
#
# Pipeline:
#   1. Unzip the usdz to a working directory
#   2. Convert .usdc → .usda via usdcat
#   3. (optional) Strip named prim blocks via strip-prims.py
#   4. Delete texture files associated with stripped prims
#   5. Resize remaining textures to 1024 JPG q80 via imagemagick
#   6. Convert .usda back to .usdc
#   7. Repack with usdzip
#   8. Validate with usdchecker
#
# Requires on PATH: usdcat, usdzip, usdchecker (macOS: /usr/bin/),
#                   magick (imagemagick), python3
#
# Quits on first error.

set -euo pipefail

IN="${1:?usage: optimize-usdz.sh <in.usdz> <out.usdz> [PrimNameToStrip]}"
OUT="${2:?usage: optimize-usdz.sh <in.usdz> <out.usdz> [PrimNameToStrip]}"
STRIP_PREFIX="${3:-}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
STRIP_PRIMS="${SCRIPT_DIR}/strip-prims.py"

WORK="$(mktemp -d -t usdz-opt.XXXXXX)"
trap 'rm -rf "$WORK"' EXIT

echo "→ work dir: $WORK"
cd "$WORK"

# 1. Unzip
mkdir ext && cd ext
unzip -q "$IN"
USDC_FILE="$(find . -maxdepth 1 -name '*.usdc' | head -n1)"
if [[ -z "${USDC_FILE}" ]]; then
  echo "no .usdc file found in archive" >&2
  exit 1
fi
USDC_FILE="${USDC_FILE#./}"
echo "→ scene file: $USDC_FILE"

# 2. usdc → usda
usdcat "$USDC_FILE" -o "${WORK}/scene.usda"

# 3. Strip named prims if requested
SCENE_USDA="${WORK}/scene.usda"
if [[ -n "$STRIP_PREFIX" ]]; then
  echo "→ stripping prim blocks matching '${STRIP_PREFIX}*'"
  python3 "$STRIP_PRIMS" "$SCENE_USDA" "${WORK}/scene.stripped.usda" "$STRIP_PREFIX"
  SCENE_USDA="${WORK}/scene.stripped.usda"

  # 4. Delete texture files matching the stripped prefix
  echo "→ removing '${STRIP_PREFIX}*' textures"
  find 0 -type f -iname "${STRIP_PREFIX}*" -print -delete 2>/dev/null || true
fi

# 5. Resize remaining textures to 1024 JPG q80
echo "→ resizing remaining textures to 1024"
shopt -s nullglob
for f in 0/*.jpg 0/*.jpeg 0/*.JPG 0/*.JPEG; do
  magick "$f" -resize '1024x1024>' -quality 80 "$f"
done
for f in 0/*.png 0/*.PNG; do
  # normal maps we keep as PNG, but still resize
  magick "$f" -resize '1024x1024>' "$f"
done
shopt -u nullglob

# 6. usda → usdc
echo "→ writing optimized usdc"
usdcat "$SCENE_USDA" -o "$USDC_FILE"

# 7. Repack — usdc MUST come first in the archive per the usdz spec
echo "→ packaging usdz"
# Collect texture files (preserve 0/ subdir layout)
TEX_FILES=()
while IFS= read -r -d '' f; do
  TEX_FILES+=("${f#./}")
done < <(find 0 -type f -print0)

rm -f "$OUT"
usdzip "$OUT" "$USDC_FILE" "${TEX_FILES[@]}"

# 8. Validate
echo "→ validating with usdchecker"
usdchecker "$OUT"

# Final size report
SIZE_IN=$(stat -f%z "$IN" 2>/dev/null || stat -c%s "$IN")
SIZE_OUT=$(stat -f%z "$OUT" 2>/dev/null || stat -c%s "$OUT")
RATIO=$(awk "BEGIN { printf \"%.1f\", $SIZE_IN / $SIZE_OUT }")
echo ""
echo "  input : $(numfmt --to=iec $SIZE_IN 2>/dev/null || echo $SIZE_IN bytes)"
echo "  output: $(numfmt --to=iec $SIZE_OUT 2>/dev/null || echo $SIZE_OUT bytes)"
echo "  ratio : ${RATIO}× smaller"
