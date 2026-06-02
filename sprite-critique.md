# Sprite Critique (2026-06-03)

## Summary
- Total active sprites reviewed: 201 (player 126, enemies 64, vfx 4, backgrounds 7)
- Clean (no action): 195
- Flagged: 6  (blockers: 0, major: 3, minor: 3)

Method: programmatic pass (alpha-weighted opaque centroid, bbox, canvas-edge
touch count, near-white partial-alpha fringe fraction) across every active PNG,
then visual inspection of every flagged frame plus all known-bug-catalog frames.
Diagnostic/`_wait_*` PNGs and `_old-*` archives were skipped.

Headline: most of the historical 2026-05-10 triage is now RESOLVED (see
"Reconciliation" below). The enemy hit frames, the daewang sun-symbol, and the
mugwan attack frame are all fixed. Remaining real defects are few.

## Backgrounds
| sprite | severity | defect | suggested fix |
|---|---|---|---|
| sprites/backgrounds/05-camp.png | major | Wrong art style + wrong layout. It is a painterly/AI-render mountain camp, not the crisp pixel-art used by 01/02/03/04/07. It also has no central perspective "path"; the playable dirt is a flat strip in the bottom ~35% while tents/mountains fill the upper 60%. With `background-size:cover; background-position:center bottom` the sprites walk on a featureless plain that fights the other tiers. The file comment in game.html (line 185) explicitly says these should "match the player + enemy sprite aesthetic." | Regenerate in the same pixel-art style as 01-village/04-courtyard with an open central ground path. See "Needs regeneration." | SKIPPED: needs regen — style/layout mismatch cannot be fixed programmatically. Re-render in pixel-art style matching 01-village/04-courtyard, 1774x1108 canvas, open dirt path down center. |

Aspect-ratio note (not a bug, recorded for the fixer): backgrounds ship in two
sizes -- 1774x1108 (village, study, courtyard, camp) and 1774x887 (forest,
battlefield, palace). `background-size:cover` + `center bottom` absorbs this by
cropping, so it renders fine; no action needed unless a future layout switches
to `contain`/`100% 100%`. 03-study (recently recomposed) is clean: high cloud
horizon pinned correctly, no seams.

## Player sprites
| sprite | severity | defect | suggested fix |
|---|---|---|---|
| sprites/player/06-janggun-back-attack-2.png | major | Drawn bow fires LEFT (arrow points off the left edge), away from the enemy. Enemy is always to the right, so the volley points the wrong way. attack-1 corroborates: bow is held in the left hand reaching back to the quiver, so the whole draw/fire arc is mirrored. | Horizontal-flip the bow+arrow+drawing-arm so the shot extends RIGHT toward the enemy, OR re-render the attack-1..4 set firing right. Likely a horizontal-flip of the weapon layer; keep the body/cape unflipped to match the back-view walk cycle. | FIXED: full horizontal flip (Image.FLIP_LEFT_RIGHT). Before centroid=(183.7,197.5), bbox=(23,35,280,326); after centroid=(177.3,197.5), bbox=(81,35,338,326). Note: back-body is also mirrored — bow/arrow now fires right toward enemy. If a body-only fix is ever needed, a re-render of the attack set is the right path. Backup: sprites/player/_bak/06-janggun-back-attack-2.png |
| sprites/player/07-daewang-back-walk-4.png | major | Flame aura and the figure are clipped hard against the LEFT canvas edge (bbox x0=0, 142 opaque px on the border). In the walk loop the centroid sweeps 218 -> 150 -> 115 -> 96 px across frames 1-4; frame 4 runs off-canvas, so under the billboard/depth transform the left flame gets sheared off and the sprite reads as lurching left. | Crop+repad to the 362px canvas with margin, recenter the figure on its opaque centroid so all four walk frames share an anchor (target the walk-1..3 centroid band, not 96). | FIXED: cropped tight opaque bbox, pasted at offset (34,3) onto fresh 362x362 transparent canvas targeting cx=130. Before: centroid=(95.6,198.2), bbox x0=0, border_left=142. After: centroid=(129.6,181.2), bbox x0=34, border_left=0. Vertical shifted slightly (cy 198->181) due to clamping; acceptable within walk cycle. Backup: sprites/player/_bak/07-daewang-back-walk-4.png |
| sprites/player/07-daewang-back-land-1.png | minor | Flame aura touches the left canvas edge (bbox x0=0, 31 border px) plus a smoke puff near the bottom edge; soft alpha residue at the border. | Crop+repad with a few px margin; alpha-threshold the soft aura residue so nothing sits on the border. | FIXED: tight-cropped opaque bbox, pasted at offset (6,38) onto fresh 362x362 transparent canvas with 6px left margin. Before: centroid=(123.1,202.0), bbox x0=0, border_left=31. After: centroid=(129.1,202.0), bbox x0=6, border_left=0. No scaling needed (figure fit with margin). Backup: sprites/player/_bak/07-daewang-back-land-1.png |
| sprites/player/02-namukkun-back-attack-2.png | minor | Axe head is swung far to the lower-LEFT (away from the enemy) with a white motion trail. Reads as a wind-up/backswing so it is defensible, but the axe blade pointing fully away is borderline against the other tiers whose attack-2 keeps the weapon forward. | Optional: nudge the axe arc so the blade is more forward/neutral, or accept as a windup frame. Low priority. The high "fringe" the scanner saw here is just the intentional white speed-trail, not a halo. |

Note on the old "05-mugwan-back-attack-2 sword extends right" report: re-inspected
and it is CORRECT. These are back-view sprites, the enemy is to the right, and
the sword is raised overhead swinging right toward the enemy. No fix needed.

## Enemy sprites
No defects found. All 64 frames inspected.
- Hit frames (imp-hit-2, gumiho-hit-1/2, cheonyeo-hit-1, jeoseung-hit-2) that
  the 2026-05-10 triage flagged for blue-tear / second-head / deformation are
  now clean, single-headed, correct recoil poses. The blue pixels are
  intentional tear/expression detail and motion dashes, not artifacts.
- Top-tier enemies (07-mudang/yeowang, 08-hangeulwang/yeomra) are clean. The
  yeomra/hangeulwang fire aura is fully contained within the canvas
  (0 border-touch px). No white halos anywhere -- the largest enemy fringe
  fraction was 0.0031 (06-jeoseung-walk-3), which is the lantern glow on the
  robe, not a white-bg bleed. Defringe is NOT needed on the current enemy set.
- mini/step boss frames (dokkaebi-mini, gumiho-mini, cheonyeo-gwisin,
  dueokshini, dokkaebi-elder, jeoseung-saja, mudang, hangeulwang) share exact
  bbox + centroid with their idle counterparts, so no idle-vs-step jitter.

## VFX
No defects. arrow.png intentionally spans the full width (it is a projectile,
edge-touch is expected). ink-splash, jamo-burn, royal-lightning have clean
contained alpha.

## Needs regeneration (cannot be fixed programmatically)
- sprites/backgrounds/05-camp.png : style + layout mismatch. It is a painterly
  render with no perspective ground path; the other tiers are pixel-art with an
  open central walkway. Re-render in the 01-village/04-courtyard pixel-art style,
  open dirt path down the center, scenery framing the left/right thirds, horizon
  in the upper third. Match the 1774x1108 canvas.

## Reconciliation with .tmp-sprite-triage.md (2026-05-10)
- RESOLVED: all 5 enemy hit frames (imp-hit-2, gumiho-hit-1/2, cheonyeo-hit-1,
  jeoseung-hit-2) -- regenerated, now clean.
- RESOLVED: 07-daewang-back-attack-3 out-of-bounds sun symbol -- the "h" (ㅎ)
  glyph now sits fully inside the canvas.
- CORRECTED: 05-mugwan-back-attack-2 was listed as "sword extends beyond right
  margin / wrong way." It is actually correct (enemy is to the right). Removed.
- STILL BROKEN: 06-janggun-back-attack-2 bow fires the wrong way (now major).
- STILL BROKEN (narrowed): Tier 7 daewang. The old triage said "regenerate all
  14 frames." After inspection most frames are fine; only walk-4 (clip+anchor)
  and land-1 (edge touch) actually need work, both fixable programmatically
  (crop+repad+centroid recenter). The soft/fuzzy aura is a style mismatch with
  the crisp lower tiers but is not a per-frame bug.
- ROSTER CHANGED: enemy tiers were renamed/expanded since that pass (now
  includes 07-mudang/yeowang and 08-hangeulwang/yeomra). All new frames clean.
