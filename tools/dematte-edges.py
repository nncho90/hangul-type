"""Remove the pale matte ring around enemy walk/hit sprites.

The 512x512 enemy frames (walk-1..4, hit-1..2) were exported with a pale,
fully-opaque band just OUTSIDE the figure's pixel-art keyline. It reads as a
"white border" / box on screen. The boss + idle/step sprites don't have it,
so this brings the rest in line.

Approach
--------
1. Find the exterior empty region: fully-transparent pixels reachable from
   the canvas border.
2. Flood out from there through pixels that are *not solid figure*: empty,
   pale/whiteish, or very-light anti-aliasing. The flood stops at the
   figure's dark keyline / coloured body, so it only ever reaches the
   exterior matte band -- interior whites (fur, robes, teeth, faces) are
   enclosed by the keyline and never reached.
3. Among the reached pixels, clear (-> fully transparent) the ones that are
   pale/whiteish. To bound damage on characters that are themselves white
   (gumiho, cheonyeo's dress) we only clear within DEPTH_CAP pixels of the
   exterior empty region, so at most a few pixels of genuinely-white art can
   ever be nicked.
4. Defringe the remaining partial-alpha edge pixels (RGB <- average of their
   opaque neighbours) so nothing pale leaks at the new edge.
5. Safety: if a frame would lose more than 35% of its opaque pixels the
   flood has clearly leaked through a gap in the keyline; that file is left
   untouched and a warning is printed.

Usage
-----
  tools/.venv/bin/python tools/dematte-edges.py [--dry-run] [paths...]
With no paths, processes sprites/enemies/*-walk-*.png and *-hit-*.png.
Originals are backed up to sprites/_old-<date>/enemies/ before rewrite.
"""
import sys
import glob
import shutil
import datetime
import pathlib
from collections import deque
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
ENEMY_DIR = ROOT / 'sprites' / 'enemies'

DEPTH_CAP = 10        # max distance (px) from the exterior empty region to clear
LEAK_LIMIT = 0.35     # abort a file if it would lose more than this fraction of opaque px

# --- minimal arg parsing: flags, --max-clear-pct N, then positional paths ---
DRY = False
_argv = sys.argv[1:]
ARG_PATHS = []
_i = 0
while _i < len(_argv):
    a = _argv[_i]
    if a == '--dry-run':
        DRY = True
    elif a == '--max-clear-pct' and _i + 1 < len(_argv):
        # Stricter cap for a run, e.g. 7 = skip files that would lose >7% of opaque px.
        # Handy on the player batch where a too-eager flood can reach a flat weapon blade;
        # the conservative "thin box around the figure" cases are well under 7%.
        LEAK_LIMIT = min(LEAK_LIMIT, float(_argv[_i + 1]) / 100.0)
        _i += 1
    elif a.startswith('--'):
        pass  # ignore unknown flags
    else:
        ARG_PATHS.append(a)
    _i += 1


def is_whiteish(r, g, b):
    return min(r, g, b) > 135 and (max(r, g, b) - min(r, g, b)) < 60


def luminance(r, g, b):
    return 0.299 * r + 0.587 * g + 0.114 * b


def dematte(im: Image.Image):
    if im.mode != 'RGBA':
        im = im.convert('RGBA')
    px = im.load()
    w, h = im.size

    NB4 = ((1, 0), (-1, 0), (0, 1), (0, -1))

    # --- exterior empty region: a==0 pixels reachable from the border ---
    ext = [[False] * w for _ in range(h)]
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if not ext[y][x] and px[x, y][3] == 0:
                ext[y][x] = True; q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if not ext[y][x] and px[x, y][3] == 0:
                ext[y][x] = True; q.append((x, y))
    while q:
        x, y = q.popleft()
        for dx, dy in NB4:
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h and not ext[ny][nx] and px[nx, ny][3] == 0:
                ext[ny][nx] = True; q.append((nx, ny))

    # --- depth (Manhattan steps) from the exterior empty region, through any pixels ---
    INF = 1 << 30
    depth = [[INF] * w for _ in range(h)]
    q = deque()
    for y in range(h):
        for x in range(w):
            if ext[y][x]:
                depth[y][x] = 0; q.append((x, y))
    while q:
        x, y = q.popleft()
        d = depth[y][x]
        if d >= DEPTH_CAP:
            continue
        for dx, dy in NB4:
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h and depth[ny][nx] > d + 1:
                depth[ny][nx] = d + 1; q.append((nx, ny))

    # --- flood out from the exterior through "not solid figure" pixels ---
    def passable(x, y):
        r, g, b, a = px[x, y]
        if a == 0:
            return True
        if is_whiteish(r, g, b):
            return True
        if a < 250 and luminance(r, g, b) > 205:
            return True
        return False

    reached = [[False] * w for _ in range(h)]
    q = deque()
    for y in range(h):
        for x in range(w):
            if ext[y][x]:
                reached[y][x] = True; q.append((x, y))
    while q:
        x, y = q.popleft()
        for dx, dy in NB4:
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h and not reached[ny][nx] and passable(nx, ny):
                reached[ny][nx] = True; q.append((nx, ny))

    total_opaque = sum(1 for y in range(h) for x in range(w) if px[x, y][3] == 255)
    cleared = 0
    for y in range(h):
        for x in range(w):
            if not reached[y][x]:
                continue
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            if is_whiteish(r, g, b) and depth[y][x] <= DEPTH_CAP:
                px[x, y] = (0, 0, 0, 0)
                cleared += 1

    if total_opaque and cleared / total_opaque > LEAK_LIMIT:
        return None, cleared, total_opaque

    # --- defringe leftover partial-alpha pixels ---
    targets = [(x, y) for y in range(h) for x in range(w) if 0 < px[x, y][3] < 255]
    updates = {}
    for x, y in targets:
        ar = ag = ab = n = 0
        for dy in range(-2, 3):
            for dx in range(-2, 3):
                nx, ny = x + dx, y + dy
                if 0 <= nx < w and 0 <= ny < h and px[nx, ny][3] == 255:
                    rr, gg, bb, _ = px[nx, ny]
                    ar += rr; ag += gg; ab += bb; n += 1
        if n:
            a0 = px[x, y][3]
            updates[(x, y)] = (ar // n, ag // n, ab // n, a0)
    for (x, y), v in updates.items():
        px[x, y] = v

    return im, cleared, total_opaque


def main():
    if ARG_PATHS:
        files = [pathlib.Path(p) for p in ARG_PATHS]
    else:
        files = sorted(
            [pathlib.Path(p) for p in glob.glob(str(ENEMY_DIR / '*-walk-*.png'))]
            + [pathlib.Path(p) for p in glob.glob(str(ENEMY_DIR / '*-hit-*.png'))]
        )
    print(f"Processing {len(files)} sprite(s)  (DEPTH_CAP={DEPTH_CAP})")

    sprites_root = (ROOT / 'sprites').resolve()
    backup_root = ROOT / 'sprites' / f"_old-{datetime.date.today():%Y-%m-%d}"

    def backup_path_for(p: pathlib.Path) -> pathlib.Path:
        p = p.resolve()
        try:
            rel = p.relative_to(sprites_root)          # e.g. player/01-...png
        except ValueError:
            rel = pathlib.Path(p.name)                 # outside sprites/: just the filename
        return backup_root / rel

    done = skipped = 0
    for p in files:
        try:
            im = Image.open(p)
        except Exception as e:
            print(f"  skip {p.name}: {e}")
            continue
        out, cleared, total = dematte(im)
        if out is None:
            print(f"  !! {p.name}: flood leaked ({cleared}/{total} opaque) -- LEFT UNTOUCHED")
            skipped += 1
            continue
        pct = (cleared / total * 100) if total else 0
        if DRY:
            print(f"  [dry] {p.name}: would clear {cleared} matte px ({pct:.1f}% of opaque)")
        else:
            bak = backup_path_for(p)
            if not bak.exists():
                bak.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(p, bak)
            out.save(p)
            done += 1
            print(f"  {p.name}: cleared {cleared} matte px ({pct:.1f}%)")
    if DRY:
        print("Dry run only -- nothing written.")
    else:
        print(f"Done. Rewrote {done} file(s); backups under {backup_root.relative_to(ROOT)}/. Skipped {skipped}.")


if __name__ == '__main__':
    main()
