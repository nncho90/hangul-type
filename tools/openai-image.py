"""Generate or edit an image via OpenAI's gpt-image-1.

Two modes:

  generate — text-to-image. Uses /v1/images/generations with model
             gpt-image-1. Returns a base64 PNG.
  edit     — image-to-image (with optional mask). Uses /v1/images/edits.
             Treat this like image2image with full or partial regen.

Requires OPENAI_API_KEY in the environment (or pass via --api-key).

Usage:
    # text-only
    python3 tools/openai-image.py generate \
      --prompt "a chibi pixel-art imp sprite sheet" \
      --size 1024x1024 \
      --out path/to/output.png

    # image-to-image (style anchor)
    python3 tools/openai-image.py edit \
      --prompt "rotate the imp 30 degrees, keep colors" \
      --image path/to/source.png \
      --out path/to/output.png

    # image edit with explicit mask (transparent areas = regenerate)
    python3 tools/openai-image.py edit \
      --prompt "replace the right arm with a sword" \
      --image source.png --mask mask.png --out result.png

Notes:
- gpt-image-1 returns base64 in `data[0].b64_json` for both endpoints.
- Edits accept multiple input images (multipart). The first is the canvas;
  any additional ones are style references.
"""
import argparse
import base64
import os
import sys
from pathlib import Path

try:
    import requests
except ImportError:
    print("requests not installed. Run: pip3 install requests", file=sys.stderr)
    sys.exit(1)


def _api_key(args):
    key = args.api_key or os.environ.get("OPENAI_API_KEY")
    if not key:
        print("error: OPENAI_API_KEY not set. Either export it or pass --api-key.", file=sys.stderr)
        sys.exit(2)
    return key


def cmd_generate(args):
    key = _api_key(args)
    r = requests.post(
        "https://api.openai.com/v1/images/generations",
        headers={"Authorization": f"Bearer {key}"},
        json={
            "model": "gpt-image-1",
            "prompt": args.prompt,
            "size": args.size,
            "n": args.n,
        },
        timeout=120,
    )
    if not r.ok:
        print(f"OpenAI error {r.status_code}: {r.text[:500]}", file=sys.stderr)
        sys.exit(3)
    data = r.json()
    out = Path(args.out)
    if args.n == 1:
        b64 = data["data"][0]["b64_json"]
        out.write_bytes(base64.b64decode(b64))
        print(f"Wrote {out} ({out.stat().st_size:,} bytes)")
    else:
        for i, item in enumerate(data["data"]):
            p = out.with_stem(f"{out.stem}-{i+1}")
            p.write_bytes(base64.b64decode(item["b64_json"]))
            print(f"Wrote {p}")


def cmd_edit(args):
    key = _api_key(args)
    files = [("image", (Path(args.image).name, open(args.image, "rb"), "image/png"))]
    for ref in args.reference or []:
        files.append(("image", (Path(ref).name, open(ref, "rb"), "image/png")))
    if args.mask:
        files.append(("mask", (Path(args.mask).name, open(args.mask, "rb"), "image/png")))
    payload = {"model": "gpt-image-1", "prompt": args.prompt, "size": args.size, "n": str(args.n)}
    r = requests.post(
        "https://api.openai.com/v1/images/edits",
        headers={"Authorization": f"Bearer {key}"},
        data=payload,
        files=files,
        timeout=180,
    )
    if not r.ok:
        print(f"OpenAI error {r.status_code}: {r.text[:500]}", file=sys.stderr)
        sys.exit(3)
    data = r.json()
    out = Path(args.out)
    if args.n == 1:
        b64 = data["data"][0]["b64_json"]
        out.write_bytes(base64.b64decode(b64))
        print(f"Wrote {out} ({out.stat().st_size:,} bytes)")
    else:
        for i, item in enumerate(data["data"]):
            p = out.with_stem(f"{out.stem}-{i+1}")
            p.write_bytes(base64.b64decode(item["b64_json"]))
            print(f"Wrote {p}")


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--api-key", help="OpenAI API key. Falls back to $OPENAI_API_KEY.")
    sub = p.add_subparsers(dest="cmd", required=True)

    g = sub.add_parser("generate", help="text-to-image via /v1/images/generations")
    g.add_argument("--prompt", required=True)
    g.add_argument("--out", required=True, help="output PNG path")
    g.add_argument("--size", default="1024x1024", choices=["1024x1024", "1024x1536", "1536x1024", "auto"])
    g.add_argument("--n", type=int, default=1)
    g.set_defaults(func=cmd_generate)

    e = sub.add_parser("edit", help="image edit via /v1/images/edits")
    e.add_argument("--prompt", required=True)
    e.add_argument("--image", required=True, help="canvas image (PNG)")
    e.add_argument("--mask", help="mask PNG (alpha=areas to regenerate). Optional.")
    e.add_argument("--reference", action="append", help="additional style-reference image(s). Repeatable.")
    e.add_argument("--out", required=True)
    e.add_argument("--size", default="1024x1024", choices=["1024x1024", "1024x1536", "1536x1024", "auto"])
    e.add_argument("--n", type=int, default=1)
    e.set_defaults(func=cmd_edit)

    args = p.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
