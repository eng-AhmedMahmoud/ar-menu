#!/usr/bin/env python3
"""
Free image-to-3D via the Tencent Hunyuan3D-2.1 Space on HuggingFace.

Unlike the commercial services, this one actually hands back the file: the Space
exposes a Gradio API and the generated mesh downloads to disk. The catch is
ZeroGPU quota — the textured endpoint requests 270s of GPU time, so a free token
affords roughly one dish per day. HF PRO raises the daily budget to 40 minutes.

  python3 scripts/generate_hf.py              # every dish missing a model
  python3 scripts/generate_hf.py margherita   # one dish

Reads HF_TOKEN from .env. Writes public/models/<slug>_raw.glb, then hands off to
scripts/convert.py (Blender) for the decimated .glb + .usdz the page serves.
"""

import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

try:
    from gradio_client import Client, handle_file
except ImportError:
    sys.exit("gradio_client missing. Run:\n  .venv-hy/bin/pip install gradio_client")

ROOT = Path(__file__).resolve().parent.parent
MODELS = ROOT / "public" / "models"
PHOTOS = ROOT / "public" / "photos"
DOWNLOADS = ROOT / ".hf-out"

SPACE = os.environ.get("HF_SPACE", "tencent/Hunyuan3D-2.1")
BLENDER = os.environ.get(
    "BLENDER_BIN", "/Applications/Blender.app/Contents/MacOS/Blender"
)
MAX_FACES = int(os.environ.get("MAX_FACES", "150000"))


def load_token() -> str:
    token = os.environ.get("HF_TOKEN")
    if token:
        return token
    env = ROOT / ".env"
    if env.exists():
        match = re.search(r"^HF_TOKEN=(\S+)", env.read_text(), re.M)
        if match:
            return match.group(1)
    sys.exit(
        "Missing HF_TOKEN.\n\n"
        "  Create a free read token at https://huggingface.co/settings/tokens\n"
        "  then add HF_TOKEN=hf_... to .env\n"
    )


def pick_textured(result) -> str:
    """
    /generation_all returns (white_mesh, textured_mesh, html, stats, seed).

    Both entries are meshes, so taking the first match silently yields the
    untextured one — index order is the only thing that distinguishes them.
    """
    paths = []
    for item in result:
        value = item.get("value") if isinstance(item, dict) else item
        if isinstance(value, str) and Path(value).exists():
            if Path(value).suffix.lower() in (".glb", ".obj", ".ply"):
                paths.append(value)
    if not paths:
        raise RuntimeError(f"no mesh in result: {str(result)[:300]}")
    # Last mesh is the textured one; with a single output it is also the only one.
    return paths[-1]


def convert(raw: Path, slug: str) -> None:
    if not Path(BLENDER).exists():
        print(f"  ! Blender not at {BLENDER} — skipping .glb/.usdz conversion")
        return
    subprocess.run(
        [BLENDER, "--background", "--python", str(ROOT / "scripts" / "convert.py"),
         "--", str(raw), slug, str(MAX_FACES)],
        check=True,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.STDOUT,
    )
    print(f"  ✓ {slug}.glb + {slug}.usdz")


def generate(client, dish) -> None:
    slug, image = dish["slug"], dish["image"]
    src = PHOTOS / image
    if not src.exists():
        raise RuntimeError(f"photo missing: {src}")

    result = client.predict(
        image=handle_file(str(src)),
        steps=int(os.environ.get("HF_STEPS", "30")),
        guidance_scale=5.0,
        seed=1234,
        octree_resolution=int(os.environ.get("HF_OCTREE", "256")),
        check_box_rembg=True,
        num_chunks=8000,
        randomize_seed=False,
        api_name="/generation_all",
    )

    textured = pick_textured(result)
    raw = MODELS / f"{slug}_raw{Path(textured).suffix}"
    shutil.copy(textured, raw)
    print(f"  ✓ {raw.name} ({raw.stat().st_size // 1024} KB)")
    convert(raw, slug)


def main() -> None:
    token = load_token()
    MODELS.mkdir(parents=True, exist_ok=True)
    DOWNLOADS.mkdir(parents=True, exist_ok=True)

    menu = json.loads((ROOT / "menu.json").read_text())
    only = set(sys.argv[1:])
    dishes = [d for d in menu["dishes"] if not only or d["slug"] in only]
    if not dishes:
        sys.exit("No dishes matched.")

    todo = [d for d in dishes if not (MODELS / f"{d['slug']}.glb").exists() or only]
    if not todo:
        print("All dishes already have models.")
        return

    print(f"\n{SPACE}: {len(todo)} dish(es)\n")
    client = Client(SPACE, hf_token=token, verbose=False, download_files=str(DOWNLOADS))

    failures = []
    for dish in todo:
        print(f"  → {dish['slug']}")
        try:
            generate(client, dish)
        except Exception as err:
            message = str(err).replace("\n", " ")
            if "quota" in message.lower():
                # The daily budget is the binding constraint here, not an outage,
                # so say so plainly instead of burying it in a stack trace.
                print(f"  ✗ {dish['slug']}: ZeroGPU quota exhausted.\n    {message[:200]}")
                print("\n  Free tokens afford ~1 textured dish/day. Options: wait for the\n"
                      "  reset above, or subscribe to HF PRO for 40 min/day.\n")
                failures.append(dish["slug"])
                break
            print(f"  ✗ {dish['slug']}: {message[:200]}")
            failures.append(dish["slug"])

    done = len(todo) - len(failures)
    print(f"\nDone. {done}/{len(todo)} succeeded.")
    if failures:
        print(f"Remaining: {', '.join(failures)}")
        sys.exit(1)


if __name__ == "__main__":
    main()
