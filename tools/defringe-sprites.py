"""Strip the white halo from enemy PNGs.

The halo comes from RGB color leaking through alpha when the source PNG
was authored on a white background. Browsers blend the partial-alpha
edge pixels against the page background (white-ish) and you see a fringe.

Fix: for every pixel with alpha < 255, replace its RGB with the average
RGB of its nearest fully-opaque neighbors. Now the anti-aliased edge
blends from the sprite color into transparent — no white leakage.

Usage: tools/.venv/bin/python tools/defringe-sprites.py [--dry-run]
"""
import sys
import pathlib
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
ENEMY_DIR = ROOT / 'sprites' / 'enemies'
DRY = '--dry-run' in sys.argv


def defringe(im: Image.Image) -> Image.Image:
    if im.mode != 'RGBA':
        im = im.convert('RGBA')
    px = im.load()
    w, h = im.size
    # Pass 1: collect target coords (partial alpha) + opaque neighbors.
    targets = []
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if 0 < a < 255:
                targets.append((x, y))
    # Pass 2: for each partial-alpha pixel, average RGB of opaque neighbors
    # within a 2-pixel ring. Falls back to the existing RGB if no neighbor.
    new_px = {}
    for x, y in targets:
        ar = ag = ab = 0
        n = 0
        for dy in range(-2, 3):
            for dx in range(-2, 3):
                nx, ny = x + dx, y + dy
                if not (0 <= nx < w and 0 <= ny < h):
                    continue
                rr, gg, bb, aa = px[nx, ny]
                if aa == 255:
                    ar += rr; ag += gg; ab += bb; n += 1
        if n:
            r0, g0, b0, a0 = px[x, y]
            new_px[(x, y)] = (ar // n, ag // n, ab // n, a0)
    for (x, y), v in new_px.items():
        px[x, y] = v
    return im


def main():
    pngs = sorted(ENEMY_DIR.glob('*.png'))
    print(f"Found {len(pngs)} enemy PNGs")
    changed = 0
    for p in pngs:
        try:
            im = Image.open(p)
        except Exception as e:
            print(f"  skip {p.name}: {e}")
            continue
        out = defringe(im)
        if DRY:
            print(f"  [dry] {p.name}")
        else:
            out.save(p)
            changed += 1
            if changed % 8 == 0:
                print(f"  defringed {changed}/{len(pngs)}…")
    print(f"Done. Wrote {changed} files." if not DRY else f"Dry-run only.")


if __name__ == '__main__':
    main()
