#!/usr/bin/env python3
"""Renderiza el segundo anuncio vertical de Junt con presentadora y locución."""

from __future__ import annotations

import math
import json
import os
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

from render_promo import (
    BLUE,
    INK,
    LIME,
    LINE,
    MUTED,
    OLIVE,
    OLIVE_DARK,
    ORANGE,
    PAPER,
    WHITE,
    ease,
    font,
    pill,
    rgba,
)


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "promo" / "assets"
VARIANT = os.environ.get("JUNT_PRESENTER_VARIANT", "female")
IS_MALE = VARIANT == "male"
OUTPUT = ROOT / "promo" / ("junt-presenter-male-promo-vertical.mp4" if IS_MALE else "junt-presenter-promo-vertical.mp4")
VOICE = ASSETS / ("presenter-voice-openai-male.wav" if IS_MALE else "presenter-voice-openai.wav")
VOICE_TIMINGS = ASSETS / ("presenter-voice-timings-male.json" if IS_MALE else "presenter-voice-timings.json")
W, H = 1080, 1920
FPS = 30
VOICE_DELAY = 0.35

DISPLAY_TEXTS = [
    "Si tú 'tá harto de que los coros siempre se barajen\nporque nadie se pone de acuerdo… te presentamos Junte.",
    "Con Junte, tú creas el grupo, mandas el link\ny ponen las opciones sobre la mesa.",
    "Cada quien vota, confirma si va y, en dos minutos,\nel plan queda armado.",
    "¿Que el junte es virtual? También pueden entrar\na la sala desde la misma app.",
    "Se acabaron los doscientos mensajes, el “déjame ver”\ny el “¿qué fue lo que se decidió?”.",
    "Junte. Menos mensajes, más planes.\nArma el próximo coro.",
]


def load_timing_data():
    if not VOICE_TIMINGS.exists():
        return [], 29.0
    data = json.loads(VOICE_TIMINGS.read_text(encoding="utf-8"))
    timings = data.get("segments", [])
    if len(timings) != len(DISPLAY_TEXTS):
        raise RuntimeError("Los timings de la voz no coinciden con los seis bloques del guion.")
    segments = [(item["start"], item["end"], DISPLAY_TEXTS[idx]) for idx, item in enumerate(timings)]
    return segments, float(data["duration"]) + VOICE_DELAY + 2.0


SEGMENTS, DURATION = load_timing_data()


def rounded_mask(size: tuple[int, int], radius: int) -> Image.Image:
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size[0], size[1]), radius=radius, fill=255)
    return mask


def build_presenters():
    prefix = "presenter-male" if IS_MALE else "presenter"
    originals = {
        "open": Image.open(ASSETS / f"{prefix}-open.png").convert("RGBA"),
        "speaking": Image.open(ASSETS / f"{prefix}-speaking.png").convert("RGBA"),
    }
    prepared = {}
    for height in (1080, 1210, 1320):
        for state, original in originals.items():
            width = int(original.width * height / original.height)
            prepared[(state, height)] = original.resize((width, height), Image.Resampling.LANCZOS)
    return prepared


PRESENTERS = build_presenters()


def speaking_at(t: float) -> bool:
    voice_t = t - VOICE_DELAY
    return any(start <= voice_t <= end for start, end, _ in SEGMENTS)


def current_segment(t: float) -> tuple[int, str] | None:
    voice_t = t - VOICE_DELAY
    for idx, (start, end, text) in enumerate(SEGMENTS):
        if start - 0.08 <= voice_t <= end + 0.12:
            return idx, text
    return None


def presenter(layer: Image.Image, t: float, x: int, y: int, height: int):
    talking = speaking_at(t)
    state = "speaking" if talking and int(t * 7.5) % 3 else "open"
    image = PRESENTERS[(state, height)]
    y += int(math.sin(t * 2.3) * 5)

    shadow = Image.new("RGBA", layer.size, (0, 0, 0, 0))
    shadow_alpha = image.getchannel("A").filter(ImageFilter.GaussianBlur(18))
    shadow_color = Image.new("RGBA", image.size, (5, 20, 12, 75))
    shadow_color.putalpha(shadow_alpha.point(lambda v: int(v * 0.26)))
    shadow.alpha_composite(shadow_color, (x + 14, y + 22))
    layer.alpha_composite(shadow)
    layer.alpha_composite(image, (x, y))


def title(draw: ImageDraw.ImageDraw, y: int, top: str, bottom: str, light=False):
    color = PAPER if light else INK
    accent = LIME if light else OLIVE
    top_font = font(28)
    main_font = font(70, display=True, bold=True)
    box = draw.textbbox((0, 0), top, font=top_font)
    draw.text(((W - box[2]) / 2, y), top, font=top_font, fill=accent)
    box = draw.textbbox((0, 0), bottom, font=main_font)
    draw.text(((W - box[2]) / 2, y + 48), bottom, font=main_font, fill=color)


def subtitle(layer: Image.Image, t: float):
    segment = current_segment(t)
    if segment is None:
        return
    idx, text = segment
    draw = ImageDraw.Draw(layer)
    y = 1598 if idx < 5 else 1515
    draw.rounded_rectangle((55, y, W - 55, y + 245), radius=38, fill=(15, 30, 22, 238))
    lines = text.split("\n")
    fnt = font(31)
    line_height = 47
    total = len(lines) * line_height
    for line_idx, line in enumerate(lines):
        box = draw.textbbox((0, 0), line, font=fnt)
        draw.text(((W - (box[2] - box[0])) / 2, y + (245 - total) / 2 + line_idx * line_height), line, font=fnt, fill=PAPER)
    # Indicador visual de que hay locución.
    for bar in range(4):
        height = 10 + int(12 * abs(math.sin(t * 9 + bar)))
        x = W - 100 + bar * 9
        draw.rounded_rectangle((x, y + 25 - height / 2, x + 5, y + 25 + height / 2), radius=2, fill=LIME)


def phone_shell(layer: Image.Image, x: int, y: int, w: int, h: int, heading: str):
    draw = ImageDraw.Draw(layer)
    shadow = Image.new("RGBA", layer.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle((x + 12, y + 22, x + w + 12, y + h + 22), radius=46, fill=(10, 25, 17, 70))
    shadow = shadow.filter(ImageFilter.GaussianBlur(20))
    layer.alpha_composite(shadow)
    draw.rounded_rectangle((x, y, x + w, y + h), radius=46, fill=WHITE, outline=INK, width=4)
    draw.rounded_rectangle((x + w * 0.37, y + 15, x + w * 0.63, y + 30), radius=8, fill=INK)
    draw.text((x + 35, y + 62), heading, font=font(31, display=True, bold=True), fill=INK)
    return draw


def background_dots(layer: Image.Image, t: float, color: str):
    draw = ImageDraw.Draw(layer)
    for idx in range(12):
        angle = idx * math.pi * 0.55 + t * 0.13
        radius = 280 + (idx % 4) * 125
        cx = W / 2 + math.cos(angle) * radius
        cy = 780 + math.sin(angle) * radius * 1.25
        if cy < 300:
            continue
        r = 7 + (idx % 3) * 4
        draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=rgba(color, 90))


def scene_hook(layer: Image.Image, t: float):
    draw = ImageDraw.Draw(layer)
    background_dots(layer, t, OLIVE)
    title(draw, 72, "CUANDO ORGANIZAR SE VUELVE UN LÍO", "¿Otra vez se barajó el coro?")
    bubbles = [
        (50, 360, 430, "¿Entonces, qué hacemos?", WHITE),
        (590, 455, 435, "Yo aviso ahorita…", "#cfefda"),
        (45, 655, 355, "¿Quién va?", LIME),
        (670, 725, 350, "¿A qué hora?", WHITE),
    ]
    for idx, (x, y, width, label, color) in enumerate(bubbles):
        p = ease((t - idx * 0.16) / 0.55)
        yy = y + int((1 - p) * 65)
        draw.rounded_rectangle((x, yy, x + width, yy + 92), radius=32, fill=color, outline=LINE, width=2)
        draw.text((x + 26, yy + 28), label, font=font(25), fill=INK)
    presenter(layer, t, 220, 390, 1210)


def scene_invite(layer: Image.Image, t: float):
    draw = ImageDraw.Draw(layer)
    title(draw, 70, "PRIMER PASO", "Crea el grupo. Manda el link.")
    x, y, w, h = 55, 315, 535, 1115
    pd = phone_shell(layer, x, y, w, h, "Invitar amigos")
    pd.rounded_rectangle((x + 35, y + 155, x + w - 35, y + 430), radius=26, fill=PAPER, outline=LINE, width=2)
    pd.text((x + 61, y + 190), "PLAN DE PANAS", font=font(17), fill=MUTED)
    pd.text((x + 61, y + 235), "Únete al grupo", font=font(34, display=True, bold=True), fill=INK)
    pd.text((x + 61, y + 305), "Los planes aparecen\ndespués de unirte.", font=font(21), fill=MUTED, spacing=6)
    pd.rounded_rectangle((x + 35, y + 485, x + w - 35, y + 575), radius=26, fill=OLIVE)
    pd.text((x + 150, y + 514), "Copiar enlace", font=font(23), fill=PAPER)
    pd.rounded_rectangle((x + 35, y + 605, x + w - 35, y + 695), radius=26, fill="#25d366")
    pd.text((x + 92, y + 634), "Compartir por WhatsApp", font=font(21), fill=INK)
    pulse = (t * 1.4) % 1
    r = 12 + int(pulse * 34)
    pd.ellipse((x + w - 88 - r, y + 530 - r, x + w - 88 + r, y + 530 + r), outline=rgba(LIME, int(180 * (1 - pulse))), width=5)
    presenter(layer, t, 515, 430, 1080)


def scene_vote(layer: Image.Image, t: float):
    draw = ImageDraw.Draw(layer)
    title(draw, 72, "SEGUNDO PASO", "Voten y confirmen quién va.")
    presenter(layer, t, -40, 490, 1080)
    x, y, w, h = 520, 315, 510, 1120
    pd = phone_shell(layer, x, y, w, h, "Cena del viernes")
    pd.text((x + 34, y + 114), "Viernes · 8:30 p. m.", font=font(18), fill=MUTED)
    options = [("Pizza y juegos", 0.82), ("Tacos", 0.58), ("Algo en casa", 0.36)]
    local = t - (SEGMENTS[2][0] + VOICE_DELAY)
    for idx, (label, value) in enumerate(options):
        oy = y + 170 + idx * 170
        pd.rounded_rectangle((x + 30, oy, x + w - 30, oy + 142), radius=24, fill="#ffffff", outline=LINE, width=2)
        pd.text((x + 52, oy + 22), label, font=font(23), fill=INK)
        pd.rounded_rectangle((x + 52, oy + 89, x + w - 52, oy + 106), radius=8, fill=LINE)
        amount = value * ease((local - idx * 0.2) / 0.8)
        pd.rounded_rectangle((x + 52, oy + 89, x + 52 + int((w - 104) * amount), oy + 106), radius=8, fill=OLIVE)
    pd.text((x + 34, y + 730), "TU ASISTENCIA", font=font(17), fill=MUTED)
    for idx, (label, color) in enumerate((("Voy", LIME), ("Tal vez", "#ffe69b"), ("No voy", "#eeeae2"))):
        bx = x + 30 + idx * 153
        pd.rounded_rectangle((bx, y + 775, bx + 137, y + 845), radius=23, fill=color, outline=INK if idx == 0 else LINE, width=2)
        pd.text((bx + 34, y + 797), label, font=font(18), fill=INK)
    pd.rounded_rectangle((x + 30, y + 905, x + w - 30, y + 985), radius=25, fill=INK)
    pd.text((x + 120, y + 930), "Plan confirmado", font=font(22), fill=PAPER)


def scene_live(layer: Image.Image, t: float):
    draw = ImageDraw.Draw(layer)
    title(draw, 72, "SI EL JUNTE ES VIRTUAL", "Entren desde la misma app.")
    x, y, w, h = 60, 315, 555, 1120
    pd = phone_shell(layer, x, y, w, h, "Noche de juegos")
    colors = ["#ffb38a", "#8fb7ff", "#b9e39c", "#efb9d5"]
    names = ["Lia", "Mario", "Ana", "Joel"]
    for idx in range(4):
        col, row = idx % 2, idx // 2
        bx = x + 31 + col * 253
        by = y + 150 + row * 295
        pd.rounded_rectangle((bx, by, bx + 235, by + 265), radius=24, fill=colors[idx])
        bounce = int(math.sin(t * 3 + idx) * 5)
        pd.ellipse((bx + 82, by + 58 + bounce, bx + 153, by + 129 + bounce), fill=INK)
        pd.arc((bx + 59, by + 116 + bounce, bx + 177, by + 226 + bounce), 180, 360, fill=INK, width=24)
        pd.rounded_rectangle((bx + 14, by + 215, bx + 75, by + 247), radius=13, fill=rgba(INK, 215))
        pd.text((bx + 26, by + 223), names[idx], font=font(14), fill=PAPER)
    pd.rounded_rectangle((x + 120, y + 845, x + w - 120, y + 920), radius=27, fill=OLIVE)
    pd.text((x + 194, y + 868), "EN VIVO", font=font(20), fill=PAPER)
    presenter(layer, t, 520, 440, 1080)


def scene_no_chat(layer: Image.Image, t: float):
    draw = ImageDraw.Draw(layer)
    title(draw, 72, "SIN EXCUSAS. SIN CONFUSIÓN.", "No más 200 mensajes.")
    local = t - (SEGMENTS[4][0] + VOICE_DELAY)
    messages = [
        (55, 340, 430, "Déjame ver…"),
        (620, 405, 400, "¿Qué decidieron?"),
        (50, 625, 375, "¿A qué hora era?"),
        (680, 730, 320, "¿Quién va?"),
    ]
    for idx, (x, y, width, label) in enumerate(messages):
        draw.rounded_rectangle((x, y, x + width, y + 90), radius=30, fill=WHITE, outline=LINE, width=2)
        draw.text((x + 25, y + 28), label, font=font(24), fill=MUTED)
        strike = ease((local - idx * 0.18) / 0.5)
        draw.line((x + 12, y + 76, x + 12 + (width - 24) * strike, y + 14), fill=ORANGE, width=9)
    presenter(layer, t, 215, 410, 1210)


def scene_final(layer: Image.Image, t: float):
    draw = ImageDraw.Draw(layer)
    background_dots(layer, t, OLIVE)
    presenter(layer, t, -90, 500, 1320)
    # Marca escrita Junt; la locución pronuncia Junte.
    draw.text((500, 270), "Junt", font=font(155, display=True, bold=True), fill=INK)
    draw.ellipse((847, 382, 892, 427), fill=OLIVE)
    draw.text((515, 500), "Menos mensajes.\nMás planes.", font=font(63, display=True, bold=True), fill=INK, spacing=8)
    draw.rounded_rectangle((515, 750, 1010, 855), radius=34, fill=INK)
    draw.text((606, 784), "ARMA EL PRÓXIMO CORO", font=font(22), fill=PAPER)
    draw.text((650, 900), "Disponible en web", font=font(22), fill=OLIVE)
    draw.text((650, 950), "Locución generada con IA", font=font(18), fill=MUTED)


def render_scene(idx: int, t: float) -> Image.Image:
    colors = [PAPER, LIME, PAPER, "#e9eefc", PAPER, LIME]
    layer = Image.new("RGBA", (W, H), rgba(colors[idx]))
    if idx == 0:
        scene_hook(layer, t)
    elif idx == 1:
        scene_invite(layer, t)
    elif idx == 2:
        scene_vote(layer, t)
    elif idx == 3:
        scene_live(layer, t)
    elif idx == 4:
        scene_no_chat(layer, t)
    else:
        scene_final(layer, t)
    return layer


def scene_transition(t: float):
    """Mantiene la escena anterior durante las pausas y cruza a la siguiente."""
    voice_t = t - VOICE_DELAY
    transition_half = 0.18
    for next_idx in range(1, len(SEGMENTS)):
        boundary = SEGMENTS[next_idx][0]
        if voice_t < boundary - transition_half:
            return next_idx - 1, None, 0.0
        if voice_t <= boundary + transition_half:
            progress = (voice_t - (boundary - transition_half)) / (transition_half * 2)
            return next_idx - 1, next_idx, ease(progress)
    return len(SEGMENTS) - 1, None, 0.0


def render_frame(frame_number: int) -> Image.Image:
    t = frame_number / FPS
    first_idx, second_idx, mix = scene_transition(t)
    layer = render_scene(first_idx, t)
    if second_idx is not None:
        # Desplazamiento limpio: evita duplicar avatar y titulares, como
        # ocurría con el fundido cruzado entre escenas completas.
        offset = int(W * mix)
        transition_layer = Image.new("RGBA", (W, H), rgba(PAPER))
        transition_layer.alpha_composite(layer, (-offset, 0))
        transition_layer.alpha_composite(render_scene(second_idx, t), (W - offset, 0))
        layer = transition_layer
    subtitle(layer, t)
    return layer.convert("RGB")


def create_music(path: Path):
    sample_rate = 48_000
    total = int(DURATION * sample_rate)
    timeline = np.arange(total) / sample_rate
    audio = np.zeros(total, dtype=np.float64)
    bpm = 108
    beat = 60 / bpm
    chords = [(130.81, 164.81, 196.00), (110.00, 130.81, 164.81), (87.31, 110.00, 130.81), (98.00, 123.47, 146.83)]
    chord_len = beat * 4
    for start in np.arange(0, DURATION, chord_len):
        chord = chords[int(start / chord_len) % len(chords)]
        mask = (timeline >= start) & (timeline < min(DURATION, start + chord_len))
        tt = timeline[mask] - start
        fade = np.minimum(1, tt / 0.15) * np.minimum(1, (chord_len - tt) / 0.2)
        for frequency in chord:
            audio[mask] += 0.05 * np.sin(2 * np.pi * frequency * tt) * fade
    rng = np.random.default_rng(7)
    for n, start in enumerate(np.arange(0, DURATION, beat)):
        idx = int(start * sample_rate)
        length = min(int(0.18 * sample_rate), total - idx)
        tt = np.arange(length) / sample_rate
        audio[idx : idx + length] += 0.18 * np.sin(2 * np.pi * (70 - 35 * tt) * tt) * np.exp(-tt * 20)
        if n % 2:
            clap_len = min(int(0.08 * sample_rate), total - idx)
            audio[idx : idx + clap_len] += 0.035 * rng.normal(0, 1, clap_len) * np.exp(-np.arange(clap_len) / sample_rate * 38)
    envelope = np.minimum(1, timeline / 0.8) * np.minimum(1, (DURATION - timeline) / 1.3)
    pcm = (np.tanh(audio * 1.35) * envelope * 32767 * 0.8).astype(np.int16)
    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(sample_rate)
        wav.writeframes(pcm.tobytes())


def main():
    if not VOICE.exists() or not VOICE_TIMINGS.exists():
        command = "python3 promo/generate_openai_voice.py --variant male" if IS_MALE else "python3 promo/generate_openai_voice.py"
        raise SystemExit(f"Falta la locución de OpenAI TTS. Ejecuta primero: {command}")
    music_path = ASSETS / ".presenter-music.wav"
    create_music(music_path)
    voice_name = json.loads(VOICE_TIMINGS.read_text(encoding="utf-8")).get("voice")
    voice_gain = 1.72 if voice_name == "verse" else 1.42 if IS_MALE else 1.32
    command = [
        "ffmpeg", "-y", "-loglevel", "error",
        "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
        "-i", str(music_path), "-i", str(VOICE),
        "-filter_complex",
        f"[1:a]volume=0.18[m];[2:a]adelay={int(VOICE_DELAY * 1000)}|{int(VOICE_DELAY * 1000)},volume={voice_gain}[v];"
        "[m][v]amix=inputs=2:duration=longest:normalize=0,alimiter=limit=0.95[a]",
        "-map", "0:v", "-map", "[a]", "-c:v", "libx264", "-preset", "medium", "-crf", "18",
        "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-t", str(DURATION),
        "-movflags", "+faststart", str(OUTPUT),
    ]
    process = subprocess.Popen(command, stdin=subprocess.PIPE)
    assert process.stdin is not None
    try:
        for frame_number in range(int(DURATION * FPS)):
            process.stdin.write(render_frame(frame_number).tobytes())
            if frame_number % FPS == 0:
                print(f"Renderizando {frame_number // FPS:02d}/{int(DURATION)}s", flush=True)
    except BrokenPipeError:
        process.wait()
        sys.exit(process.returncode or 1)
    finally:
        process.stdin.close()
    status = process.wait()
    music_path.unlink(missing_ok=True)
    if status:
        sys.exit(status)
    print(f"Video creado: {OUTPUT}")


if __name__ == "__main__":
    main()
