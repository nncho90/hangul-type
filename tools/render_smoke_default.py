"""Smoke test C — default Chatterbox Korean voice (no reference clip).
If this also has glitches → confirmed model issue, not voice issue.
"""
import pathlib, time
import torch, torchaudio

OUT = pathlib.Path("audio/preview/default")
OUT.mkdir(parents=True, exist_ok=True)

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
        wav = model.generate(
            text=f"{ko}.",
            language_id="ko",
            audio_prompt_path=None,
            exaggeration=0.3,
            cfg_weight=0.3,
            temperature=0.6,
            repetition_penalty=2.0,
        )
        out = OUT / f"{slug}.wav"
        torchaudio.save(str(out), wav, model.sr)
        print(f"  {ko:8s} -> {out}  ({time.time()-t0:.1f}s)")

if __name__ == "__main__":
    main()
