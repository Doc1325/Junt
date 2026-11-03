#!/usr/bin/env python3
"""Genera la locución del anuncio centrado en recomendaciones."""

from __future__ import annotations

import argparse
import io
import json
import time
import wave
from pathlib import Path

from generate_openai_voice import ASSETS, MODEL, adjust_tempo, load_api_key, request_speech


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "promo" / "recommendations-script.txt"
OUTPUT = ASSETS / "recommendations-voice-openai-cedar.wav"
TIMINGS = ASSETS / "recommendations-voice-timings.json"
PAUSE_SECONDS = 0.24
SPEEDS = [1.08, 1.13, 1.10, 1.10, 1.10, 1.02]
RETIME_TEMPOS = [1.12, 1.08, 1.40, 1.05, 1.06, 1.10]

PROFILE = {
    "voice": "cedar",
    "instructions": (
        "Habla en español dominicano natural, como un joven recomendando una app útil a sus panas. "
        "Voz masculina cálida, segura y carismática. Ritmo ágil para redes sociales, pero siempre claro; "
        "conecta las frases con fluidez y evita pausas teatrales o una entonación de locutor tradicional. "
        "Pronuncia 'pa dónde' de forma dominicana natural y la marca escrita 'Junte' exactamente como 'Junte'. "
        "Da énfasis natural a 'te recomienda eventos', 'planes gratis' y 'con un toque'. "
        "Mantén el sabor caribeño de forma auténtica y sutil, sin caricaturizar el acento."
    ),
}


def retime_existing() -> None:
    if not OUTPUT.exists() or not TIMINGS.exists():
        raise SystemExit("No existe una locución previa para ajustar.")
    data = json.loads(TIMINGS.read_text(encoding="utf-8"))
    with wave.open(str(OUTPUT), "rb") as previous:
        audio_format = (previous.getnchannels(), previous.getsampwidth(), previous.getframerate())
        pcm = previous.readframes(previous.getnframes())
    channels, sample_width, sample_rate = audio_format
    bytes_per_frame = channels * sample_width
    chunks: list[bytes] = []
    timings: list[dict[str, object]] = []
    cursor = 0.0
    for index, (item, tempo) in enumerate(zip(data["segments"], RETIME_TEMPOS, strict=True), start=1):
        start_byte = round(item["start"] * sample_rate) * bytes_per_frame
        end_byte = round(item["end"] * sample_rate) * bytes_per_frame
        frames = adjust_tempo(pcm[start_byte:end_byte], audio_format, tempo)
        duration = len(frames) / (bytes_per_frame * sample_rate)
        timings.append({**item, "start": round(cursor, 4), "end": round(cursor + duration, 4), "post_tempo": tempo})
        chunks.append(frames)
        cursor += duration
        if index < len(data["segments"]):
            chunks.append(b"\0" * int(PAUSE_SECONDS * sample_rate) * bytes_per_frame)
            cursor += PAUSE_SECONDS
    with wave.open(str(OUTPUT), "wb") as output:
        output.setnchannels(channels)
        output.setsampwidth(sample_width)
        output.setframerate(sample_rate)
        output.writeframes(b"".join(chunks))
    data["duration"] = round(cursor, 4)
    data["segments"] = timings
    TIMINGS.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Locución reajustada: {OUTPUT}")
    print(f"Duración: {cursor:.2f}s")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--retime-existing", action="store_true")
    args = parser.parse_args()
    if args.retime_existing:
        retime_existing()
        return
    api_key = load_api_key()
    if not api_key:
        raise SystemExit("Falta OPENAI_API_KEY o promo/.env.tts.local")
    paragraphs = [p.strip().replace("\n", " ") for p in SCRIPT.read_text(encoding="utf-8").split("\n\n") if p.strip()]
    if len(paragraphs) != len(SPEEDS):
        raise SystemExit("El guion debe contener exactamente seis bloques.")

    ASSETS.mkdir(parents=True, exist_ok=True)
    chunks: list[bytes] = []
    timings: list[dict[str, object]] = []
    audio_format: tuple[int, int, int] | None = None
    cursor = 0.0

    for index, (paragraph, speed) in enumerate(zip(paragraphs, SPEEDS, strict=True), start=1):
        print(f"Generando frase {index}/{len(paragraphs)}…", flush=True)
        wav_bytes = request_speech(api_key, paragraph, PROFILE, speed)
        with wave.open(io.BytesIO(wav_bytes), "rb") as wav:
            current_format = (wav.getnchannels(), wav.getsampwidth(), wav.getframerate())
            if audio_format is None:
                audio_format = current_format
            elif current_format != audio_format:
                raise RuntimeError("OpenAI devolvió segmentos WAV incompatibles.")
            frames = wav.readframes(wav.getnframes())
        channels, sample_width, sample_rate = current_format
        duration = len(frames) / (channels * sample_width * sample_rate)
        timings.append({"start": round(cursor, 4), "end": round(cursor + duration, 4), "text": paragraph, "speed": speed})
        chunks.append(frames)
        cursor += duration
        if index < len(paragraphs):
            chunks.append(b"\0" * int(PAUSE_SECONDS * sample_rate) * channels * sample_width)
            cursor += PAUSE_SECONDS
        time.sleep(0.12)

    assert audio_format is not None
    channels, sample_width, sample_rate = audio_format
    with wave.open(str(OUTPUT), "wb") as output:
        output.setnchannels(channels)
        output.setsampwidth(sample_width)
        output.setframerate(sample_rate)
        output.writeframes(b"".join(chunks))

    TIMINGS.write_text(json.dumps({
        "model": MODEL,
        "voice": PROFILE["voice"],
        "ai_generated": True,
        "duration": round(cursor, 4),
        "segments": timings,
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Locución creada: {OUTPUT}")
    print(f"Duración: {cursor:.2f}s")


if __name__ == "__main__":
    main()
