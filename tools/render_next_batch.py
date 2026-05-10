"""Render the next N source-ordered words via the running curation server.
Server keeps the model in memory so each render is just inference time.
"""
import json, pathlib, re, sys, urllib.request

LIMIT = int(sys.argv[1]) if len(sys.argv) > 1 else 50

# Pull from every source that defines vocab so we don't miss words like the
# basics list inlined in index.html or battle wordbanks in game.html.
SOURCES = ["vocab.js", "index.html", "game.html"]
seen, ordered = set(), []
for path in SOURCES:
    p = pathlib.Path(path)
    if not p.exists():
        continue
    text = p.read_text()
    # Match ko:'…' or ko:"…" — index.html/game.html sometimes use double quotes
    for m in re.finditer(r"""ko:\s*['"]([^'"]+)['"]""", text):
        w = m.group(1)
        if w not in seen:
            seen.add(w)
            ordered.append(w)

manifest = {}
mp = pathlib.Path("audio/manifest.json")
if mp.exists():
    manifest = json.loads(mp.read_text())

to_render = [w for w in ordered if w not in manifest][:LIMIT]
print(f"Manifest has {len(manifest)} words. Rendering {len(to_render)} new source-order words.")

for i, ko in enumerate(to_render, 1):
    body = json.dumps({"ko": ko}).encode()
    req = urllib.request.Request(
        "http://127.0.0.1:8765/api/redo",
        data=body,
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            d = json.loads(r.read())
        print(f"  [{i:2}/{len(to_render)}] {ko:8s} -> {d['url']}")
    except Exception as e:
        print(f"  [{i:2}/{len(to_render)}] {ko}: ERROR {e}")
