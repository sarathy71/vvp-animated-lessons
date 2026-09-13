#!/usr/bin/env python3
"""Generate the fixed Sloka Adventure Engine v1 voice pack with Cartesia.

Requires:
  pip install cartesia

Environment variables:
  CARTESIA_API_KEY   required
  APPU_VOICE_ID      required
  TILLI_VOICE_ID     required

Example:
  python3 scripts/generate_sloka_voice_pack.py --out shared/audio/voice

The script pins Cartesia Sonic 3.5 to a stable snapshot for consistency.
"""

from __future__ import annotations

import argparse
import os
import sys
import tempfile
import wave
from array import array
from pathlib import Path

from cartesia import Cartesia

MODEL_ID = "sonic-3.5-2026-05-04"
SAMPLE_RATE = 44100

# Frozen Sloka Adventure Engine v1 lines.
CLIPS = [
    ("appu_intro.wav", "appu", "Hi! I am Apu!"),
    ("tilli_intro.wav", "tilli", "Hi! I am Tilli!"),
    ("appu_help.wav", "appu", "Tilli needs your help. Can you help Tilli?"),
    ("tilli_instruction.wav", "tilli", "Yes, you can help me by reciting the sloka."),
    ("appu_challenge_complete.wav", "appu", "Hooray! You did it!"),
    ("tilli_thanks.wav", "tilli", "Thank you for helping me."),
]

# These two clips are intentionally both Appu + Tilli.
DUET_CLIPS = [
    ("recital_cheer.wav", "Yayy!"),
    ("daily_complete.wav", "Wow, you got us one today!"),
]


def generate_wav(client: Cartesia, voice_id: str, text: str, out_path: Path, speed: float) -> None:
    response = client.tts.generate(
        model_id=MODEL_ID,
        transcript=text,
        voice={"mode": "id", "id": voice_id},
        output_format={
            "container": "wav",
            "encoding": "pcm_s16le",
            "sample_rate": SAMPLE_RATE,
        },
        generation_config={"speed": speed},
    )
    response.write_to_file(str(out_path))


def read_pcm16_wav(path: Path):
    with wave.open(str(path), "rb") as wf:
        if wf.getnchannels() != 1:
            raise ValueError(f"Expected mono WAV: {path}")
        if wf.getsampwidth() != 2:
            raise ValueError(f"Expected 16-bit PCM WAV: {path}")
        if wf.getframerate() != SAMPLE_RATE:
            raise ValueError(f"Expected {SAMPLE_RATE} Hz WAV: {path}")
        samples = array("h")
        samples.frombytes(wf.readframes(wf.getnframes()))
        return samples


def write_pcm16_wav(path: Path, samples: array) -> None:
    with wave.open(str(path), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SAMPLE_RATE)
        wf.writeframes(samples.tobytes())


def mix_duet(appu_path: Path, tilli_path: Path, out_path: Path, tilli_delay_ms: int = 65) -> None:
    """Mix Appu and Tilli into one cheerful group clip.

    Tilli starts a few milliseconds later so the two voices do not sound like
    a perfectly phase-locked synthetic chorus.
    """
    a = read_pcm16_wav(appu_path)
    t = read_pcm16_wav(tilli_path)
    delay = int(SAMPLE_RATE * tilli_delay_ms / 1000)
    n = max(len(a), delay + len(t))
    mixed = array("h", [0]) * n

    # Slightly lower each source before summing to avoid clipping.
    for i, s in enumerate(a):
        mixed[i] = int(s * 0.68)

    for i, s in enumerate(t):
        j = delay + i
        v = mixed[j] + int(s * 0.68)
        mixed[j] = max(-32768, min(32767, v))

    # Short tail so the cheer doesn't end abruptly.
    mixed.extend([0] * int(SAMPLE_RATE * 0.08))
    write_pcm16_wav(out_path, mixed)


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate Sloka Adventure Engine v1 reusable voice WAVs.")
    parser.add_argument(
        "--out",
        default="shared/audio/voice",
        help="Output directory (default: shared/audio/voice)",
    )
    parser.add_argument(
        "--speed",
        type=float,
        default=0.96,
        help="Cartesia generation speed (default: 0.96)",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Overwrite WAVs that already exist",
    )
    args = parser.parse_args()

    api_key = os.getenv("CARTESIA_API_KEY")
    appu_voice = os.getenv("APPU_VOICE_ID")
    tilli_voice = os.getenv("TILLI_VOICE_ID")

    missing = [
        name
        for name, value in [
            ("CARTESIA_API_KEY", api_key),
            ("APPU_VOICE_ID", appu_voice),
            ("TILLI_VOICE_ID", tilli_voice),
        ]
        if not value
    ]
    if missing:
        print("Missing environment variable(s): " + ", ".join(missing), file=sys.stderr)
        return 2

    out_dir = Path(args.out).expanduser().resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    client = Cartesia(api_key=api_key)

    voice_ids = {"appu": appu_voice, "tilli": tilli_voice}

    print(f"Cartesia model: {MODEL_ID}")
    print(f"Output: {out_dir}")

    # Single-speaker files.
    for filename, speaker, text in CLIPS:
        dest = out_dir / filename
        if dest.exists() and not args.force:
            print(f"SKIP  {filename} (already exists)")
            continue
        print(f"MAKE  {filename:<30} {speaker}: {text}")
        generate_wav(client, voice_ids[speaker], text, dest, args.speed)

    # Appu + Tilli clips.
    with tempfile.TemporaryDirectory(prefix="sloka_cartesia_") as td:
        td = Path(td)
        for filename, text in DUET_CLIPS:
            dest = out_dir / filename
            if dest.exists() and not args.force:
                print(f"SKIP  {filename} (already exists)")
                continue

            appu_tmp = td / f"appu_{filename}"
            tilli_tmp = td / f"tilli_{filename}"

            print(f"MAKE  {filename:<30} Appu + Tilli: {text}")
            generate_wav(client, appu_voice, text, appu_tmp, args.speed)
            generate_wav(client, tilli_voice, text, tilli_tmp, args.speed)
            mix_duet(appu_tmp, tilli_tmp, dest)

    print("\nGenerated reusable Engine v1 voice pack:")
    for p in sorted(out_dir.glob("*.wav")):
        print("  " + p.name)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
