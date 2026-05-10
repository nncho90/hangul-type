"""Regenerate sprites/index.json — the manifest the Sprite Manager UI loads.

Run this after adding/removing PNGs in sprites/ subdirectories. The output is
a flat map of category → sorted filename list. Skips the diagnostic _wait_*
and _fail_* PNGs that the image-gen pipeline drops alongside real sprites.

Usage:
    python3 tools/build-sprite-index.py
"""
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parent.parent / "sprites"
CATEGORIES = ["player", "enemies", "vfx", "backgrounds"]


def main():
    manifest = {}
    for cat in CATEGORIES:
        d = ROOT / cat
        if not d.is_dir():
            continue
        files = sorted(
            f.name for f in d.iterdir()
            if f.suffix == ".png" and not f.name.startswith("_")
        )
        manifest[cat] = files
    out = ROOT / "index.json"
    out.write_text(json.dumps(manifest, indent=2) + "\n")
    total = sum(len(v) for v in manifest.values())
    print(f"Wrote {out.relative_to(ROOT.parent)} — {total} sprites across {len(manifest)} categories")
    for cat, files in manifest.items():
        print(f"  {cat:12s}: {len(files):3d} files")


if __name__ == "__main__":
    main()
