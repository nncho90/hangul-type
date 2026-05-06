"""Smoke test: render 8 representative Korean words with Nelson's voice.
Run from project root: tools/.venv/bin/python tools/render_smoke.py
"""
import pathlib, sys, time
import torch, torchaudio

REF = "tools/nelson_ref.wav"
OUT = pathlib.Path("audio/preview")
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
    print(f"Loading Chatterbox Multilingual on {device}...")
    from chatterbox.mtl_tts import ChatterboxMultilingualTTS
    model = ChatterboxMultilingualTTS.from_pretrained(device=device)
    print(f"Model ready. SR={model.sr}")

    for slug, ko in WORDS:
        t0 = time.time()
        wav = model.generate(
            text=ko,
            language_id="ko",
            audio_prompt_path=REF,
            exaggeration=0.4,
            cfg_weight=0.5,
        )
        out = OUT / f"{slug}.wav"
        torchaudio.save(str(out), wav, model.sr)
        print(f"  {ko:8s} -> {out}  ({time.time()-t0:.1f}s)")

if __name__ == "__main__":
    main()
