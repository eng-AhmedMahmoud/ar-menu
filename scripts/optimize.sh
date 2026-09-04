#!/usr/bin/env bash
# Shrink a generated mesh for phone delivery.
#
# Order matters and the two targets need different treatment:
#   1. Downscale textures to 1024 while keeping their original encoding — USD
#      cannot read WebP, so the file Blender turns into .usdz must stay on a
#      format Quick Look decodes.
#   2. Blender scales the dish to its real-world size and emits .glb + .usdz.
#   3. Re-encode only the .glb with WebP textures and Draco geometry, both of
#      which model-viewer decodes and Quick Look does not.
#
#   ./scripts/optimize.sh <slug> <target-width-metres>
set -euo pipefail

SLUG="$1"
WIDTH="${2:-0.30}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MODELS="$ROOT/public/models"
BLENDER="${BLENDER_BIN:-/Applications/Blender.app/Contents/MacOS/Blender}"
RAW="$MODELS/${SLUG}_raw.glb"
TMP="$(mktemp -d)"

[ -f "$RAW" ] || { echo "missing $RAW"; exit 1; }
before=$(stat -f%z "$RAW" 2>/dev/null || stat -c%s "$RAW")

# `optimize --texture-compress false` skips the texture pipeline entirely,
# resize included, so the dedicated command is the one that actually shrinks
# them while leaving the encoding alone.
npx gltf-transform resize "$RAW" "$TMP/tex.glb" --width 1024 --height 1024 >/dev/null 2>&1

"$BLENDER" --background --python "$ROOT/scripts/convert.py" -- \
  "$TMP/tex.glb" "$SLUG" 150000 "$WIDTH" >/dev/null 2>&1

npx gltf-transform optimize "$MODELS/$SLUG.glb" "$TMP/web.glb" \
  --texture-compress webp --texture-size 1024 --compress draco --simplify false >/dev/null 2>&1
mv "$TMP/web.glb" "$MODELS/$SLUG.glb"

glb=$(stat -f%z "$MODELS/$SLUG.glb" 2>/dev/null || stat -c%s "$MODELS/$SLUG.glb")
usdz=$(stat -f%z "$MODELS/$SLUG.usdz" 2>/dev/null || stat -c%s "$MODELS/$SLUG.usdz")
rm -rf "$TMP"
awk -v s="$SLUG" -v b="$before" -v g="$glb" -v u="$usdz" 'BEGIN{
  printf "%-14s raw %6.2f MB  ->  glb %6.2f MB   usdz %6.2f MB   (-%d%%)\n",
    s, b/1048576, g/1048576, u/1048576, (1-(g+u)/(b*2))*100 }'
