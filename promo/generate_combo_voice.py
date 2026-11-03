#!/usr/bin/env python3
"""Genera locuciones alternativas del anuncio híbrido de Junt."""

from __future__ import annotations

import argparse
import io
import json
import wave
from pathlib import Path

from generate_openai_voice import ASSETS, MODEL, adjust_tempo, load_api_key, request_speech


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "promo" / "combo-script.txt"
OUTPUT = ASSETS / "combo-voice-openai-cedar.wav"
TIMINGS = ASSETS / "combo-voice-timings.json"
PAUSE_SECONDS = 0.24
SPEEDS = [1.12, 1.12, 1.10, 1.10, 1.08, 1.02]
RETIME_TEMPOS = [1.12, 1.12, 1.05, 1.12, 1.10, 1.20]

PROFILE = {
    "voice": "cedar",
    "instructions": (
        "Habla en español dominicano natural, como un joven contándole a sus panas una forma más fácil "
        "de organizar el coro. Voz masculina Cedar, cálida, segura, carismática y conversacional. "
        "Mantén un ritmo ágil de anuncio para redes, claro y continuo, sin pausas teatrales ni tono solemne. "
        "Da énfasis natural a 'descubre eventos', 'lo convierten en plan', 'confirman quién va' y "
        "'menos mensajes, más planes'. Pronuncia la marca escrita 'Junte' exactamente como 'Junte'. "
        "Mantén el sabor dominicano auténtico y sutil, sin caricaturizar el acento."
    ),
}


def configure_voice(voice: str) -> None:
    global OUTPUT, TIMINGS, PROFILE
    if voice == "cedar":
        OUTPUT = ASSETS / "combo-voice-openai-cedar.wav"
        TIMINGS = ASSETS / "combo-voice-timings.json"
    else:
        OUTPUT = ASSETS / f"combo-voice-openai-{voice}.wav"
        TIMINGS = ASSETS / f"combo-voice-timings-{voice}.json"
    PROFILE = {
        **PROFILE,
        "voice": voice,
        "instructions": PROFILE["instructions"].replace("Voz masculina Cedar,", "Voz natural,")
        if voice != "cedar" else PROFILE["instructions"],
    }


def paragraphs() -> list[str]:
    return [part.strip().replace("\n", " ") for part in SCRIPT.read_text(encoding="utf-8").split("\n\n") if part.strip()]


def write_audio(chunks: list[bytes], audio_format: tuple[int, int, int]) -> None:
    channels, sample_width, sample_rate = audio_format
    with wave.open(str(OUTPUT), "wb") as output:
        output.setnchannels(channels)
        output.setsampwidth(sample_width)
        output.setframerate(sample_rate)
        output.writeframes(b"".join(chunks))


def generate() -> None:
    api_key = load_api_key()
    if not api_key:
        raise SystemExit("Falta OPENAI_API_KEY o promo/.env.tts.local")
    texts = paragraphs()
    if len(texts) != len(SPEEDS):
        raise SystemExit("El guion debe contener exactamente seis bloques.")
    chunks: list[bytes] = []
    timings: list[dict[str, object]] = []
    audio_format: tuple[int, int, int] | None = None
    cursor = 0.0
    for index, (text, speed) in enumerate(zip(texts, SPEEDS, strict=True), start=1):
        print(f"Generando frase {index}/{len(texts)}…", flush=True)
        wav_bytes = request_speech(api_key, text, PROFILE, speed)
        with wave.open(io.BytesIO(wav_bytes), "rb") as wav:
            current_format = (wav.getnchannels(), wav.getsampwidth(), wav.getframerate())
            if audio_format is None:
                audio_format = current_format
            elif audio_format != current_format:
                raise RuntimeError("OpenAI devolvió segmentos WAV incompatibles.")
            frames = wav.readframes(wav.getnframes())
        channels, sample_width, sample_rate = current_format
        duration = len(frames) / (channels * sample_width * sample_rate)
        timings.append({"start": round(cursor, 4), "end": round(cursor + duration, 4), "text": text, "speed": speed})
        chunks.append(frames)
        cursor += duration
        if index < len(texts):
            chunks.append(b"\0" * int(PAUSE_SECONDS * sample_rate) * channels * sample_width)
            cursor += PAUSE_SECONDS
    assert audio_format is not None
    write_audio(chunks, audio_format)
    TIMINGS.write_text(json.dumps({
        "model": MODEL,
        "voice": PROFILE["voice"],
        "ai_generated": True,
        "duration": round(cursor, 4),
        "segments": timings,
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Locución creada: {OUTPUT}")
    print(f"Duración: {cursor:.2f}s")


def retime_existing(tempo_override: float | None = None) -> None:
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
    tempos = [tempo_override] * len(data["segments"]) if tempo_override else RETIME_TEMPOS
    for index, (item, tempo) in enumerate(zip(data["segments"], tempos, strict=True), start=1):
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
    write_audio(chunks, audio_format)
    data["duration"] = round(cursor, 4)
    data["segments"] = timings
    TIMINGS.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Locución reajustada: {OUTPUT}")
    print(f"Duración: {cursor:.2f}s")


def regenerate_segment(target: int) -> None:
    api_key = load_api_key()
    if not api_key:
        raise SystemExit("Falta OPENAI_API_KEY o promo/.env.tts.local")
    if not OUTPUT.exists() or not TIMINGS.exists():
        raise SystemExit("No existe una locución previa para actualizar.")
    texts = paragraphs()
    data = json.loads(TIMINGS.read_text(encoding="utf-8"))
    with wave.open(str(OUTPUT), "rb") as previous:
        audio_format = (previous.getnchannels(), previous.getsampwidth(), previous.getframerate())
        pcm = previous.readframes(previous.getnframes())
    channels, sample_width, sample_rate = audio_format
    bytes_per_frame = channels * sample_width
    chunks: list[bytes] = []
    timings: list[dict[str, object]] = []
    cursor = 0.0
    for index, (text, speed, old_item) in enumerate(zip(texts, SPEEDS, data["segments"], strict=True), start=1):
        if index == target:
            print(f"Regenerando frase {index}/{len(texts)}…", flush=True)
            wav_bytes = request_speech(api_key, text, PROFILE, speed)
            with wave.open(io.BytesIO(wav_bytes), "rb") as wav:
                current_format = (wav.getnchannels(), wav.getsampwidth(), wav.getframerate())
                if current_format != audio_format:
                    raise RuntimeError("OpenAI devolvió un WAV incompatible.")
                frames = wav.readframes(wav.getnframes())
            frames = adjust_tempo(frames, audio_format, RETIME_TEMPOS[index - 1])
        else:
            start_byte = round(old_item["start"] * sample_rate) * bytes_per_frame
            end_byte = round(old_item["end"] * sample_rate) * bytes_per_frame
            frames = pcm[start_byte:end_byte]
        duration = len(frames) / (bytes_per_frame * sample_rate)
        timings.append({
            "start": round(cursor, 4),
            "end": round(cursor + duration, 4),
            "text": text,
            "speed": speed,
            "post_tempo": RETIME_TEMPOS[index - 1],
        })
        chunks.append(frames)
        cursor += duration
        if index < len(texts):
            chunks.append(b"\0" * int(PAUSE_SECONDS * sample_rate) * bytes_per_frame)
            cursor += PAUSE_SECONDS
    write_audio(chunks, audio_format)
    data["duration"] = round(cursor, 4)
    data["segments"] = timings
    TIMINGS.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Locución actualizada: {OUTPUT}")
    print(f"Duración: {cursor:.2f}s")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--voice",
        choices=("alloy", "ash", "ballad", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer", "verse", "marin", "cedar"),
        default="cedar",
    )
    parser.add_argument("--retime-existing", action="store_true")
    parser.add_argument("--tempo", type=float, help="Tempo uniforme para --retime-existing.")
    parser.add_argument("--only-segment", type=int, choices=range(1, 7))
    args = parser.parse_args()
    configure_voice(args.voice)
    if args.retime_existing and args.only_segment:
        parser.error("Usa solo una operación a la vez.")
    if args.only_segment:
        regenerate_segment(args.only_segment)
    elif args.retime_existing:
        retime_existing(args.tempo)
    else:
        generate()


if __name__ == "__main__":
    main()
