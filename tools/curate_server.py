"""Voice curation server.
- Keeps the Chatterbox model loaded in memory (huge speedup for redos)
- Serves the project as static files (replaces python -m http.server)
- Endpoints: GET /api/pending, POST /api/approve, POST /api/redo
- Curation UI at /curate

Run from project root:
    tools/.venv/bin/python tools/curate_server.py
"""
import hashlib, json, os, pathlib, random, re, subprocess, time
from fastapi import FastAPI, HTTPException, UploadFile, Form, File
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import torch, torchaudio

ROOT = pathlib.Path(__file__).resolve().parent.parent
REF = ROOT / "tools" / "nelson_ref.wav"
AUDIO = ROOT / "audio"
RAW = AUDIO / "_raw"
MANIFEST_PATH = AUDIO / "manifest.json"
APPROVED_PATH = AUDIO / "approved.json"
OVERRIDES_PATH = AUDIO / "overrides.json"   # ko -> phonetic spelling
REDO_COUNT_PATH = AUDIO / "redo_count.json" # ko -> int

RAW.mkdir(parents=True, exist_ok=True)

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

def pick_device():
    override = os.environ.get("HANGUL_TTS_DEVICE")
    if override:
        return override
    if torch.cuda.is_available(): return "cuda"
    if torch.backends.mps.is_available(): return "mps"
    return "cpu"

def load_manifest():
    return json.loads(MANIFEST_PATH.read_text()) if MANIFEST_PATH.exists() else {}

def save_manifest(m):
    MANIFEST_PATH.write_text(json.dumps(m, ensure_ascii=False, indent=2))

def load_approved():
    return set(json.loads(APPROVED_PATH.read_text())) if APPROVED_PATH.exists() else set()

def save_approved(s):
    APPROVED_PATH.write_text(json.dumps(sorted(s), ensure_ascii=False, indent=2))

def load_overrides():
    return json.loads(OVERRIDES_PATH.read_text()) if OVERRIDES_PATH.exists() else {}

def save_overrides(d):
    OVERRIDES_PATH.write_text(json.dumps(d, ensure_ascii=False, indent=2))

def load_redo_count():
    return json.loads(REDO_COUNT_PATH.read_text()) if REDO_COUNT_PATH.exists() else {}

def save_redo_count(d):
    REDO_COUNT_PATH.write_text(json.dumps(d, ensure_ascii=False, indent=2))

# ── Load model once ─────────────────────────────────────────────────────
print("Loading Chatterbox Multilingual (this takes ~30s)...")
from chatterbox.mtl_tts import ChatterboxMultilingualTTS
device = pick_device()
model = ChatterboxMultilingualTTS.from_pretrained(device=device)
print(f"✓ Model ready on {device}.")

# ── App ────────────────────────────────────────────────────────────────
app = FastAPI()

class WordReq(BaseModel):
    ko: str
    # Optional phonetic override. If set, the audio is generated from
    # `pronounce` but stored under the slug for `ko`. Use for words where
    # Chatterbox gets the pronunciation wrong (e.g. 의 read as 에).
    pronounce: str | None = None

@app.get("/api/pending")
def pending():
    manifest = load_manifest()
    approved = load_approved()
    pending_list = [{"ko": ko, "url": url} for ko, url in manifest.items() if ko not in approved]
    return {"pending": pending_list, "approved_count": len(approved), "total": len(manifest)}

@app.post("/api/approve")
def approve(req: WordReq):
    approved = load_approved()
    approved.add(req.ko)
    save_approved(approved)
    return {"ok": True, "approved_count": len(approved)}

@app.post("/api/redo")
def redo(req: WordReq):
    ko = req.ko
    overrides = load_overrides()
    # If a pronounce override was supplied, persist it. Otherwise reuse any
    # previously-saved override so future redos stay corrected.
    if req.pronounce:
        overrides[ko] = req.pronounce
        save_overrides(overrides)
    spoken = overrides.get(ko, ko)
    # Bump redo count for this word
    counts = load_redo_count()
    counts[ko] = counts.get(ko, 0) + 1
    save_redo_count(counts)
    slug = slug_for(ko)
    mp3 = AUDIO / f"{slug}.mp3"
    raw = RAW / f"{slug}_redo.wav"

    # Vary seed + small temperature jitter for genuinely different takes
    torch.manual_seed(random.randint(0, 2**31 - 1))
    temp = 0.6 + random.uniform(-0.05, 0.15)

    t0 = time.time()
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
    note = f" [spoken as: {spoken}]" if req.pronounce else ""
    print(f"  redo {ko}{note} (temp={temp:.2f}) in {time.time()-t0:.1f}s")

    # Ensure manifest knows about it (in case of new word)
    manifest = load_manifest()
    if ko not in manifest:
        manifest[ko] = f"audio/{slug}.mp3"
        save_manifest(manifest)

    return {"ok": True, "url": manifest[ko], "ts": int(time.time())}

@app.post("/api/record")
async def record(ko: str = Form(...), audio: UploadFile = File(...)):
    """Accept a blob recorded in the browser and replace this word's mp3.
    Same trim/normalize pipeline as the AI-generated takes (so loudness +
    leading-silence behavior stays consistent across the dataset)."""
    slug = slug_for(ko)
    raw = RAW / f"{slug}_record.webm"
    wav = RAW / f"{slug}_record.wav"
    mp3 = AUDIO / f"{slug}.mp3"
    raw.write_bytes(await audio.read())
    # Decode whatever the browser sent (webm/opus, m4a, wav…) into a clean
    # 24kHz mono wav for trim_middle_word — same sample rate the model uses.
    subprocess.run(
        ["ffmpeg", "-y", "-i", str(raw), "-ac", "1", "-ar", "24000",
         "-af", "loudnorm=I=-18:TP=-2", str(wav)],
        capture_output=True, check=True,
    )
    trim_middle_word(wav, mp3)
    raw.unlink(missing_ok=True)
    wav.unlink(missing_ok=True)
    manifest = load_manifest()
    if ko not in manifest:
        manifest[ko] = f"audio/{slug}.mp3"
        save_manifest(manifest)
    counts = load_redo_count()
    counts[ko] = counts.get(ko, 0) + 1
    save_redo_count(counts)
    print(f"  recorded {ko} (user voice) -> {manifest[ko]}")
    return {"ok": True, "url": manifest[ko], "ts": int(time.time())}

@app.get("/curate")
def curate_page():
    return FileResponse(str(ROOT / "tools" / "curate.html"))

# Mount static last so explicit routes win
app.mount("/", StaticFiles(directory=str(ROOT), html=True), name="root")

if __name__ == "__main__":
    import sys, uvicorn
    port = int(os.environ.get("CURATE_PORT") or (sys.argv[1] if len(sys.argv) > 1 else 8765))
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="warning")
