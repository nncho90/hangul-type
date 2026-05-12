#!/bin/bash
# Sequentially generate 7 tier-band backgrounds, one per single-output job.
# Each gen runs in a fresh chat to dodge the latest-image script bug.
#
# Composition spec (applies to all 7):
#   - Horizon line ~12% from the top  → thin sky strip on top, ~88% ground/foreground below
#   - Scenery (buildings, trees, tents, pillars) ONLY in the leftmost ~12% and
#     rightmost ~12% of the width.  These elements are TALL — camera is low, so they
#     rise past the horizon and can run off the top edge.
#   - Middle ~76% is an OPEN WALKING LANE: ground/path receding to horizon, at most
#     small flat ground details (tufts, pebbles, ruts) — NOTHING tall, no buildings.
#   - This matches DEPTH.horizonPct = 12 in game.html so the depth curve aligns.

set -e
BG_DIR=/Users/nelsoncho/projects/hangul-type/sprites/backgrounds
mkdir -p "$BG_DIR"

# Common style block — used in every prompt for consistency.
COMMON='Style: pixel-art / 16-bit RPG environment art, matching the player + enemy character lineup at sprite-concepts/lineups/enemy-v9-user-reference.png — same outline weight, same flat-color palette per element, same pixel granularity. Hard-edged pixel scenery, no smooth gradients on objects. Slight Korean traditional aesthetic. Output as a 1920×600 widescreen banner suitable as a battle stage backdrop.

CAMERA / PERSPECTIVE — CRITICAL:
The scene is viewed from a Pokemon-style ~10-15° HIGH ANGLE — the camera is positioned slightly ABOVE the ground plane, tilted DOWN. We see the TOPS of architectural elements and ground details slightly more than their fronts. NOT a flat 2D side-scroller view. NOT a top-down bird-eye. A subtle high-angle 3/4 view where rooflines tilt, paths recede slightly toward the horizon, and ground tiles are visible. This must match the perspective of the character sprites that will stand on top of the backdrop.

HORIZON AND COMPOSITION — CRITICAL:
The horizon line sits ~12% from the TOP of the image — so there is only a thin strip of sky at the top, and ~88% of the image is ground/foreground below the horizon.
Scenery elements (buildings, trees, tents, pillars, rooflines, rocks) appear ONLY in the leftmost ~12% and rightmost ~12% of the canvas width. Because the camera is low and the horizon is high, these edge elements are TALL and may extend past the horizon line all the way to the top edge. The MIDDLE ~76% of the canvas width is a completely open walking lane: just ground/path tiles receding to the horizon. At most tiny flat ground details (grass tufts, pebbles, a faint dirt rut) in the middle — nothing tall, nothing blocking the lane.
Subtle desaturated palette so foreground sprites pop. NO text, NO characters, NO creatures.'

declare -a SCENES=(
  "01-village|Tier 1 — humble Korean countryside village. Left and right edges only: simple thatched-roof hanok houses, low stone walls, simple wooden fences, and scattered hay bales — tall enough to rise past the horizon. Middle walking lane: a wide dirt path receding to the horizon with a few grass tufts and pebbles. Thin sky strip: pale blue with wispy white pixel clouds. Distant mountain silhouettes on the horizon."
  "02-forest|Tier 2 — Korean mountain forest at midday. Left and right edges only: tall pixel-art pine and bamboo trees, mossy rocks, and fallen logs rising past the horizon. Middle walking lane: a dirt forest path with occasional mossy stones and leaf litter. Thin sky strip: soft green-blue with sun rays filtering through. A pixel-art bird or two far in the distance."
  "03-study|Tier 3 — a Korean mountain scholar's cliffside hermitage at dawn. Left and right edges only: weathered pines clinging to rock, gnarled outcrops, and on one side a small thatched-roof study hut (초가 서재) with a low wooden rail and a stone water basin — tall elements rising past the horizon. Middle walking lane: the open cliff-ledge path, rocky ground receding to the horizon. Below the horizon line: a vast sea of soft white clouds filling the valley, with distant blue mountain ridges poking through. Thin sky strip above: pale dawn gold. Quiet, serene, high-altitude."
  "04-courtyard|Tier 4 — yangban aristocrat's courtyard (양반가). Left and right edges only: ornate hanok rooflines with curved tiles, decorative stone lanterns, a small lotus pond, and blossoming pixel-art apricot tree branches rising past the horizon. Middle walking lane: stone-paved courtyard receding to the horizon. Thin sky strip: soft lavender-pink dusk tone."
  "05-camp|Tier 5 — Korean military camp (군영). Left and right edges only: pixel-art military tents with red flags, weapon racks holding swords and spears, wooden fence palisades, and rolled banners rising past the horizon. Middle walking lane: trampled dirt ground with small campfire embers and scattered boot prints. Thin sky strip: steel-grey overcast."
  "06-battlefield|Tier 6 — Korean battlefield (전장) at dusk. Left and right edges only: war banners on poles, abandoned shields leaning against broken fences, faint smoke columns rising — tall elements at the edges. Middle walking lane: trampled grass with scattered broken arrows and muddy ruts. Thin sky strip: dramatic burnt-orange to dark-red (sun setting)."
  "07-palace|Tier 7 — fiery royal palace climax (궁궐). Left and right edges only: ornate palace gates with golden dragon-embellished tiles, towering red columns, ceremonial torches with pixel flame — rising past the horizon on both sides. Middle walking lane: marble steps / stone-paved path receding to the horizon. Thin sky strip: deep-red with subtle pixel-art golden flame wisps."
)

for entry in "${SCENES[@]}"; do
  IFS='|' read -r name scene_desc <<< "$entry"
  out_path="$BG_DIR/$name.png"
  if [ -f "$out_path" ]; then
    echo "✓ $name already exists — skipping"
    continue
  fi
  echo "→ Generating $name…"

  job_file=$(mktemp -t bg-job-XXXXXX.json)
  python3 -c "
import json
out = {
    'outputs': [{
        'path': '$out_path',
        'prompt': '''Draw a brand new pixel-art landscape banner. ${scene_desc}

${COMMON}

Output: a fresh new image. Do not echo any prior image. 1920×600 widescreen banner. Horizon at ~12% from top. Scenery ONLY at left and right edges (~12% each side). Middle ~76% is a completely open walking lane. NO characters, NO monsters, NO text, NO logos. Pure environment art only.'''
    }]
}
with open('$job_file', 'w') as f:
    json.dump(out, f)
"
  rm -f ~/Library/Application\ Support/claude-playwright-chatgpt/image_gen_chat_url.txt
  python3 ~/.claude/skills/image-gen-chatgpt/scripts/generate.py --config "$job_file" 2>&1 | tail -10
  rm -f "$job_file"
  echo "  ✅ saved $out_path"
done

echo
echo "✅ All 7 backgrounds generated"
ls -la "$BG_DIR"
