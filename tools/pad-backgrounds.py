#!/usr/bin/env python3
# Pad the wide tier backgrounds (01-village, 03-study, 04-courtyard) vertically
# to ~16:9 so `background-size: cover` on the full-viewport `.backdrop` in
# game.html stops cropping the left/right edges (the edge buildings/trees) on a
# normal desktop window.
#
# The original ~3.2:1 ChatGPT renders are kept byte-identical in the middle.
# We add a thin solid-sky strip on top (the sky is near-uniform up there) and
# stretch the bottom ~18% ground slice down to fill the rest — that continues
# the dirt/stone foreground texture instead of leaving a flat seam.
#
# Raw pre-pad renders live in sprites/backgrounds/_pre-vertical-2026-05-13/.
# Re-run this after regenerating any of those three via tools/gen-backgrounds.sh.

from PIL import Image
import os

BASE = os.path.join(os.path.dirname(__file__), "..", "sprites", "backgrounds")
FILES = ["01-village.png", "03-study.png", "04-courtyard.png"]


def avg_rows(img, y, n=6):
    w, h = img.size
    px = img.load()
    tot = [0, 0, 0, 0]
    cnt = 0
    for yy in range(y, min(y + n, h)):
        for x in range(0, w, 3):
            c = px[x, yy]
            c = c if len(c) == 4 else (c[0], c[1], c[2], 255)
            for i in range(4):
                tot[i] += c[i]
            cnt += 1
    return tuple(t // cnt for t in tot)


def pad_one(path):
    im = Image.open(path).convert("RGBA")
    w, h = im.size
    target_h = round(w * 9 / 16 / 2) * 2  # 16:9, even
    if target_h <= h:
        print(f"{os.path.basename(path)}: already >= 16:9 ({w}x{h}); skipping")
        return
    pad_total = target_h - h
    orig_horizon = round(h * 0.12)
    top_pad = min(pad_total, max(0, round(target_h * 0.12) - orig_horizon))
    bot_pad = pad_total - top_pad
    sky = avg_rows(im, 0)
    slice_h = max(1, round(h * 0.18))
    bottom = im.crop((0, h - slice_h, w, h)).resize((w, bot_pad), Image.NEAREST)
    out = Image.new("RGBA", (w, target_h))
    out.paste(Image.new("RGBA", (w, top_pad), sky), (0, 0))
    out.paste(im, (0, top_pad))
    out.paste(bottom, (0, top_pad + h))
    out.save(path)
    print(f"{os.path.basename(path)}: {w}x{h} -> {w}x{target_h}  "
          f"(top sky {top_pad}px {sky}, bottom stretched {bot_pad}px from bottom {slice_h}px)")


if __name__ == "__main__":
    for f in FILES:
        pad_one(os.path.join(BASE, f))
