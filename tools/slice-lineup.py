#!/usr/bin/env python3
"""
Slice a horizontal character lineup PNG into individual transparent-background
sprite PNGs at game resolution.

Usage:
  python3 slice-lineup.py <input.png> <output-dir> <prefix> [--bg-tolerance 25]

Example:
  python3 slice-lineup.py player-back-tiers-v8.png sprites/player back

Background-detection: any pixel with all channels >= (255 - tolerance) is treated
as background (off-white #f4f6f8) and made transparent. Character bounding boxes
are derived from contiguous columns containing non-background pixels.

Each character is then placed into a 256x256 transparent canvas, scaled to fit
~80% of vertical with a small ground shadow margin.
"""

import sys
from pathlib import Path
from PIL import Image
import numpy as np

NAMES = ['baegui', 'namukkun', 'seonbi', 'yangban', 'mugwan', 'janggun', 'daewang']
ENEMY_NAMES = ['dokkaebi-mini', 'gumiho-mini', 'cheonyeo-gwisin', 'dueokshini',
               'dokkaebi-elder', 'jeoseung-saja', 'mudang', 'hangeulwang']


def find_character_columns(arr, bg_threshold):
    """Return list of (col_start, col_end) for each character in the lineup."""
    # arr: H x W x 3 (RGB) or H x W x 4 (RGBA)
    rgb = arr[:, :, :3]
    is_bg = np.all(rgb >= bg_threshold, axis=2)  # True where pixel is background
    has_content = ~is_bg                          # True where pixel is character
    col_has_content = has_content.any(axis=0)     # True for columns containing any character pixel

    # Find runs of consecutive True columns
    runs = []
    start = None
    for i, val in enumerate(col_has_content):
        if val and start is None:
            start = i
        elif not val and start is not None:
            runs.append((start, i))
            start = None
    if start is not None:
        runs.append((start, len(col_has_content)))

    # Filter out tiny runs (anti-shadow noise) — character must be at least 50px wide
    runs = [r for r in runs if (r[1] - r[0]) >= 50]
    return runs


def split_wide_runs(runs, expected_count):
    """If we detected fewer runs than expected (because some characters touched
    each other in the image), split any run that's wider than 1.4x the median."""
    if len(runs) >= expected_count:
        return runs
    widths = sorted([r[1] - r[0] for r in runs])
    median = widths[len(widths) // 2]
    fixed = []
    for col_start, col_end in runs:
        w = col_end - col_start
        n_chars = max(1, round(w / median))
        if n_chars > 1:
            seg_w = w / n_chars
            for k in range(n_chars):
                s = int(col_start + k * seg_w)
                e = int(col_start + (k + 1) * seg_w)
                fixed.append((s, e))
        else:
            fixed.append((col_start, col_end))
    return fixed


def flood_fill_bg_mask(rgb, bg_threshold):
    """Return a boolean mask of background pixels reachable from the image corners.

    Only pixels connected to the outer edge that are >= bg_threshold on all
    channels are treated as background. This prevents anti-aliased edge pixels
    (which blend toward the background color) from being classified as background
    and creating halo artifacts around character outlines.
    """
    H, W = rgb.shape[:2]
    is_light = np.all(rgb >= bg_threshold, axis=2)  # candidate bg pixels

    visited = np.zeros((H, W), dtype=bool)
    # Seed from all four edges
    seeds = []
    for r in range(H):
        if is_light[r, 0]:
            seeds.append((r, 0))
        if is_light[r, W - 1]:
            seeds.append((r, W - 1))
    for c in range(W):
        if is_light[0, c]:
            seeds.append((0, c))
        if is_light[H - 1, c]:
            seeds.append((H - 1, c))

    # BFS flood fill
    from collections import deque
    queue = deque()
    for seed in seeds:
        r, c = seed
        if not visited[r, c]:
            visited[r, c] = True
            queue.append((r, c))

    while queue:
        r, c = queue.popleft()
        for dr, dc in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            nr, nc = r + dr, c + dc
            if 0 <= nr < H and 0 <= nc < W and not visited[nr, nc] and is_light[nr, nc]:
                visited[nr, nc] = True
                queue.append((nr, nc))

    return visited  # True = outer background


def crop_with_transparency(img, box, bg_threshold):
    """Crop the box region and apply chroma-key + soft-alpha background removal.

    Strategy (combines two ideas):
      1) Flood-fill from canvas corners with a LIBERAL bg threshold (rgb > 180)
         to identify the OUTER background region — including its anti-aliased
         fringe pixels that the strict threshold (>= 230) was missing. Interior
         pockets (e.g. white robes inside the character outline) stay protected.
      2) For pixels inside that flood-filled outer-bg region, compute color
         distance from the canonical bg color #f4f6f8 and ramp alpha smoothly:
            distance < 12   → fully transparent (pure bg)
            distance > 50   → fully opaque (already character-like, near edge)
            in between      → linear partial alpha (smooth anti-aliased edge)

    This eliminates the halo fringe that the prior threshold-only and
    flood-fill-only approaches both produced.
    """
    cropped = img.crop(box).convert('RGBA')
    arr = np.array(cropped)
    rgb = arr[:, :, :3].astype(np.int16)
    H, W = arr.shape[:2]

    # Step 1 — generous flood-fill from corners. RGB > 180 on all channels
    # captures the outer bg + its anti-aliased fringe.
    LIBERAL = 180
    is_light = np.all(rgb >= LIBERAL, axis=2)
    visited = np.zeros((H, W), dtype=bool)
    from collections import deque
    queue = deque()
    for r in range(H):
        for c in (0, W - 1):
            if is_light[r, c] and not visited[r, c]:
                visited[r, c] = True
                queue.append((r, c))
    for c in range(W):
        for r in (0, H - 1):
            if is_light[r, c] and not visited[r, c]:
                visited[r, c] = True
                queue.append((r, c))
    while queue:
        r, c = queue.popleft()
        for dr, dc in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            nr, nc = r + dr, c + dc
            if 0 <= nr < H and 0 <= nc < W and not visited[nr, nc] and is_light[nr, nc]:
                visited[nr, nc] = True
                queue.append((nr, nc))
    outer_bg_mask = visited  # True where this pixel is reachable bg

    # Step 2 — compute color distance from canonical bg only for pixels in the
    # outer-bg-mask. Pure bg → alpha 0; edge anti-aliased → partial; opaque
    # character pixels (NOT in outer-bg-mask) keep alpha 255.
    BG_COLOR = np.array([244, 246, 248], dtype=np.int16)  # #f4f6f8
    diff = rgb - BG_COLOR
    dist = np.sqrt((diff * diff).sum(axis=2))
    NEAR = 12.0
    FAR = 50.0
    # Linear ramp 0..1 across [NEAR, FAR]; below NEAR → 0; above FAR → 1.
    ramp = np.clip((dist - NEAR) / (FAR - NEAR), 0.0, 1.0)
    new_alpha = (ramp * 255).astype(np.uint8)
    # Apply only to pixels in the outer-bg flood-fill region.
    arr[outer_bg_mask, 3] = new_alpha[outer_bg_mask]
    return Image.fromarray(arr, 'RGBA')


def fit_to_canvas(sprite, canvas_size=256, fill_ratio=0.95):
    """Scale sprite to fill ~95% of canvas height, placed to use the full canvas."""
    sw, sh = sprite.size
    target_h = int(canvas_size * fill_ratio)
    scale = target_h / sh
    new_w = max(1, int(sw * scale))
    new_h = max(1, int(sh * scale))
    sprite_resized = sprite.resize((new_w, new_h), Image.NEAREST)

    # Place on canvas: horizontally centered, baseline flush to bottom (no margin)
    canvas = Image.new('RGBA', (canvas_size, canvas_size), (0, 0, 0, 0))
    paste_x = (canvas_size - new_w) // 2
    paste_y = canvas_size - new_h
    canvas.paste(sprite_resized, (paste_x, paste_y), sprite_resized)
    return canvas


def main():
    if len(sys.argv) < 4:
        print("Usage: slice-lineup.py <input.png> <output-dir> <suffix> [--bg-tolerance N]")
        sys.exit(1)
    input_path = Path(sys.argv[1])
    output_dir = Path(sys.argv[2])
    suffix = sys.argv[3]  # e.g. 'back', 'front', 'enemy'

    bg_tolerance = 25
    if '--bg-tolerance' in sys.argv:
        bg_tolerance = int(sys.argv[sys.argv.index('--bg-tolerance') + 1])
    bg_threshold = 255 - bg_tolerance

    img = Image.open(input_path).convert('RGB')
    arr = np.array(img)
    H, W = arr.shape[:2]
    print(f"Loaded {input_path.name}: {W}×{H}, bg_threshold={bg_threshold}")

    runs = find_character_columns(arr, bg_threshold)
    print(f"Detected {len(runs)} characters at columns: {runs}")

    if suffix == 'enemy':
        names = ENEMY_NAMES
    else:
        names = NAMES

    if len(runs) < len(names):
        print(f"  ⚠ Only {len(runs)} runs vs {len(names)} expected — splitting wide runs")
        runs = split_wide_runs(runs, len(names))
        print(f"  After split: {len(runs)} characters at columns: {runs}")

    if len(runs) > len(names):
        print(f"⚠ Detected {len(runs)} characters but only {len(names)} names — using first {len(names)}")
        runs = runs[:len(names)]
    elif len(runs) < len(names):
        print(f"⚠ Still only {len(runs)} characters after split; expected {len(names)}. Manual review needed.")

    output_dir.mkdir(parents=True, exist_ok=True)

    for i, (col_start, col_end) in enumerate(runs):
        name = names[i] if i < len(names) else f"char-{i+1:02d}"
        # Add small horizontal margin
        margin = 8
        x0 = max(0, col_start - margin)
        x1 = min(W, col_end + margin)
        # Find vertical extent: scan only this column range for non-bg pixels
        strip = arr[:, x0:x1, :]
        is_bg_strip = np.all(strip >= bg_threshold, axis=2)
        rows_with_content = (~is_bg_strip).any(axis=1)
        if not rows_with_content.any():
            print(f"  [{i+1}] {name}: no content — skipping")
            continue
        y0 = int(np.argmax(rows_with_content))
        y1 = int(H - np.argmax(rows_with_content[::-1]))
        y0 = max(0, y0 - margin)
        y1 = min(H, y1 + margin)

        sprite_rgba = crop_with_transparency(img, (x0, y0, x1, y1), bg_threshold)
        canvas = fit_to_canvas(sprite_rgba)

        out_name = f"{i+1:02d}-{name}-{suffix}.png" if suffix != 'enemy' else f"{i+1:02d}-{name}.png"
        out_path = output_dir / out_name
        canvas.save(out_path, 'PNG')
        print(f"  [{i+1}] {name}: {x1-x0}×{y1-y0} → {out_name}")

    print(f"\n✅ Wrote {len(runs)} sprites to {output_dir}")


if __name__ == '__main__':
    main()
