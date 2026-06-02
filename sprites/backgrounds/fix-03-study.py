"""
fix-03-study.py
Reconstructs sprites/backgrounds/03-study.png from the clean pre-vertical source.

Steps:
  1. Back up the current broken file
  2. Scale source (2241x702) to 1774px wide with LANCZOS
  3. Pad to 1774x1108:
     - Top: solid sky strip using avg of top rows
     - Bottom: ground slice from bottom 25%, scaled up with LANCZOS,
               feather-blended at the seam with a 24px gradient
  4. Save result
"""

import os
import shutil
import math
import numpy as np
from PIL import Image, ImageFilter

# ── Paths ─────────────────────────────────────────────────────────────────────
BASE         = "/Users/nelsoncho/projects/hangul-type/sprites/backgrounds"
SOURCE       = os.path.join(BASE, "_pre-vertical-2026-05-13/03-study.png")
DEST         = os.path.join(BASE, "03-study.png")
BACKUP_DIR   = os.path.join(BASE, "_old-2026-06-03")
BACKUP       = os.path.join(BACKUP_DIR, "03-study.png")

# ── Target dimensions ─────────────────────────────────────────────────────────
TARGET_W = 1774
TARGET_H = 1108

# ── 1. Backup ─────────────────────────────────────────────────────────────────
os.makedirs(BACKUP_DIR, exist_ok=True)
shutil.copy2(DEST, BACKUP)
print(f"Backed up broken file → {BACKUP}")

# ── 2. Load & scale source ────────────────────────────────────────────────────
src = Image.open(SOURCE).convert("RGB")
src_w, src_h = src.size
scaled_h = round(src_h * TARGET_W / src_w)   # 702 * 1774/2241 ≈ 556
scaled = src.resize((TARGET_W, scaled_h), Image.LANCZOS)
print(f"Scaled source: {src.size} → {scaled.size}")

scaled_arr = np.array(scaled, dtype=np.float32)

# ── 3. Measure sky color (avg of top 4 rows) ─────────────────────────────────
sky_color = tuple(scaled_arr[:4, :, :].mean(axis=(0, 1)).round().astype(int).tolist())
print(f"Sky fill color: {sky_color}")

# ── 4. Compute padding amounts ────────────────────────────────────────────────
# We want the horizon/top-of-image content at ~12% from top of final canvas.
# That means top_pad = round(TARGET_H * 0.12)
top_pad    = round(TARGET_H * 0.12)          # ≈ 133 px
bottom_pad = TARGET_H - scaled_h - top_pad   # 1108 - 556 - 133 = 419 px
print(f"top_pad={top_pad}, scaled_h={scaled_h}, bottom_pad={bottom_pad}")

# ── 5. Build top sky strip ────────────────────────────────────────────────────
sky_strip = Image.new("RGB", (TARGET_W, top_pad), sky_color)

# ── 6. Build bottom ground extension ─────────────────────────────────────────
# Take bottom 25% of scaled image as the ground slice source
ground_src_rows = max(1, round(scaled_h * 0.25))   # ≈ 139 rows
ground_slice = scaled.crop((0, scaled_h - ground_src_rows, TARGET_W, scaled_h))

# Scale that slice up to (TARGET_W x bottom_pad) using LANCZOS
ground_ext = ground_slice.resize((TARGET_W, bottom_pad), Image.LANCZOS)

# ── 7. Feather-blend the seam between scaled image and ground_ext ─────────────
FEATHER = 24   # px on each side of the join

# Convert to float arrays for blending
scaled_arr_u8  = np.array(scaled, dtype=np.float32)
ground_arr     = np.array(ground_ext, dtype=np.float32)

# The join is at y = scaled_h in the final canvas.
# We blend the bottom FEATHER rows of `scaled` with the top FEATHER rows of `ground_ext`.

# Ramp: 0.0 at top of feather zone → 1.0 at bottom (used as ground alpha)
ramp = np.linspace(0.0, 1.0, FEATHER, dtype=np.float32)[:, np.newaxis, np.newaxis]

# Bottom FEATHER rows of scaled image
top_band = scaled_arr_u8[scaled_h - FEATHER : scaled_h].copy()
# Top FEATHER rows of ground extension
bot_band = ground_arr[:FEATHER].copy()

blended = (top_band * (1 - ramp) + bot_band * ramp).astype(np.uint8)

# Write blended pixels back
scaled_fixed = scaled.copy()
scaled_fixed.paste(Image.fromarray(blended), (0, scaled_h - FEATHER))

ground_fixed = ground_ext.copy()
ground_fixed.paste(Image.fromarray(blended.copy()), (0, 0))

# ── 8. Composite final image ──────────────────────────────────────────────────
final = Image.new("RGB", (TARGET_W, TARGET_H))
final.paste(sky_strip,    (0, 0))
final.paste(scaled_fixed, (0, top_pad))
final.paste(ground_fixed, (0, top_pad + scaled_h))

print(f"Final size: {final.size}")
assert final.size == (TARGET_W, TARGET_H), "Size mismatch!"

# ── 9. Save ───────────────────────────────────────────────────────────────────
final.save(DEST, "PNG")
print(f"Saved → {DEST}")
print("Done.")
