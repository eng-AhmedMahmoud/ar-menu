#!/usr/bin/env python3
"""
Knock the background out of a dish photo before sending it to image-to-3D.

Studio food shots sit on a white sweep, and the mesher happily models that
sweep as a flat slab welded to the dish. The Space's own rembg step did not
catch it on a low-resolution source, so the alpha is cut here instead: flood
from the border, treat near-white connected pixels as background, and leave a
transparent PNG the mesher reads as "nothing here".

  python3 scripts/cutout.py public/photos/margherita.jpg
"""
import sys
from collections import deque
from pathlib import Path
from PIL import Image

THRESHOLD = 232      # per-channel minimum to count as "white enough"
UPSCALE_TO = 1024    # meshers resolve far more detail from a larger source


def cut(src: Path) -> Path:
    img = Image.open(src).convert("RGB")
    w, h = img.size
    px = img.load()

    def is_bg(x, y):
        r, g, b = px[x, y]
        return r >= THRESHOLD and g >= THRESHOLD and b >= THRESHOLD

    # Flood from the border only, so white *inside* the dish (cheese, a plate
    # rim) is never punched out.
    seen = [[False] * h for _ in range(w)]
    queue = deque()
    for x in range(w):
        for y in (0, h - 1):
            if is_bg(x, y) and not seen[x][y]:
                seen[x][y] = True
                queue.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if is_bg(x, y) and not seen[x][y]:
                seen[x][y] = True
                queue.append((x, y))

    while queue:
        x, y = queue.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h and not seen[nx][ny] and is_bg(nx, ny):
                seen[nx][ny] = True
                queue.append((nx, ny))

    out = img.convert("RGBA")
    op = out.load()
    cleared = 0
    for x in range(w):
        for y in range(h):
            if seen[x][y]:
                op[x, y] = (0, 0, 0, 0)
                cleared += 1

    # Crop to the subject so it fills the frame, then upscale — both materially
    # improve what the mesher has to work with.
    bbox = out.getbbox()
    if bbox:
        out = out.crop(bbox)
    if max(out.size) < UPSCALE_TO:
        ratio = UPSCALE_TO / max(out.size)
        out = out.resize((round(out.width * ratio), round(out.height * ratio)), Image.LANCZOS)

    dest = src.with_name(f"{src.stem}_cut.png")
    out.save(dest)
    pct = 100 * cleared / (w * h)
    print(f"{src.name} -> {dest.name}  bg removed {pct:.1f}%  final {out.size[0]}x{out.size[1]}")
    return dest


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit("usage: cutout.py <image> [image...]")
    for arg in sys.argv[1:]:
        cut(Path(arg))
