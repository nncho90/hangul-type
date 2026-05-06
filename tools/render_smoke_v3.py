"""Smoke test v3 — carrier-phrase trick.

Render "{ko}. {ko}. {ko}." (triplet) so the model has momentum and never panics on short input.
Then use ffmpeg silencedetect to find the 3 word segments and save the middle one (most stable).
"""
import pathlib, subprocess, time, re
import torch, torchaudio

REF = "tools/nelson_ref.wav"
OUT = pathlib.Path("audio/preview/v3")
RAW = pathlib.Path("audio/preview/v3/_raw")
OUT.mkdir(parents=True, exist_ok=True)
RAW.mkdir(parents=True, exist_ok=True)

WORDS = [
    ("annyeonghaseyo", "안녕하세요"),
    ("sagwa",          "사과"),
    ("haksaeng",       "학생"),
    ("chingu",         "친구"),
    ("chaek",          "책"),
    ("kkot",           "꽃"),
    ("jjajangmyeon",   "짜장면"),
    ("kamsahamnida",   "감사합니다"),
]

SIL_RE = re.compile(r"silence_(start|end): ([\d.]+)")

def detect_silences(wav_path, noise_db=-30, min_dur=0.15):
    cmd = ["ffmpeg", "-i", str(wav_path), "-af",
           f"silencedetect=noise={noise_db}dB:d={min_dur}", "-f", "null", "-"]
    out = subprocess.run(cmd, capture_output=True, text=True).stderr
    events = []
    for m in SIL_RE.finditer(out):
        events.append((m.group(1), float(m.group(2))))
    return events

def trim_middle_word(in_wav, out_wav):
    """Given a triplet rendering, find 3 word segments and save the middle one."""
    events = detect_silences(in_wav)
    # Build word segments (audio between silence_end and next silence_start)
    segments = []
    cur_start = 0.0
    leading_skipped = False
    for kind, t in events:
        if kind == "start":
            if leading_skipped or t > 0.05:
                segments.append((cur_start, t))
        elif kind == "end":
            cur_start = t
            leading_skipped = True
    # Filter: keep segments that look like real speech (>0.1s)
    segments = [(s, e) for s, e in segments if e - s > 0.1]
    if len(segments) < 1:
        # No silences detected — fall back to just copying the file
        subprocess.run(["cp", str(in_wav), str(out_wav)], check=True)
        return None
    middle = segments[len(segments) // 2]
    pad = 0.05  # tiny lead-in/out
    s = max(0.0, middle[0] - pad)
    e = middle[1] + pad
    subprocess.run([
        "ffmpeg", "-y", "-ss", f"{s}", "-to", f"{e}", "-i", str(in_wav),
        "-c", "copy", str(out_wav)
    ], capture_output=True, check=True)
    return (s, e, len(segments))

def pick_device():
    if torch.cuda.is_available(): return "cuda"
    if torch.backends.mps.is_available(): return "mps"
    return "cpu"

def main():
    device = pick_device()
    print(f"Loading on {device}...")
    from chatterbox.mtl_tts import ChatterboxMultilingualTTS
    model = ChatterboxMultilingualTTS.from_pretrained(device=device)

    for slug, ko in WORDS:
        t0 = time.time()
        text = f"{ko}. {ko}. {ko}."
        wav = model.generate(
            text=text,
            language_id="ko",
            audio_prompt_path=REF,
            exaggeration=0.3,
            cfg_weight=0.3,
            temperature=0.6,
            repetition_penalty=2.0,
        )
        raw_path = RAW / f"{slug}.wav"
        torchaudio.save(str(raw_path), wav, model.sr)
        out_path = OUT / f"{slug}.wav"
        info = trim_middle_word(raw_path, out_path)
        n_seg = info[2] if info else "?"
        dur = (info[1] - info[0]) if info else 0
        print(f"  {ko:8s} -> {out_path}  ({time.time()-t0:.1f}s, {n_seg} segments, kept {dur:.2f}s)")

if __name__ == "__main__":
    main()
