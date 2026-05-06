#!/usr/bin/env python3
"""
Slice the 4-VFX lineup into 4 individual transparent-background sprites.
Reuses the same column-detection logic as slice-lineup.py but with
VFX-appropriate naming.
"""

import sys
from pathlib import Path
from PIL import Image
import numpy as np

VFX_NAMES = ['arrow', 'jamo-burn', 'ink-splash', 'royal-lightning']


def find_runs(arr, bg_threshold, min_width=40):
    rgb = arr[:, :, :3]
    is_bg = np.all(rgb >= bg_threshold, axis=2)
    has_content = ~is_bg
    col_has_content = has_content.any(axis=0)
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
    runs = [r for r in runs if (r[1] - r[0]) >= min_width]
    return runs


def split_wide(runs, target):
    if len(runs) >= target:
        return runs
    widths = sorted([r[1] - r[0] for r in runs])
    median = widths[len(widths) // 2]
    fixed = []
    for s, e in runs:
        w = e - s
        n = max(1, round(w / median))
        if n > 1:
            seg = w / n
            for k in range(n):
                fixed.append((int(s + k * seg), int(s + (k + 1) * seg)))
        else:
            fixed.append((s, e))
    return fixed


def crop_transparent(img, box, bg_threshold):
    cropped = img.crop(box).convert('RGBA')
    arr = np.array(cropped)
    rgb = arr[:, :, :3]
    is_bg = np.all(rgb >= bg_threshold, axis=2)
    arr[is_bg, 3] = 0
    return Image.fromarray(arr, 'RGBA')


def fit_canvas(sprite, canvas=256, fill=0.85):
    sw, sh = sprite.size
    target_h = int(canvas * fill)
    scale = target_h / sh
    new_w = max(1, int(sw * scale))
    new_h = max(1, int(sh * scale))
    resized = sprite.resize((new_w, new_h), Image.NEAREST)
    out = Image.new('RGBA', (canvas, canvas), (0, 0, 0, 0))
    out.paste(resized, ((canvas - new_w) // 2, (canvas - new_h) // 2), resized)
    return out


def main():
    input_path = Path(sys.argv[1])
    output_dir = Path(sys.argv[2])
    output_dir.mkdir(parents=True, exist_ok=True)
    bg_threshold = 230
    img = Image.open(input_path).convert('RGB')
    arr = np.array(img)
    H, W = arr.shape[:2]
    print(f"Loaded {input_path.name}: {W}×{H}")

    runs = find_runs(arr, bg_threshold)
    print(f"Detected {len(runs)} runs: {runs}")

    if len(runs) < 4:
        runs = split_wide(runs, 4)
        print(f"Split to {len(runs)}")

    if len(runs) > 4:
        runs = runs[:4]

    for i, (s, e) in enumerate(runs):
        name = VFX_NAMES[i] if i < len(VFX_NAMES) else f"vfx-{i+1}"
        margin = 6
        x0 = max(0, s - margin)
        x1 = min(W, e + margin)
        strip = arr[:, x0:x1, :]
        is_bg_strip = np.all(strip >= bg_threshold, axis=2)
        rows_with_content = (~is_bg_strip).any(axis=1)
        if not rows_with_content.any():
            continue
        y0 = int(np.argmax(rows_with_content))
        y1 = int(H - np.argmax(rows_with_content[::-1]))
        y0 = max(0, y0 - margin)
        y1 = min(H, y1 + margin)
        sprite = crop_transparent(img, (x0, y0, x1, y1), bg_threshold)
        canvas = fit_canvas(sprite)
        out = output_dir / f"{name}.png"
        canvas.save(out, 'PNG')
        print(f"  [{i+1}] {name}: {x1-x0}×{y1-y0} → {out.name}")

    print(f"\n✅ Wrote {len(runs)} VFX sprites to {output_dir}")


if __name__ == '__main__':
    main()
