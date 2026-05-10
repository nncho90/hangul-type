"""Render missing source-ordered audio files without the curation server.

This uses the same voice prompt, generation settings, slug scheme, trimming,
manifest, overrides, and redo counter as tools/curate_server.py, but avoids
starting FastAPI. Useful when the server startup path hangs during model load.
"""
import hashlib
import json
import os
import pathlib
import random
import re
import subprocess
import sys
import time

import torch
import torchaudio

ROOT = pathlib.Path(__file__).resolve().parent.parent
REF = ROOT / "tools" / "nelson_ref.wav"
AUDIO = ROOT / "audio"
RAW = AUDIO / "_raw"
MANIFEST_PATH = AUDIO / "manifest.json"
OVERRIDES_PATH = AUDIO / "overrides.json"
REDO_COUNT_PATH = AUDIO / "redo_count.json"
VOCAB_PATH = ROOT / "vocab.js"

RAW.mkdir(parents=True, exist_ok=True)
SIL_RE = re.compile(r"silence_(start|end): ([\d.]+)")


def pick_device():
    override = os.environ.get("HANGUL_TTS_DEVICE")
    if override:
        return override
    if torch.cuda.is_available():
        return "cuda"
    if torch.backends.mps.is_available():
        return "mps"
    return "cpu"


def load_json(path, default):
    return json.loads(path.read_text()) if path.exists() else default


def save_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2))


def slug_for(ko):
    return hashlib.sha1(ko.encode()).hexdigest()[:12]


def detect_silences(wav_path, noise_db=-30, min_dur=0.15):
    cmd = [
        "ffmpeg",
        "-i",
        str(wav_path),
        "-af",
        f"silencedetect=noise={noise_db}dB:d={min_dur}",
        "-f",
        "null",
        "-",
    ]
    out = subprocess.run(cmd, capture_output=True, text=True).stderr
    return [(m.group(1), float(m.group(2))) for m in SIL_RE.finditer(out)]


def trim_middle_word(in_wav, out_mp3):
    events = detect_silences(in_wav)
    segments, cur_start, leading_skipped = [], 0.0, False
    for kind, t in events:
        if kind == "start":
            if leading_skipped or t > 0.05:
                segments.append((cur_start, t))
        elif kind == "end":
            cur_start = t
            leading_skipped = True
    segments = [(s, e) for s, e in segments if e - s > 0.1]
    if not segments:
        subprocess.run(
            ["ffmpeg", "-y", "-i", str(in_wav), "-codec:a", "libmp3lame", "-q:a", "2", str(out_mp3)],
            capture_output=True,
            check=True,
        )
        return
    middle = segments[len(segments) // 2]
    pad = 0.05
    s = max(0.0, middle[0] - pad)
    e = middle[1] + pad
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-ss",
            f"{s}",
            "-to",
            f"{e}",
            "-i",
            str(in_wav),
            "-codec:a",
            "libmp3lame",
            "-q:a",
            "2",
            str(out_mp3),
        ],
        capture_output=True,
        check=True,
    )


def ordered_vocab():
    # Pull from every source that defines vocab so we don't miss words like the
    # basics list inlined in index.html or battle wordbanks in game.html.
    sources = [VOCAB_PATH, ROOT / "index.html", ROOT / "game.html"]
    seen, ordered = set(), []
    for src in sources:
        if not src.exists():
            continue
        text = src.read_text()
        for m in re.finditer(r"""ko:\s*['"]([^'"]+)['"]""", text):
            ko = m.group(1)
            if ko not in seen:
                seen.add(ko)
                ordered.append(ko)
    return ordered


def main():
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else None
    manifest = load_json(MANIFEST_PATH, {})
    overrides = load_json(OVERRIDES_PATH, {})
    counts = load_json(REDO_COUNT_PATH, {})
    missing = [ko for ko in ordered_vocab() if ko not in manifest]
    to_render = missing if limit is None else missing[:limit]

    device = pick_device()
    print(f"Manifest has {len(manifest)} words. Rendering {len(to_render)} on {device}.", flush=True)
    if not to_render:
        return

    from chatterbox.mtl_tts import ChatterboxMultilingualTTS

    model = ChatterboxMultilingualTTS.from_pretrained(device=device)
    print(f"Model ready on {device}.", flush=True)

    for i, ko in enumerate(to_render, 1):
        spoken = overrides.get(ko, ko)
        slug = slug_for(ko)
        mp3 = AUDIO / f"{slug}.mp3"
        raw = RAW / f"{slug}_redo.wav"

        torch.manual_seed(random.randint(0, 2**31 - 1))
        temp = 0.6 + random.uniform(-0.05, 0.15)
        t0 = time.time()
        try:
            wav = model.generate(
                text=f"{spoken}. {spoken}. {spoken}.",
                language_id="ko",
                audio_prompt_path=str(REF),
                exaggeration=0.3,
                cfg_weight=0.3,
                temperature=temp,
                repetition_penalty=2.0,
            )
            torchaudio.save(str(raw), wav, model.sr)
            trim_middle_word(raw, mp3)
            raw.unlink(missing_ok=True)
            manifest[ko] = f"audio/{slug}.mp3"
            counts[ko] = counts.get(ko, 0) + 1
            save_json(MANIFEST_PATH, manifest)
            save_json(REDO_COUNT_PATH, counts)
            print(f"  [{i:3}/{len(to_render)}] {ko} -> {manifest[ko]} in {time.time() - t0:.1f}s", flush=True)
        except Exception as exc:
            print(f"  [{i:3}/{len(to_render)}] {ko}: ERROR {exc}", flush=True)


if __name__ == "__main__":
    main()
