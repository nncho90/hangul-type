"""Production render: every Korean word in vocab.js to audio/{slug}.mp3.
Uses v3 approach: triplet carrier + silence-trim. Resumable.
Run from project root:
    caffeinate -i tools/.venv/bin/python tools/render_audio.py
"""
import hashlib, json, pathlib, re, subprocess, sys, time
import torch, torchaudio

REF = "tools/nelson_ref.wav"
OUT = pathlib.Path("audio")
RAW = OUT / "_raw"
OUT.mkdir(exist_ok=True)
RAW.mkdir(exist_ok=True)
MANIFEST_PATH = OUT / "manifest.json"

SIL_RE = re.compile(r"silence_(start|end): ([\d.]+)")

def detect_silences(wav_path, noise_db=-30, min_dur=0.15):
    cmd = ["ffmpeg", "-i", str(wav_path), "-af",
           f"silencedetect=noise={noise_db}dB:d={min_dur}", "-f", "null", "-"]
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
        # Fall back to whole file
        subprocess.run(["ffmpeg", "-y", "-i", str(in_wav), "-codec:a", "libmp3lame",
                        "-q:a", "2", str(out_mp3)], capture_output=True, check=True)
        return None
    middle = segments[len(segments) // 2]
    pad = 0.05
    s = max(0.0, middle[0] - pad)
    e = middle[1] + pad
    subprocess.run([
        "ffmpeg", "-y", "-ss", f"{s}", "-to", f"{e}", "-i", str(in_wav),
        "-codec:a", "libmp3lame", "-q:a", "2", str(out_mp3)
    ], capture_output=True, check=True)
    return (e - s, len(segments))

def slug_for(ko):
    return hashlib.sha1(ko.encode()).hexdigest()[:12]

def load_vocab():
    """Return unique vocab words in source-file order (vocab.js groups them
    by topic, simplest-first), so --limit=N gives you the first N as a player
    actually encounters them in the game."""
    src = pathlib.Path("vocab.js").read_text()
    seen, ordered = set(), []
    for m in re.finditer(r"ko:\s*'([^']+)'", src):
        w = m.group(1)
        if w not in seen:
            seen.add(w)
            ordered.append(w)
    return ordered

def load_manifest():
    if MANIFEST_PATH.exists():
        return json.loads(MANIFEST_PATH.read_text())
    return {}

def save_manifest(m):
    MANIFEST_PATH.write_text(json.dumps(m, ensure_ascii=False, indent=2))

def pick_device():
    if torch.cuda.is_available(): return "cuda"
    if torch.backends.mps.is_available(): return "mps"
    return "cpu"

def main():
    words = load_vocab()
    # Optional --limit=N for a smoke test on first N words.
    for arg in sys.argv[1:]:
        if arg.startswith("--limit="):
            n = int(arg.split("=", 1)[1])
            words = words[:n]
            print(f"Limited to first {n} words.")
    manifest = load_manifest()
    print(f"Loaded {len(words)} unique words. Manifest has {len(manifest)} entries.")

    # Skip already rendered
    todo = []
    for ko in words:
        slug = slug_for(ko)
        mp3 = OUT / f"{slug}.mp3"
        if mp3.exists() and ko in manifest:
            continue
        todo.append((ko, slug, mp3))
    print(f"To render: {len(todo)}. Already done: {len(words) - len(todo)}.")

    if not todo:
        print("Nothing to do. Manifest at", MANIFEST_PATH)
        return

    device = pick_device()
    print(f"Loading model on {device}...")
    from chatterbox.mtl_tts import ChatterboxMultilingualTTS
    model = ChatterboxMultilingualTTS.from_pretrained(device=device)

    overall_t0 = time.time()
    for i, (ko, slug, mp3) in enumerate(todo, 1):
        try:
            t0 = time.time()
            wav = model.generate(
                text=f"{ko}. {ko}. {ko}.",
                language_id="ko",
                audio_prompt_path=REF,
                exaggeration=0.3,
                cfg_weight=0.3,
                temperature=0.6,
                repetition_penalty=2.0,
            )
            raw = RAW / f"{slug}.wav"
            torchaudio.save(str(raw), wav, model.sr)
            info = trim_middle_word(raw, mp3)
            raw.unlink(missing_ok=True)  # save space
            manifest[ko] = f"audio/{slug}.mp3"
            elapsed = time.time() - t0
            eta = (time.time() - overall_t0) / i * (len(todo) - i)
            dur = info[0] if info else 0
            print(f"  [{i:4d}/{len(todo)}] {ko:10s} -> {slug}.mp3 ({elapsed:.1f}s, kept {dur:.2f}s, eta {eta/60:.1f}m)")

            # Save manifest every 25 words
            if i % 25 == 0:
                save_manifest(manifest)
        except KeyboardInterrupt:
            print("\nInterrupted. Saving manifest...")
            save_manifest(manifest)
            sys.exit(1)
        except Exception as e:
            print(f"  ✗ {ko}: {e}")

    save_manifest(manifest)
    print(f"\n✓ Done. {len(manifest)} entries in {MANIFEST_PATH}")
    # Cleanup raw dir
    for f in RAW.glob("*.wav"):
        f.unlink()

if __name__ == "__main__":
    main()
