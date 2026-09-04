#!/usr/bin/env bash
# Shrink a generated mesh for phone delivery without flattening it.
#
# The two targets have different capabilities, so they get different budgets:
#
#   .glb  — model-viewer decodes Draco and WebP, so geometry compresses roughly
#           10:1 and the full face count survives at a small file size.
#   .usdz — Quick Look decodes neither, so every face and texture byte is paid
#           for uncompressed. It gets a decimated mesh instead.
#
# Texture resolution is the other half of perceived detail; 2048 is kept rather
# than the 1024 used previously, which was visibly softening the food.
#
#   ./scripts/optimize.sh <slug> <target-width-metres>
set -euo pipefail

SLUG="$1"
WIDTH="${2:-0.30}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MODELS="$ROOT/public/models"
BLENDER="${BLENDER_BIN:-/Applications/Blender.app/Contents/MacOS/Blender}"
TEX="${TEX_SIZE:-2048}"
USDZ_FACES="${USDZ_FACES:-60000}"
RAW="$MODELS/${SLUG}_raw.glb"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

[ -f "$RAW" ] || { echo "missing $RAW"; exit 1; }
before=$(stat -f%z "$RAW" 2>/dev/null || stat -c%s "$RAW")

# `optimize --texture-compress false` silently skips the whole texture pipeline,
# resize included. The dedicated command is the one that actually resizes.
npx gltf-transform resize "$RAW" "$TMP/tex.glb" --width "$TEX" --height "$TEX" >/dev/null 2>&1

# --- iOS: decimated geometry, textures left in a format USD can read ---
"$BLENDER" --background --python "$ROOT/scripts/convert.py" -- \
  "$TMP/tex.glb" "$SLUG" "$USDZ_FACES" "$WIDTH" >/dev/null 2>&1
# convert.py emits both formats on every run, so the decimated .usdz has to be
# parked before the high-poly pass overwrites it.
mv "$MODELS/$SLUG.usdz" "$TMP/keep.usdz"
rm -f "$MODELS/$SLUG.glb"

# --- web/Android: full face count, Draco + WebP ---
"$BLENDER" --background --python "$ROOT/scripts/convert.py" -- \
  "$TMP/tex.glb" "$SLUG" 400000 "$WIDTH" >/dev/null 2>&1
mv "$TMP/keep.usdz" "$MODELS/$SLUG.usdz"
npx gltf-transform optimize "$MODELS/$SLUG.glb" "$TMP/web.glb" \
  --texture-compress webp --texture-size "$TEX" --compress draco --simplify false >/dev/null 2>&1
mv "$TMP/web.glb" "$MODELS/$SLUG.glb"

faces=$(npx gltf-transform inspect "$MODELS/$SLUG.glb" 2>/dev/null | grep -iEo '[0-9,]+ *$' | head -1 || echo "?")
glb=$(stat -f%z "$MODELS/$SLUG.glb" 2>/dev/null || stat -c%s "$MODELS/$SLUG.glb")
usdz=$(stat -f%z "$MODELS/$SLUG.usdz" 2>/dev/null || stat -c%s "$MODELS/$SLUG.usdz")
awk -v s="$SLUG" -v b="$before" -v g="$glb" -v u="$usdz" 'BEGIN{
  printf "%-14s raw %6.2f MB  ->  glb %5.2f MB   usdz %5.2f MB\n", s, b/1048576, g/1048576, u/1048576 }'
