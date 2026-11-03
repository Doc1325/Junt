#!/usr/bin/env python3
"""Genera la locución promocional con la API oficial de OpenAI TTS.

La clave se lee exclusivamente desde OPENAI_API_KEY. No se escribe en disco.
Cada párrafo se genera por separado para conservar timings precisos de escenas
y subtítulos; luego se concatenan en un único WAV.
"""

from __future__ import annotations

import argparse
import io
import json
import os
import ssl
import subprocess
import sys
import time
import urllib.error
import urllib.request
import wave
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PROMO = ROOT / "promo"
ASSETS = PROMO / "assets"
SCRIPT = PROMO / "presenter-script.txt"
LOCAL_ENV = PROMO / ".env.tts.local"

MODEL = "gpt-4o-mini-tts"
PAUSE_SECONDS = 0.30


def voice_profile(variant: str, male_voice: str = "onyx"):
    if variant == "male":
        segment_speeds = {
            "cedar": [1.15, 1.22, 1.20, 1.06, 1.28, 1.20],
            "onyx": [1.15, 1.35, 1.34, 1.18, 1.36, 1.35],
            "verse": [1.15, 1.35, 1.34, 1.18, 1.36, 1.35],
        }[male_voice]
        return {
            "voice": male_voice,
            "speed": 1.23,
            "segment_speeds": segment_speeds,
            "post_tempo": 1.06,
            "output": ASSETS / "presenter-voice-openai-male.wav",
            "timings": ASSETS / "presenter-voice-timings-male.json",
            "instructions": (
                "Habla en español dominicano natural, como un joven creador de contenido recomendándole "
                "una app a sus panas. Voz masculina cálida, segura, carismática y conversacional, con energía "
                "relajada y una sonrisa perceptible. Ritmo ágil de anuncio para redes sociales, con intención "
                "y pequeñas pausas naturales; nunca monótono, solemne ni con voz de locutor tradicional. "
                "Cuando la frase comience con 'Si tú ta jarto', di esas cuatro palabras completamente de corrido, "
                "como una sola unidad rítmica; no hagas pausas después de 'Si', 'tú' ni 'ta'. "
                "Pronuncia 'jarto' con una jota aspirada suave, como se dice coloquialmente en República Dominicana. "
                "Pronuncia la marca escrita 'Junte' exactamente como 'Junte'. La contracción 'tá' debe sonar "
                "natural. Mantén el sabor caribeño de forma auténtica y sutil, sin exagerar ni caricaturizar el acento."
            ),
        }
    return {
        "voice": "marin",
        "speed": 1.18,
        "output": ASSETS / "presenter-voice-openai.wav",
        "timings": ASSETS / "presenter-voice-timings.json",
        "instructions": (
            "Habla en español dominicano natural, como una joven creadora de contenido recomendándole "
            "una app a sus amigos. Voz cálida, segura, carismática y conversacional. Ritmo ágil de anuncio "
            "para redes sociales, con intención y pequeñas pausas naturales; nunca monótono ni solemne. "
            "Pronuncia la marca escrita 'Junte' exactamente como 'Junte'. La contracción 'tá' debe sonar "
            "natural. Mantén el sabor caribeño de forma auténtica y sutil, sin exagerar ni caricaturizar el acento."
        ),
    }


def request_speech(api_key: str, text: str, profile: dict, speed: float) -> bytes:
    payload = json.dumps(
        {
            "model": MODEL,
            "voice": profile["voice"],
            "input": text,
            "instructions": profile["instructions"],
            "response_format": "wav",
            "speed": speed,
        }
    ).encode("utf-8")
    request = urllib.request.Request(
        "https://api.openai.com/v1/audio/speech",
        data=payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        system_ca = Path("/etc/ssl/cert.pem")
        tls_context = ssl.create_default_context(cafile=str(system_ca) if system_ca.exists() else None)
        with urllib.request.urlopen(request, timeout=120, context=tls_context) as response:
            return response.read()
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"OpenAI TTS respondió HTTP {error.code}: {detail}") from error


def load_api_key() -> str | None:
    if os.environ.get("OPENAI_API_KEY"):
        return os.environ["OPENAI_API_KEY"]
    if not LOCAL_ENV.exists():
        return None
    for line in LOCAL_ENV.read_text(encoding="utf-8").splitlines():
        key, separator, value = line.partition("=")
        if separator and key.strip() == "OPENAI_API_KEY":
            return value.strip().strip('"').strip("'") or None
    return None


def compact_internal_silences(frames: bytes, audio_format: tuple[int, int, int]) -> bytes:
    """Reduce pausas internas largas sin cambiar velocidad ni afinación."""
    channels, sample_width, sample_rate = audio_format
    if sample_width != 2:
        raise RuntimeError("La compactación espera PCM de 16 bits.")
    process = subprocess.run(
        [
            "ffmpeg", "-hide_banner", "-loglevel", "error",
            "-f", "s16le", "-ar", str(sample_rate), "-ac", str(channels), "-i", "pipe:0",
            "-af", "silenceremove=start_periods=1:start_duration=0.03:start_threshold=-38dB:start_silence=0.03:stop_periods=-1:stop_duration=0.02:stop_threshold=-38dB:stop_silence=0.015:detection=rms",
            "-f", "s16le", "pipe:1",
        ],
        input=frames,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=True,
    )
    return process.stdout


def adjust_tempo(frames: bytes, audio_format: tuple[int, int, int], tempo: float) -> bytes:
    """Ajusta el tempo con preservación de afinación."""
    channels, sample_width, sample_rate = audio_format
    if sample_width != 2:
        raise RuntimeError("El ajuste de tempo espera PCM de 16 bits.")
    process = subprocess.run(
        [
            "ffmpeg", "-hide_banner", "-loglevel", "error",
            "-f", "s16le", "-ar", str(sample_rate), "-ac", str(channels), "-i", "pipe:0",
            "-af", f"atempo={tempo}", "-f", "s16le", "pipe:1",
        ],
        input=frames,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=True,
    )
    return process.stdout


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--variant", choices=("female", "male"), default="female")
    parser.add_argument(
        "--male-voice",
        choices=("cedar", "onyx", "verse"),
        default="onyx",
        help="Voz usada por la variante masculina (por defecto: onyx).",
    )
    parser.add_argument("--only-segment", type=int, choices=range(1, 7))
    parser.add_argument("--retime-segment", type=int, choices=range(1, 7))
    parser.add_argument("--retime-all", action="store_true")
    parser.add_argument("--tempo", type=float, default=1.0)
    args = parser.parse_args()
    if sum(bool(value) for value in (args.only_segment, args.retime_segment, args.retime_all)) > 1:
        parser.error("Las opciones de regeneración y retiming no se pueden combinar")
    profile = voice_profile(args.variant, args.male_voice)
    output_path = profile["output"]
    timings_path = profile["timings"]
    api_key = load_api_key()
    if not api_key:
        raise SystemExit(
            "Falta OPENAI_API_KEY. Expórtala para la sesión o colócala en promo/.env.tts.local:\n"
            "  OPENAI_API_KEY='tu-clave'\n"
            "  python3 promo/generate_openai_voice.py"
        )

    paragraphs = [part.strip().replace("\n", " ") for part in SCRIPT.read_text(encoding="utf-8").split("\n\n") if part.strip()]
    if not paragraphs:
        raise SystemExit("El guion está vacío.")

    ASSETS.mkdir(parents=True, exist_ok=True)
    pcm_segments: list[bytes] = []
    timings = []
    audio_format = None
    cursor = 0.0
    cached_segments = {}

    if args.only_segment or args.retime_segment or args.retime_all:
        if not output_path.exists() or not timings_path.exists():
            raise SystemExit("No existe una locución previa para regenerar un solo segmento.")
        old_timings = json.loads(timings_path.read_text(encoding="utf-8"))["segments"]
        with wave.open(str(output_path), "rb") as previous:
            audio_format = (previous.getnchannels(), previous.getsampwidth(), previous.getframerate())
            previous_pcm = previous.readframes(previous.getnframes())
        channels, sample_width, sample_rate = audio_format
        bytes_per_frame = channels * sample_width
        for cached_index, item in enumerate(old_timings, start=1):
            start_byte = round(item["start"] * sample_rate) * bytes_per_frame
            end_byte = round(item["end"] * sample_rate) * bytes_per_frame
            cached_segments[cached_index] = previous_pcm[start_byte:end_byte]

    for index, paragraph in enumerate(paragraphs, start=1):
        segment_speeds = profile.get("segment_speeds")
        segment_speed = segment_speeds[index - 1] if segment_speeds else profile["speed"]
        if args.retime_all:
            frames = adjust_tempo(cached_segments[index], audio_format, args.tempo)
            channels, sample_width, sample_rate = audio_format
            duration = len(frames) / (channels * sample_width * sample_rate)
        elif args.retime_segment:
            frames = cached_segments[index]
            if index == args.retime_segment:
                frames = adjust_tempo(frames, audio_format, args.tempo)
            channels, sample_width, sample_rate = audio_format
            duration = len(frames) / (channels * sample_width * sample_rate)
        elif args.only_segment and index != args.only_segment:
            frames = cached_segments[index]
            channels, sample_width, sample_rate = audio_format
            duration = len(frames) / (channels * sample_width * sample_rate)
        else:
            print(f"Generando frase {index}/{len(paragraphs)}…", flush=True)
            wav_bytes = request_speech(api_key, paragraph, profile, segment_speed)
            with wave.open(io.BytesIO(wav_bytes), "rb") as wav:
                current_format = (wav.getnchannels(), wav.getsampwidth(), wav.getframerate())
                if audio_format is None:
                    audio_format = current_format
                elif current_format != audio_format:
                    raise RuntimeError("OpenAI devolvió segmentos WAV con formatos incompatibles.")
                frames = wav.readframes(wav.getnframes())
                # Los WAV transmitidos pueden anunciar 0x7fffffff frames en el
                # encabezado. La longitud PCM real es la fuente confiable.
                channels, sample_width, sample_rate = current_format
                if args.variant == "male" and index == 1:
                    frames = compact_internal_silences(frames, current_format)
                    frames = adjust_tempo(frames, current_format, 0.92)
                if profile.get("post_tempo"):
                    frames = adjust_tempo(frames, current_format, profile["post_tempo"])
                duration = len(frames) / (channels * sample_width * sample_rate)

        start = cursor
        end = start + duration
        timings.append({"start": round(start, 4), "end": round(end, 4), "text": paragraph, "speed": segment_speed})
        pcm_segments.append(frames)
        cursor = end

        if index < len(paragraphs):
            channels, sample_width, sample_rate = audio_format
            pause_frames = int(PAUSE_SECONDS * sample_rate)
            pcm_segments.append(b"\0" * pause_frames * channels * sample_width)
            cursor += PAUSE_SECONDS
        time.sleep(0.15)

    assert audio_format is not None
    channels, sample_width, sample_rate = audio_format
    with wave.open(str(output_path), "wb") as output:
        output.setnchannels(channels)
        output.setsampwidth(sample_width)
        output.setframerate(sample_rate)
        output.writeframes(b"".join(pcm_segments))

    timings_path.write_text(
        json.dumps(
            {
                "model": MODEL,
                "voice": profile["voice"],
                "variant": args.variant,
                "ai_generated": True,
                "duration": round(cursor, 4),
                "segments": timings,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"Locución creada: {output_path}")
    print(f"Duración: {cursor:.2f}s")


if __name__ == "__main__":
    try:
        main()
    except RuntimeError as error:
        print(error, file=sys.stderr)
        raise SystemExit(1) from error
