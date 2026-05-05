#!/bin/bash
# Sequentially generate 7 tier-band backgrounds, one per single-output job.
# Each gen runs in a fresh chat to dodge the latest-image script bug.

set -e
BG_DIR=/Users/nelsoncho/projects/hangul-type/sprites/backgrounds
mkdir -p "$BG_DIR"

# Common style block — used in every prompt for consistency.
COMMON='Style: pixel-art / 16-bit RPG environment art, matching the player + enemy character lineup at sprite-concepts/lineups/enemy-v9-user-reference.png — same outline weight, same flat-color palette per element, same pixel granularity. Hard-edged pixel scenery, no smooth gradients on objects. Slight Korean traditional aesthetic. Output as a 1920×600 widescreen banner suitable as a battle stage backdrop.\n\nCAMERA / PERSPECTIVE — CRITICAL:\nThe scene is viewed from a Pokemon-style ~10-15° HIGH ANGLE — the camera is positioned slightly ABOVE the ground plane, tilted DOWN. We see the TOPS of architectural elements and ground details slightly more than their fronts. NOT a flat 2D side-scroller view. NOT a top-down bird-eye. A subtle high-angle 3/4 view where rooflines tilt, paths recede slightly toward the horizon, and ground tiles are visible. This must match the perspective of the character sprites that will stand on top of the backdrop.\n\nThe composition must have a CLEAR EMPTY UPPER 60% (sky / open space — this is where monsters fall through toward the player) — scenery elements only in the bottom 40%. Subtle desaturated palette so foreground sprites pop. NO text, NO characters, NO creatures.'

declare -a SCENES=(
  "01-village|Tier 1 — humble Korean countryside village. Bottom 40% shows simple thatched-roof hanok houses in pixel-art, low stone walls, dirt path, simple wooden fences, scattered hay bales. Background sky empty pale blue with a few wispy white pixel clouds. Mountain silhouettes far in the distance."
  "02-forest|Tier 2 — Korean mountain forest at midday. Bottom 40% shows pixel-art pine and bamboo trees, mossy rocks, a dirt forest path, fallen logs. Background sky empty soft green-blue tinted with sun rays through the trees. A few pixel-art butterflies or birds far in the distance."
  "03-study|Tier 3 — traditional Korean scholar's study (서당) interior. Bottom 40% shows pixel-art low wooden writing desks, ink stones, paper scrolls stacked, brushes in holders, traditional latticed paper sliding doors (창호지문), bamboo blinds. Background empty warm tan/beige paper-wall tone."
  "04-courtyard|Tier 4 — yangban aristocrat's courtyard (양반가). Bottom 40% shows pixel-art ornate hanok rooflines with curved tiles, stone-paved courtyard, decorative stone lanterns, a small lotus pond, blossoming pixel-art apricot tree branches. Background sky empty soft lavender-pink dusk tone."
  "05-camp|Tier 5 — Korean military camp (군영). Bottom 40% shows pixel-art military tents with red flags, weapon racks holding swords and spears, small campfires with pixel smoke wisps, wooden fence palisades, rolled banners. Background sky empty steel-grey overcast."
  "06-battlefield|Tier 6 — Korean battlefield (전장) at dusk. Bottom 40% shows pixel-art trampled grass, scattered broken arrows, abandoned shields, distant pixel-art war banners on poles, faint smoke columns rising. Background sky empty dramatic burnt-orange to dark-red gradient (sun setting)."
  "07-palace|Tier 7 — fiery royal palace climax (궁궐). Bottom 40% shows pixel-art ornate palace gates with golden dragon-embellished tiles, towering red columns, gold-trimmed roof curves, ceremonial torches with pixel flame, marble steps. Background sky empty dramatic deep-red with subtle pixel-art golden flame wisps."
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

Output: a fresh new image. Do not echo any prior image. 1920×600 widescreen banner. Empty upper 60% so the play area stays clean for sprites to fall through. NO characters, NO monsters, NO text, NO logos. Pure environment art only.'''
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
