"""Tiny static server with a save endpoint for tools/alpha-eraser.html.

Serves the project root so http://localhost:8770/tools/alpha-eraser.html
works, and accepts edited PNGs back from the browser:

  POST /api/save-sprite   {"path": "sprites/player/01-...png", "data": "<base64 png>"}

It refuses paths outside sprites/, backs the original up to
sprites/_old-<date>/<subpath> the first time a file is touched, then
overwrites it. Stdlib only.

Run from the project root:
    tools/.venv/bin/python tools/alpha-eraser-server.py [port]   # default 8770
(Plain `python3` works too -- no third-party deps.)
"""
import base64
import datetime
import json
import os
import pathlib
import shutil
import sys
from http.server import HTTPServer, SimpleHTTPRequestHandler

ROOT = pathlib.Path(__file__).resolve().parent.parent
SPRITES = (ROOT / "sprites").resolve()


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(ROOT), **kw)

    def log_message(self, fmt, *args):  # quieter
        if "/api/" in (args[0] if args else ""):
            super().log_message(fmt, *args)

    def do_POST(self):
        if self.path != "/api/save-sprite":
            self.send_error(404, "unknown endpoint")
            return
        try:
            length = int(self.headers.get("Content-Length", 0))
            payload = json.loads(self.rfile.read(length) or b"{}")
            rel = (payload.get("path") or "").lstrip("/")
            data_b64 = payload.get("data") or ""
            if "," in data_b64:                       # strip "data:image/png;base64," if present
                data_b64 = data_b64.split(",", 1)[1]
            target = (ROOT / rel).resolve()
            if not str(target).startswith(str(SPRITES) + os.sep):
                raise ValueError(f"path must be under sprites/: {rel}")
            if target.suffix.lower() != ".png":
                raise ValueError("only .png targets allowed")
            png = base64.b64decode(data_b64)
            if png[:8] != b"\x89PNG\r\n\x1a\n":
                raise ValueError("payload is not a PNG")
            # back up the original once
            backup = SPRITES / f"_old-{datetime.date.today():%Y-%m-%d}" / target.relative_to(SPRITES)
            if target.exists() and not backup.exists():
                backup.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(target, backup)
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(png)
            body = json.dumps({
                "ok": True,
                "wrote": str(target.relative_to(ROOT)),
                "bytes": len(png),
                "backup": str(backup.relative_to(ROOT)) if backup.exists() else None,
            }).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            print(f"  saved {target.relative_to(ROOT)} ({len(png)} bytes)")
        except Exception as e:
            body = json.dumps({"ok": False, "error": str(e)}).encode()
            self.send_response(400)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            print(f"  !! save failed: {e}")

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8770
    print(f"alpha-eraser server on http://localhost:{port}/tools/alpha-eraser.html")
    print(f"  (serving {ROOT})  Ctrl-C to stop")
    HTTPServer(("127.0.0.1", port), Handler).serve_forever()


if __name__ == "__main__":
    main()
