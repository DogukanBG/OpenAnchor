#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
mkdir -p assets/icons/OpenAnchor.iconset
for size in 16 32 128 256 512; do
 sips -z "$size" "$size" assets/icons/openanchor-blue.png --out "assets/icons/OpenAnchor.iconset/icon_${size}x${size}.png" >/dev/null
 doubled=$((size * 2))
 sips -z "$doubled" "$doubled" assets/icons/openanchor-blue.png --out "assets/icons/OpenAnchor.iconset/icon_${size}x${size}@2x.png" >/dev/null
done
node scripts/pack-icon.cjs
