#!/usr/bin/env python3
"""Renderiza el anuncio híbrido: descubrir eventos y organizar el coro."""

from __future__ import annotations

import argparse
import json
import math
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

from render_promo import BLUE, INK, LIME, LINE, MUTED, OLIVE, ORANGE, PAPER, WHITE, ease, font, rgba


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "promo" / "assets"
VOICE = ASSETS / "combo-voice-openai-cedar.wav"
VOICE_TIMINGS = ASSETS / "combo-voice-timings.json"
OUTPUT = ROOT / "promo" / "junt-discover-and-organize-promo-vertical.mp4"
OUTPUT_NO_SUBTITLES = ROOT / "promo" / "junt-discover-and-organize-no-subtitles-promo-vertical.mp4"
W, H, FPS = 1080, 1920, 30
VOICE_DELAY = 0.30
SHOW_PRESENTER = True

DISPLAY_TEXTS = [
    "Si el coro quiere juntarse, pero nadie sabe qué hacer,\nJunt resuelve las dos cosas.",
    "Primero descubre eventos y películas según la ciudad,\nel presupuesto y la categoría que buscan.",
    "Revisan fecha, lugar y precio, eligen lo que les cuadre\ny lo convierten en plan.",
    "Si hay varias ideas, votan. Si ya eligieron, confirman\nquién va y comparten el enlace.",
    "Y si el junte es virtual, entran a la sala\ndesde la misma app.",
    "Junt. Descubre qué hacer, organiza el coro\ny deja el mareo.\nMenos mensajes, más planes.",
]


def load_segments():
    data = json.loads(VOICE_TIMINGS.read_text(encoding="utf-8"))
    return [(float(x["start"]), float(x["end"]), DISPLAY_TEXTS[i]) for i, x in enumerate(data["segments"])], float(data["duration"]) + VOICE_DELAY + 2.0


SEGMENTS: list[tuple[float, float, str]] = []
DURATION = 0.0


def configure_voice(voice: str, no_avatar: bool = False) -> tuple[Path, Path]:
    global VOICE, VOICE_TIMINGS, SEGMENTS, DURATION, SHOW_PRESENTER
    SHOW_PRESENTER = not no_avatar
    if voice == "cedar":
        VOICE = ASSETS / "combo-voice-openai-cedar.wav"
        VOICE_TIMINGS = ASSETS / "combo-voice-timings.json"
    else:
        VOICE = ASSETS / f"combo-voice-openai-{voice}.wav"
        VOICE_TIMINGS = ASSETS / f"combo-voice-timings-{voice}.json"
    SEGMENTS, DURATION = load_segments()
    suffix = f"-{voice}-no-avatar" if no_avatar else ("" if voice == "cedar" else f"-{voice}")
    return (
        ROOT / "promo" / f"junt-discover-and-organize{suffix}-promo-vertical.mp4",
        ROOT / "promo" / f"junt-discover-and-organize{suffix}-no-subtitles-promo-vertical.mp4",
    )


def center(draw: ImageDraw.ImageDraw, x: int, y: int, text: str, fnt, fill, spacing=6):
    box = draw.multiline_textbbox((0, 0), text, font=fnt, spacing=spacing, align="center")
    draw.multiline_text((x - (box[2] - box[0]) / 2, y), text, font=fnt, fill=fill, spacing=spacing, align="center")


def card(layer: Image.Image, box: tuple[int, int, int, int], fill=WHITE, radius=34, outline=None):
    x1, y1, x2, y2 = box
    shadow = Image.new("RGBA", layer.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle((x1 + 10, y1 + 18, x2 + 10, y2 + 18), radius=radius, fill=(5, 22, 14, 62))
    layer.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(16)))
    ImageDraw.Draw(layer).rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=3 if outline else 1)


def header(draw: ImageDraw.ImageDraw, kicker: str, title: str, light=False):
    color = PAPER if light else INK
    accent = LIME if light else OLIVE
    center(draw, W // 2, 62, kicker, font(24, bold=True), accent)
    center(draw, W // 2, 112, title, font(68, display=True, bold=True), color, spacing=2)


def prepare_presenters():
    result = {}
    for state in ("open", "speaking"):
        original = Image.open(ASSETS / f"presenter-male-{state}.png").convert("RGBA")
        for height in (1020, 1220):
            width = int(original.width * height / original.height)
            result[(state, height)] = original.resize((width, height), Image.Resampling.LANCZOS)
    return result


PRESENTERS = prepare_presenters()


def presenter(layer: Image.Image, local: float, x: int, y: int, height: int):
    state = "speaking" if int(local * 7.5) % 3 else "open"
    image = PRESENTERS[(state, height)]
    y += int(math.sin(local * 2.1) * 5)
    shadow = Image.new("RGBA", layer.size, (0, 0, 0, 0))
    alpha = image.getchannel("A").filter(ImageFilter.GaussianBlur(18))
    tint = Image.new("RGBA", image.size, (5, 20, 12, 65))
    tint.putalpha(alpha.point(lambda v: int(v * 0.24)))
    shadow.alpha_composite(tint, (x + 14, y + 20))
    layer.alpha_composite(shadow)
    layer.alpha_composite(image, (x, y))


def scene_hook(local: float) -> Image.Image:
    layer = Image.new("RGBA", (W, H), rgba(PAPER))
    draw = ImageDraw.Draw(layer)
    draw.rectangle((0, 0, W // 2, H), fill=LIME)
    draw.rectangle((W // 2, 0, W, H), fill="#e9eefc")
    draw.text((60, 82), "DESCUBRIR", font=font(28, bold=True), fill=OLIVE)
    draw.text((600, 82), "ORGANIZAR", font=font(28, bold=True), fill=BLUE)
    draw.multiline_text((55, 155), "¿QUÉ\nHACEMOS?", font=font(78, display=True, bold=True), fill=INK, spacing=0)
    draw.multiline_text((590, 155), "¿QUIÉN\nSE APUNTA?", font=font(72, display=True, bold=True), fill=INK, spacing=0)
    bubbles = [(40, 500, 420, "¿Qué hay hoy?"), (650, 485, 1030, "¿Quién va?"), (55, 650, 430, "Algo gratis"), (650, 635, 1020, "Manden el link")]
    for i, (x1, y1, x2, label) in enumerate(bubbles):
        p = ease((local - i * 0.1) / 0.5)
        yy = y1 + int((1 - p) * 60)
        fill = WHITE if i % 2 else INK
        draw.rounded_rectangle((x1, yy, x2, yy + 88), radius=29, fill=fill)
        draw.text((x1 + 25, yy + 26), label, font=font(24, bold=True), fill=PAPER if i % 2 == 0 else INK)
    if SHOW_PRESENTER:
        presenter(layer, local, 215, 610, 1220)
        draw.rounded_rectangle((205, 1310, 875, 1435), radius=38, fill=INK)
        center(draw, W // 2, 1342, "JUNT RESUELVE LAS DOS.", font(30, bold=True), LIME)
    else:
        card(layer, (105, 800, 975, 1580), PAPER, 54)
        center(draw, W // 2, 845, "DOS PROBLEMAS. UNA APP.", font(23, bold=True), OLIVE)
        center(draw, W // 2, 900, "Junt", font(164, display=True, bold=True), INK)
        draw.rounded_rectangle((170, 1115, 520, 1235), radius=30, fill=LIME, outline=INK, width=3)
        center(draw, 345, 1143, "DESCUBRE", font(25, display=True, bold=True), INK)
        center(draw, 345, 1183, "eventos y películas", font(17, bold=True), INK)
        draw.rounded_rectangle((560, 1115, 910, 1235), radius=30, fill="#e9eefc", outline=INK, width=3)
        center(draw, 735, 1143, "ORGANIZA", font(25, display=True, bold=True), INK)
        center(draw, 735, 1183, "votos y asistencia", font(17, bold=True), INK)
        draw.rounded_rectangle((205, 1390, 875, 1510), radius=34, fill=INK)
        center(draw, W // 2, 1426, "JUNT RESUELVE LAS DOS.", font(27, bold=True), LIME)
    return layer


def filter_box(draw: ImageDraw.ImageDraw, x: int, y: int, w: int, label: str, value: str, active=False):
    draw.rounded_rectangle((x, y, x + w, y + 100), radius=24, fill=LIME if active else WHITE, outline=INK if active else LINE, width=3)
    draw.text((x + 20, y + 15), label.upper(), font=font(14, bold=True), fill=MUTED)
    draw.text((x + 20, y + 48), value, font=font(23, bold=True), fill=INK)


def result_card(draw: ImageDraw.ImageDraw, y: int, number: str, title: str, meta: str, color: str, local: float, delay: float):
    p = ease((local - delay) / 0.45)
    xoff = int((1 - p) * 130)
    draw.rounded_rectangle((85 + xoff, y, 995 + xoff, y + 174), radius=28, fill=WHITE, outline=LINE, width=2)
    draw.rounded_rectangle((107 + xoff, y + 20, 270 + xoff, y + 154), radius=22, fill=color)
    center(draw, 188 + xoff, y + 54, number, font(42, display=True, bold=True), INK)
    draw.text((305 + xoff, y + 32), title, font=font(29, display=True, bold=True), fill=INK)
    draw.text((305 + xoff, y + 88), meta, font=font(19), fill=MUTED)
    draw.rounded_rectangle((830 + xoff, y + 58, 960 + xoff, y + 104), radius=17, fill=LIME)
    center(draw, 895 + xoff, y + 69, "VER", font(16, bold=True), INK)


def scene_discover(local: float) -> Image.Image:
    layer = Image.new("RGBA", (W, H), rgba("#e9eefc"))
    draw = ImageDraw.Draw(layer)
    header(draw, "PRIMERO: ENCUENTREN QUÉ HACER", "DESCUBRAN\nALGO QUE CUADRE")
    card(layer, (52, 390, 1028, 1500), PAPER, 44)
    filter_box(draw, 85, 435, 435, "Ciudad", "Santo Domingo", True)
    filter_box(draw, 560, 435, 435, "Presupuesto", "Gratis", True)
    filter_box(draw, 85, 560, 435, "Tipo", "Eventos")
    filter_box(draw, 560, 560, 435, "Categoría", "Música")
    draw.text((88, 720), "RECOMENDACIONES PARA EL CORO", font=font(20, bold=True), fill=OLIVE)
    result_card(draw, 775, "01", "Jazz bajo las estrellas", "Sáb 12 · Zona Colonial", LIME, local, 0.05)
    result_card(draw, 975, "02", "Festival Caribe", "Dom 13 · Malecón", "#9ebdff", local, 0.17)
    result_card(draw, 1175, "03", "Noche de comedia", "Vie 18 · Piantini", "#ffd7c3", local, 0.29)
    return layer


def scene_convert(local: float) -> Image.Image:
    layer = Image.new("RGBA", (W, H), rgba(LIME))
    draw = ImageDraw.Draw(layer)
    header(draw, "DESPUÉS: HÁGANLO REAL", "DEL EVENTO\nAL PLAN")
    card(layer, (55, 430, 470, 1405), WHITE, 38)
    draw.rounded_rectangle((85, 465, 440, 790), radius=27, fill=INK)
    draw.text((120, 520), "JAZZ", font=font(68, display=True, bold=True), fill=PAPER)
    draw.text((120, 606), "BAJO LAS\nESTRELLAS", font=font(31, display=True, bold=True), fill=LIME, spacing=0)
    draw.rounded_rectangle((112, 725, 245, 775), radius=19, fill=LIME)
    draw.text((143, 739), "GRATIS", font=font(16, bold=True), fill=INK)
    fields = [("FECHA", "Sáb 12 · 8:00"), ("LUGAR", "Zona Colonial"), ("TIPO", "Música")]
    for i, (label, value) in enumerate(fields):
        y = 845 + i * 120
        draw.text((92, y), label, font=font(15, bold=True), fill=MUTED)
        draw.text((92, y + 31), value, font=font(23, bold=True), fill=INK)
        draw.line((92, y + 79, 430, y + 79), fill=LINE, width=2)
    draw.rounded_rectangle((90, 1245, 435, 1335), radius=27, fill=INK)
    center(draw, 262, 1273, "USAR PARA PLAN", font(19, bold=True), PAPER)
    draw.line((490, 900, 580, 900), fill=INK, width=12)
    draw.polygon(((565, 875), (600, 900), (565, 925)), fill=INK)
    card(layer, (610, 430, 1025, 1405), PAPER, 38)
    draw.text((650, 480), "NUEVO PLAN", font=font(18, bold=True), fill=OLIVE)
    draw.multiline_text((650, 535), "Jazz bajo\nlas estrellas", font=font(42, display=True, bold=True), fill=INK, spacing=1)
    items = [("CUÁNDO", "Sáb 12 · 8:00 p. m."), ("DESCRIPCIÓN", "Zona Colonial · Gratis")]
    for i, (label, value) in enumerate(items):
        y = 750 + i * 160
        draw.text((650, y), label, font=font(15, bold=True), fill=MUTED)
        draw.rounded_rectangle((650, y + 35, 985, y + 125), radius=22, fill=WHITE, outline=LINE, width=2)
        draw.text((675, y + 65), value, font=font(20, bold=True), fill=INK)
    draw.rounded_rectangle((650, 1135, 985, 1230), radius=28, fill=LIME, outline=INK, width=2)
    center(draw, 817, 1165, "PUBLICAR PLAN", font(20, bold=True), INK)
    return layer


def avatar(draw: ImageDraw.ImageDraw, x: int, y: int, text: str, fill: str, status: str):
    draw.ellipse((x, y, x + 82, y + 82), fill=fill, outline=INK, width=3)
    center(draw, x + 41, y + 21, text, font(24, bold=True), INK)
    badge_fill = LIME if status == "✓" else "#ffe69b"
    draw.ellipse((x + 55, y + 55, x + 91, y + 91), fill=badge_fill, outline=INK, width=2)
    if status == "✓":
        draw.line((x + 64, y + 74, x + 70, y + 81), fill=INK, width=4)
        draw.line((x + 70, y + 81, x + 82, y + 67), fill=INK, width=4)
    else:
        center(draw, x + 73, y + 61, status, font(17, bold=True), INK)


def scene_organize(local: float) -> Image.Image:
    layer = Image.new("RGBA", (W, H), rgba(PAPER))
    draw = ImageDraw.Draw(layer)
    header(draw, "AHORA SÍ: ORGANICEN EL CORO", "VOTEN. CONFIRMEN.\nCOMPARTAN.")
    card(layer, (65, 400, 1015, 1490), WHITE, 44)
    draw.rounded_rectangle((105, 440, 975, 600), radius=29, fill=INK)
    draw.text((140, 474), "JAZZ BAJO LAS ESTRELLAS", font=font(27, display=True, bold=True), fill=PAPER)
    draw.text((140, 530), "Sábado 12 · 8:00 p. m.", font=font(19), fill="#cad6ce")
    draw.rounded_rectangle((790, 480, 940, 555), radius=24, fill=LIME)
    center(draw, 865, 503, "ACTIVO", font(17, bold=True), INK)
    draw.text((112, 655), "VOTACIÓN", font=font(18, bold=True), fill=OLIVE)
    options = [("Jazz", .78), ("Festival", .55), ("Cine", .33)]
    for i, (label, value) in enumerate(options):
        y = 705 + i * 120
        draw.text((115, y), label, font=font(22, bold=True), fill=INK)
        draw.rounded_rectangle((300, y + 5, 925, y + 35), radius=13, fill=LINE)
        amount = int(625 * value * ease((local - i * .12) / .65))
        draw.rounded_rectangle((300, y + 5, 300 + amount, y + 35), radius=13, fill=OLIVE)
    draw.text((112, 1090), "¿QUIÉN VA?", font=font(18, bold=True), fill=OLIVE)
    people = [(115, "LI", "#ffb38a", "✓"), (225, "MA", "#9ebdff", "✓"), (335, "AN", "#b9e39c", "✓"), (445, "JO", "#efb9d5", "?")]
    for i, args in enumerate(people):
        x, initials, fill, status = args
        avatar(draw, x, 1140 + int((1 - ease((local - .2 - i * .08) / .45)) * 55), initials, fill, status)
    draw.rounded_rectangle((610, 1125, 940, 1215), radius=27, fill="#25d366")
    center(draw, 775, 1154, "COMPARTIR", font(21, bold=True), INK)
    draw.rounded_rectangle((110, 1305, 940, 1405), radius=29, fill=INK)
    center(draw, 525, 1336, "PLAN CONFIRMADO", font(24, bold=True), PAPER)
    return layer


def scene_virtual(local: float) -> Image.Image:
    layer = Image.new("RGBA", (W, H), rgba("#e9eefc"))
    draw = ImageDraw.Draw(layer)
    header(draw, "¿EL JUNTE ES VIRTUAL?", "ENTREN DESDE\nLA MISMA APP")
    card(layer, (95, 390, 985, 1445), INK, 46)
    draw.rounded_rectangle((135, 435, 945, 555), radius=29, fill="#173428")
    draw.text((170, 470), "NOCHE DE JUEGOS", font=font(27, display=True, bold=True), fill=PAPER)
    draw.rounded_rectangle((760, 467, 910, 527), radius=21, fill=LIME)
    center(draw, 835, 485, "EN VIVO", font(16, bold=True), INK)
    colors = ["#ffb38a", "#9ebdff", "#b9e39c", "#efb9d5"]
    names = ["LIA", "MARIO", "ANA", "JOEL"]
    for i in range(4):
        col, row = i % 2, i // 2
        x = 135 + col * 405
        y = 600 + row * 340
        draw.rounded_rectangle((x, y, x + 365, y + 295), radius=30, fill=colors[i])
        bounce = int(math.sin(local * 3 + i) * 5)
        draw.ellipse((x + 132, y + 62 + bounce, x + 233, y + 163 + bounce), fill=INK)
        draw.arc((x + 93, y + 145 + bounce, x + 272, y + 290 + bounce), 180, 360, fill=INK, width=30)
        draw.rounded_rectangle((x + 20, y + 235, x + 115, y + 275), radius=15, fill=rgba(INK, 220))
        draw.text((x + 40, y + 246), names[i], font=font(15, bold=True), fill=PAPER)
    draw.rounded_rectangle((310, 1300, 770, 1380), radius=28, fill=ORANGE)
    center(draw, 540, 1326, "SALA CONECTADA", font(20, bold=True), INK)
    return layer


def scene_final(local: float) -> Image.Image:
    layer = Image.new("RGBA", (W, H), rgba(PAPER))
    draw = ImageDraw.Draw(layer)
    center(draw, W // 2, 105, "TODO EL JUNTE EN UN SOLO LUGAR", font(24, bold=True), OLIVE)
    center(draw, W // 2, 185, "Junt", font(220, display=True, bold=True), INK)
    center(draw, W // 2, 455, "DESCUBRE QUÉ HACER.\nORGANIZA EL CORO.", font(73, display=True, bold=True), INK, spacing=5)

    card(layer, (70, 745, 515, 1125), LIME, 38)
    draw.text((108, 785), "01", font=font(25, bold=True), fill=OLIVE)
    draw.text((108, 850), "DESCUBRE", font=font(42, display=True, bold=True), fill=INK)
    draw.multiline_text((108, 925), "Eventos, cine\ny planes que cuadran.", font=font(24, bold=True), fill=INK, spacing=7)

    card(layer, (565, 745, 1010, 1125), "#e9eefc", 38)
    draw.text((603, 785), "02", font=font(25, bold=True), fill=BLUE)
    draw.text((603, 850), "ORGANIZA", font=font(40, display=True, bold=True), fill=INK)
    draw.multiline_text((603, 925), "Votos, asistencia\ny un enlace para compartir.", font=font(24, bold=True), fill=INK, spacing=7)

    draw.rounded_rectangle((205, 1205, 875, 1315), radius=34, fill=INK)
    center(draw, W // 2, 1240, "ARMA EL PRÓXIMO CORO", font(24, bold=True), PAPER)
    center(draw, W // 2, 1370, "Menos mensajes. Más planes.", font(31, display=True, bold=True), OLIVE)
    center(draw, W // 2, 1430, "Disponible en web", font(20, bold=True), MUTED)
    center(draw, W // 2, 1475, "Locución generada con IA", font(17), MUTED)
    return layer


SCENES = [scene_hook, scene_discover, scene_convert, scene_organize, scene_virtual, scene_final]


def current_segment(t: float):
    voice_t = t - VOICE_DELAY
    for i, (start, end, text) in enumerate(SEGMENTS):
        if start - .05 <= voice_t <= end + .10:
            return i, text
    return None


def subtitle(layer: Image.Image, t: float):
    active = current_segment(t)
    if active is None:
        return
    idx, text = active
    draw = ImageDraw.Draw(layer)
    y = 1585 if idx < 5 else 1505
    draw.rounded_rectangle((52, y, W - 52, y + 245), radius=38, fill=(11, 28, 19, 242))
    lines = text.split("\n")
    fnt = font(28 if idx in (1, 3) else 30, bold=True)
    top = y + (245 - len(lines) * 47) / 2
    for line_index, line in enumerate(lines):
        box = draw.textbbox((0, 0), line, font=fnt)
        draw.text(((W - (box[2] - box[0])) / 2, top + line_index * 47), line, font=fnt, fill=PAPER)
    for i in range(4):
        bh = 10 + int(12 * abs(math.sin(t * 9 + i)))
        x = W - 102 + i * 9
        draw.rounded_rectangle((x, y + 27 - bh / 2, x + 5, y + 27 + bh / 2), radius=2, fill=LIME)


def scene_state(t: float):
    voice_t = t - VOICE_DELAY
    half = .18
    for next_index in range(1, len(SEGMENTS)):
        boundary = SEGMENTS[next_index][0]
        if voice_t < boundary - half:
            return next_index - 1, None, 0.0
        if voice_t <= boundary + half:
            return next_index - 1, next_index, ease((voice_t - boundary + half) / (half * 2))
    return len(SEGMENTS) - 1, None, 0.0


def render_frame(frame_number: int, show_subtitles: bool = True) -> Image.Image:
    t = frame_number / FPS
    first, second, progress = scene_state(t)
    local_first = max(0, t - VOICE_DELAY - SEGMENTS[first][0])
    layer = SCENES[first](local_first)
    if second is not None:
        local_second = max(0, t - VOICE_DELAY - SEGMENTS[second][0])
        incoming = SCENES[second](local_second)
        if progress < .5:
            cover = ease(progress * 2)
            half_width = int(W / 2 * cover)
            draw = ImageDraw.Draw(layer)
            draw.rectangle((0, 0, half_width, H), fill=ORANGE)
            draw.rectangle((W - half_width, 0, W, H), fill=ORANGE)
        else:
            reveal = ease((progress - .5) * 2)
            layer = incoming
            half_width = int(W / 2 * reveal)
            draw = ImageDraw.Draw(layer)
            draw.rectangle((0, 0, W // 2 - half_width, H), fill=ORANGE)
            draw.rectangle((W // 2 + half_width, 0, W, H), fill=ORANGE)
    if show_subtitles:
        subtitle(layer, t)
    return layer.convert("RGB")


def create_music(path: Path):
    sample_rate = 48_000
    total = int(DURATION * sample_rate)
    timeline = np.arange(total) / sample_rate
    audio = np.zeros(total, dtype=np.float64)
    bpm = 112
    beat = 60 / bpm
    bass = [98.0, 110.0, 130.81, 82.41]
    for n, start in enumerate(np.arange(0, DURATION, beat)):
        idx = int(start * sample_rate)
        length = min(int(.24 * sample_rate), total - idx)
        tt = np.arange(length) / sample_rate
        frequency = bass[(n // 4) % len(bass)]
        audio[idx:idx + length] += .12 * np.sin(2 * np.pi * frequency * tt) * np.exp(-tt * 16)
        if n % 2:
            clap = min(int(.07 * sample_rate), total - idx)
            rng = np.random.default_rng(n + 41)
            audio[idx:idx + clap] += .028 * rng.normal(0, 1, clap) * np.exp(-np.arange(clap) / sample_rate * 38)
    for n, start in enumerate(np.arange(0, DURATION, beat / 2)):
        idx = int(start * sample_rate)
        length = min(int(.14 * sample_rate), total - idx)
        tt = np.arange(length) / sample_rate
        note = [261.63, 329.63, 392.00, 329.63][n % 4]
        audio[idx:idx + length] += .027 * np.sin(2 * np.pi * note * tt) * np.exp(-tt * 18)
    envelope = np.minimum(1, timeline / .7) * np.minimum(1, (DURATION - timeline) / 1.2)
    pcm = (np.tanh(audio * 1.5) * envelope * 32767 * .80).astype(np.int16)
    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(1); wav.setsampwidth(2); wav.setframerate(sample_rate); wav.writeframes(pcm.tobytes())


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--voice",
        choices=("alloy", "ash", "ballad", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer", "verse", "marin", "cedar"),
        default="cedar",
    )
    parser.add_argument("--no-subtitles", action="store_true")
    parser.add_argument("--no-avatar", action="store_true")
    args = parser.parse_args()
    output, output_no_subtitles = configure_voice(args.voice, args.no_avatar)
    output_path = output_no_subtitles if args.no_subtitles else output
    if not VOICE.exists() or not VOICE_TIMINGS.exists():
        raise SystemExit("Ejecuta primero: python3 promo/generate_combo_voice.py")
    music = ASSETS / ".combo-music.wav"
    create_music(music)
    command = [
        "ffmpeg", "-y", "-loglevel", "error",
        "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
        "-i", str(music), "-i", str(VOICE),
        "-filter_complex",
        f"[1:a]volume=0.16[m];[2:a]adelay={int(VOICE_DELAY * 1000)}|{int(VOICE_DELAY * 1000)},volume=1.38[v];"
        "[m][v]amix=inputs=2:duration=longest:normalize=0,alimiter=limit=0.95[a]",
        "-map", "0:v", "-map", "[a]", "-c:v", "libx264", "-preset", "medium", "-crf", "18",
        "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", "-t", str(DURATION),
        "-movflags", "+faststart", str(output_path),
    ]
    process = subprocess.Popen(command, stdin=subprocess.PIPE)
    assert process.stdin is not None
    try:
        for frame_number in range(int(DURATION * FPS)):
            process.stdin.write(render_frame(frame_number, show_subtitles=not args.no_subtitles).tobytes())
            if frame_number % FPS == 0:
                print(f"Renderizando {frame_number // FPS:02d}/{int(DURATION)}s", flush=True)
    except BrokenPipeError:
        process.wait(); sys.exit(process.returncode or 1)
    finally:
        process.stdin.close()
    status = process.wait()
    music.unlink(missing_ok=True)
    if status:
        sys.exit(status)
    print(f"Video creado: {output_path}")


if __name__ == "__main__":
    main()
