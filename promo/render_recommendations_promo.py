#!/usr/bin/env python3
"""Renderiza un anuncio vertical de Junt centrado en recomendaciones."""

from __future__ import annotations

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
VOICE = ASSETS / "recommendations-voice-openai-cedar.wav"
VOICE_TIMINGS = ASSETS / "recommendations-voice-timings.json"
OUTPUT = ROOT / "promo" / "junt-recommendations-promo-vertical.mp4"
W, H, FPS = 1080, 1920, 30
VOICE_DELAY = 0.30

DISPLAY_TEXTS = [
    "¿El coro quiere salir,\npero nadie sabe pa’ dónde?",
    "Junt te recomienda eventos y películas\nsegún lo que busca el grupo.",
    "Elige ciudad, presupuesto, tipo y categoría.\nMúsica, festivales, comedia, teatro, cine… y planes gratis.",
    "Mira fecha, lugar y precio.\nConviértelo en un plan con un toque.",
    "Mándalo al grupo: votan, confirman quién va\ny se acabó el rebú.",
    "Junt. Descubre el plan.\nJunta el coro.",
]


def load_segments():
    data = json.loads(VOICE_TIMINGS.read_text(encoding="utf-8"))
    timings = data["segments"]
    return [(float(item["start"]), float(item["end"]), DISPLAY_TEXTS[i]) for i, item in enumerate(timings)], float(data["duration"]) + VOICE_DELAY + 2.0


SEGMENTS, DURATION = load_segments()


def text_center(draw: ImageDraw.ImageDraw, xy: tuple[int, int], text: str, fnt, fill, spacing=8):
    box = draw.multiline_textbbox((0, 0), text, font=fnt, spacing=spacing, align="center")
    draw.multiline_text((xy[0] - (box[2] - box[0]) / 2, xy[1]), text, font=fnt, fill=fill, spacing=spacing, align="center")


def shadow_card(layer: Image.Image, box: tuple[int, int, int, int], radius=34, fill=WHITE, outline=None):
    x1, y1, x2, y2 = box
    shadow = Image.new("RGBA", layer.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle((x1 + 12, y1 + 18, x2 + 12, y2 + 18), radius=radius, fill=(5, 22, 14, 68))
    layer.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(18)))
    ImageDraw.Draw(layer).rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=3 if outline else 1)


def eyebrow(draw: ImageDraw.ImageDraw, y: int, text: str, color=OLIVE):
    text_center(draw, (W // 2, y), text, font(25), color)


def scene_header(draw: ImageDraw.ImageDraw, eyebrow_text: str, headline: str, light=False):
    color = PAPER if light else INK
    accent = LIME if light else OLIVE
    eyebrow(draw, 68, eyebrow_text, accent)
    text_center(draw, (W // 2, 112), headline, font(68, display=True, bold=True), color, spacing=4)


def scene_hook(local: float) -> Image.Image:
    layer = Image.new("RGBA", (W, H), rgba(INK))
    draw = ImageDraw.Draw(layer)
    for i in range(9):
        angle = local * 0.18 + i * 0.78
        x = W / 2 + math.cos(angle) * (260 + i * 34)
        y = 820 + math.sin(angle) * (380 + i * 15)
        r = 6 + i % 3 * 5
        draw.ellipse((x - r, y - r, x + r, y + r), fill=rgba(LIME if i % 2 else BLUE, 115))
    eyebrow(draw, 92, "OTRO FIN DE SEMANA", LIME)
    text_center(draw, (W // 2, 170), "¿PA’ DÓNDE\nVA EL CORO?", font(112, display=True, bold=True), PAPER, spacing=-2)
    bubbles = [
        (60, 650, 515, "¿Qué hay hoy?", LIME, INK),
        (500, 805, 1010, "A mí me da igual…", WHITE, INK),
        (105, 970, 610, "¿Cine o concierto?", "#9ebdff", INK),
        (550, 1135, 1018, "Manden opciones", "#ffd7c3", INK),
    ]
    for i, (x1, y1, x2, label, fill, color) in enumerate(bubbles):
        p = ease((local - i * 0.11) / 0.50)
        offset = int((1 - p) * (80 if i % 2 == 0 else -80))
        draw.rounded_rectangle((x1 + offset, y1, x2 + offset, y1 + 105), radius=35, fill=fill)
        draw.text((x1 + 34 + offset, y1 + 32), label, font=font(29, bold=True), fill=color)
    draw.text((85, 1360), "TANTO HABLAR.\nCERO PLAN.", font=font(62, display=True, bold=True), fill=LIME, spacing=4)
    return layer


def event_poster(layer: Image.Image, box: tuple[int, int, int, int], color: str, accent: str, kicker: str, title_text: str, local: float, delay: float):
    x1, y1, x2, y2 = box
    p = ease((local - delay) / 0.55)
    y_offset = int((1 - p) * 110)
    box = (x1, y1 + y_offset, x2, y2 + y_offset)
    shadow_card(layer, box, 38, color)
    draw = ImageDraw.Draw(layer)
    x1, y1, x2, y2 = box
    draw.ellipse((x2 - 170, y1 - 55, x2 + 70, y1 + 185), fill=rgba(accent, 185))
    draw.arc((x1 + 25, y1 + 40, x2 - 25, y1 + 330), 190, 350, fill=accent, width=13)
    draw.text((x1 + 34, y1 + 40), kicker, font=font(19, bold=True), fill=INK)
    draw.multiline_text((x1 + 34, y1 + 300), title_text, font=font(48, display=True, bold=True), fill=INK, spacing=1)
    draw.rounded_rectangle((x1 + 34, y2 - 112, x2 - 34, y2 - 48), radius=22, fill=INK)
    draw.text((x1 + 62, y2 - 93), "VER DETALLE  →", font=font(20, bold=True), fill=PAPER)


def scene_recommendations(local: float) -> Image.Image:
    layer = Image.new("RGBA", (W, H), rgba(PAPER))
    draw = ImageDraw.Draw(layer)
    scene_header(draw, "JUNT LO PONE FÁCIL", "EVENTOS\nRECOMENDADOS")
    event_poster(layer, (55, 420, 515, 1250), "#c6ff4a", OLIVE, "MÚSICA · GRATIS", "JAZZ BAJO\nLAS ESTRELLAS", local, 0.00)
    event_poster(layer, (565, 500, 1025, 1330), "#9ebdff", BLUE, "FESTIVAL · ESTE SÁBADO", "FESTIVAL\nCARIBE", local, 0.13)
    draw.rounded_rectangle((255, 1375, 825, 1460), radius=30, fill=INK)
    text_center(draw, (W // 2, 1398), "CONCIERTOS · CINE · TEATRO · COMEDIA", font(20, bold=True), PAPER)
    return layer


def filter_chip(draw: ImageDraw.ImageDraw, x: int, y: int, width: int, label: str, value: str, active=False):
    draw.rounded_rectangle((x, y, x + width, y + 104), radius=26, fill=LIME if active else WHITE, outline=INK if active else LINE, width=3)
    draw.text((x + 22, y + 17), label.upper(), font=font(15, bold=True), fill=MUTED)
    draw.text((x + 22, y + 51), value, font=font(24, bold=True), fill=INK)
    draw.text((x + width - 38, y + 52), "⌄", font=font(21), fill=INK)


def mini_event(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], rank: str, title_text: str, meta: str, color: str, local: float, delay: float):
    x1, y1, x2, y2 = box
    p = ease((local - delay) / 0.48)
    xoff = int((1 - p) * 150)
    draw.rounded_rectangle((x1 + xoff, y1, x2 + xoff, y2), radius=28, fill=WHITE, outline=LINE, width=2)
    draw.rounded_rectangle((x1 + 20 + xoff, y1 + 20, x1 + 165 + xoff, y2 - 20), radius=20, fill=color)
    text_center(draw, (x1 + 92 + xoff, y1 + 65), rank, font(42, display=True, bold=True), INK)
    draw.text((x1 + 195 + xoff, y1 + 30), title_text, font=font(28, display=True, bold=True), fill=INK)
    draw.text((x1 + 195 + xoff, y1 + 84), meta, font=font(19), fill=MUTED)
    draw.rounded_rectangle((x2 - 135 + xoff, y1 + 54, x2 - 25 + xoff, y1 + 98), radius=16, fill=LIME)
    draw.text((x2 - 113 + xoff, y1 + 66), "GRATIS", font=font(15, bold=True), fill=INK)


def scene_filters(local: float) -> Image.Image:
    layer = Image.new("RGBA", (W, H), rgba("#e9eefc"))
    draw = ImageDraw.Draw(layer)
    scene_header(draw, "TÚ DECIDES QUÉ CUADRA", "FILTRA. DESCUBRE.\nELIGE.")
    shadow_card(layer, (52, 410, 1028, 1500), 44, PAPER)
    filter_chip(draw, 85, 455, 435, "Ciudad", "Santo Domingo", True)
    filter_chip(draw, 560, 455, 435, "Presupuesto", "Gratis", True)
    filter_chip(draw, 85, 585, 435, "Tipo", "Eventos")
    filter_chip(draw, 560, 585, 435, "Categoría", "Música")
    draw.text((88, 750), "RECOMENDADAS PARA EL CORO", font=font(20, bold=True), fill=OLIVE)
    mini_event(draw, (85, 805, 995, 970), "01", "Jazz bajo las estrellas", "Sáb 12 · Zona Colonial", "#c6ff4a", local, 0.10)
    mini_event(draw, (85, 995, 995, 1160), "02", "Festival Caribe", "Dom 13 · Malecón", "#9ebdff", local, 0.22)
    mini_event(draw, (85, 1185, 995, 1350), "03", "Noche de comedia", "Vie 18 · Piantini", "#ffd7c3", local, 0.34)
    return layer


def scene_detail(local: float) -> Image.Image:
    layer = Image.new("RGBA", (W, H), rgba(LIME))
    draw = ImageDraw.Draw(layer)
    scene_header(draw, "TODO LO QUE NECESITAN", "MIRA EL DETALLE")
    shadow_card(layer, (95, 380, 985, 1505), 48, WHITE)
    draw.rounded_rectangle((130, 415, 950, 850), radius=34, fill=INK)
    for i in range(7):
        x = 155 + i * 120
        h = 85 + int(75 * (0.5 + 0.5 * math.sin(local * 3 + i)))
        draw.rounded_rectangle((x, 760 - h, x + 54, 760), radius=22, fill=LIME if i % 2 == 0 else "#9ebdff")
    draw.text((160, 460), "JAZZ", font=font(96, display=True, bold=True), fill=PAPER)
    draw.text((160, 565), "BAJO LAS ESTRELLAS", font=font(38, display=True, bold=True), fill=LIME)
    draw.rounded_rectangle((735, 445, 915, 505), radius=24, fill=LIME)
    draw.text((774, 464), "GRATIS", font=font(20, bold=True), fill=INK)
    draw.text((145, 900), "Jazz bajo las estrellas", font=font(47, display=True, bold=True), fill=INK)
    rows = [("FECHA", "Sábado 12 · 8:00 p. m."), ("LUGAR", "Zona Colonial · Santo Domingo"), ("CATEGORÍA", "Música")]
    for i, (label, value) in enumerate(rows):
        y = 1005 + i * 112
        draw.text((148, y), label, font=font(17, bold=True), fill=MUTED)
        draw.text((315, y - 5), value, font=font(25, bold=True), fill=INK)
        draw.line((148, y + 66, 930, y + 66), fill=LINE, width=2)
    pulse = 1 + 0.025 * math.sin(local * 5)
    bw = int(730 * pulse)
    bx = W // 2 - bw // 2
    draw.rounded_rectangle((bx, 1360, bx + bw, 1450), radius=30, fill=INK)
    text_center(draw, (W // 2, 1387), "USAR PARA PLAN", font(24, bold=True), PAPER)
    return layer


def avatar(draw: ImageDraw.ImageDraw, x: int, y: int, initials: str, color: str, going=True):
    draw.ellipse((x, y, x + 92, y + 92), fill=color, outline=INK, width=3)
    text_center(draw, (x + 46, y + 24), initials, font(27, bold=True), INK)
    badge = LIME if going else "#ffe69b"
    draw.ellipse((x + 62, y + 62, x + 98, y + 98), fill=badge, outline=INK, width=2)
    text_center(draw, (x + 80, y + 67), "✓" if going else "?", font(18, bold=True), INK)


def scene_plan(local: float) -> Image.Image:
    layer = Image.new("RGBA", (W, H), rgba(PAPER))
    draw = ImageDraw.Draw(layer)
    scene_header(draw, "DEL DESCUBRIMIENTO A LA ACCIÓN", "UN TOQUE.\nPLAN ARMADO.")
    shadow_card(layer, (80, 405, 1000, 1485), 46, WHITE)
    draw.rounded_rectangle((115, 445, 965, 700), radius=30, fill=INK)
    draw.rounded_rectangle((145, 480, 330, 665), radius=24, fill=LIME)
    draw.text((185, 526), "JAZZ", font=font(39, display=True, bold=True), fill=INK)
    draw.text((365, 485), "PLAN DEL GRUPO", font=font(17, bold=True), fill=LIME)
    draw.multiline_text((365, 530), "Jazz bajo\nlas estrellas", font=font(39, display=True, bold=True), fill=PAPER, spacing=0)
    draw.text((365, 635), "Sáb 12 · 8:00 p. m.", font=font(20), fill="#cdd7d0")
    draw.text((130, 760), "¿QUIÉN VA?", font=font(19, bold=True), fill=OLIVE)
    people = [(130, "LI", "#ffb38a", True), (260, "MA", "#9ebdff", True), (390, "AN", "#b9e39c", True), (520, "JO", "#efb9d5", False)]
    for i, (x, initials, color, going) in enumerate(people):
        p = ease((local - i * 0.10) / 0.45)
        avatar(draw, x, 820 + int((1 - p) * 80), initials, color, going)
    draw.rounded_rectangle((130, 970, 950, 1085), radius=30, fill="#f0f7f0", outline=LINE, width=2)
    draw.text((165, 998), "ASISTENCIA CONFIRMADA", font=font(18, bold=True), fill=OLIVE)
    draw.text((165, 1033), "3 van · 1 tal vez", font=font(25, bold=True), fill=INK)
    draw.rounded_rectangle((130, 1135, 950, 1235), radius=30, fill=LIME, outline=INK, width=2)
    text_center(draw, (540, 1166), "COMPARTIR CON EL CORO", font(23, bold=True), INK)
    draw.rounded_rectangle((130, 1270, 950, 1370), radius=30, fill=INK)
    text_center(draw, (540, 1301), "PLAN CONFIRMADO  ✓", font(23, bold=True), PAPER)
    return layer


def scene_final(local: float) -> Image.Image:
    layer = Image.new("RGBA", (W, H), rgba(INK))
    draw = ImageDraw.Draw(layer)
    for i in range(14):
        angle = i * 0.72 + local * 0.14
        radius = 240 + (i % 5) * 105
        x = W / 2 + math.cos(angle) * radius
        y = 850 + math.sin(angle) * radius * 1.2
        r = 6 + i % 4 * 4
        draw.ellipse((x - r, y - r, x + r, y + r), fill=rgba(LIME if i % 3 else BLUE, 140))
    text_center(draw, (W // 2, 235), "Junt", font(184, display=True, bold=True), LIME)
    draw.ellipse((705, 390, 750, 435), fill=ORANGE)
    text_center(draw, (W // 2, 565), "DESCUBRE EL PLAN.\nJUNTA EL CORO.", font(76, display=True, bold=True), PAPER, spacing=8)
    shadow_card(layer, (150, 940, 930, 1280), 42, LIME)
    text_center(draw, (W // 2, 995), "EVENTOS · CINE · PLANES", font(22, bold=True), OLIVE)
    text_center(draw, (W // 2, 1060), "¿Pa’ dónde vamos?", font(50, display=True, bold=True), INK)
    draw.rounded_rectangle((255, 1175, 825, 1245), radius=25, fill=INK)
    text_center(draw, (W // 2, 1196), "DESCUBRIR EN JUNT", font(20, bold=True), PAPER)
    text_center(draw, (W // 2, 1340), "Disponible en web", font(22, bold=True), LIME)
    text_center(draw, (W // 2, 1390), "Locución generada con IA", font(18), "#aebbb3")
    return layer


SCENES = [scene_hook, scene_recommendations, scene_filters, scene_detail, scene_plan, scene_final]


def active_segment(t: float):
    voice_t = t - VOICE_DELAY
    for i, (start, end, text) in enumerate(SEGMENTS):
        if start - 0.05 <= voice_t <= end + 0.10:
            return i, text
    return None


def draw_subtitle(layer: Image.Image, t: float):
    active = active_segment(t)
    if active is None:
        return
    idx, text = active
    draw = ImageDraw.Draw(layer)
    y = 1580 if idx < 5 else 1490
    h = 250
    fill = (10, 27, 18, 242) if idx != 0 else (198, 255, 74, 245)
    text_color = PAPER if idx != 0 else INK
    draw.rounded_rectangle((52, y, W - 52, y + h), radius=38, fill=fill)
    fnt = font(27 if idx == 2 else 30, bold=True)
    lines = text.split("\n")
    line_h = 47
    top = y + (h - len(lines) * line_h) / 2
    for line_idx, line in enumerate(lines):
        box = draw.textbbox((0, 0), line, font=fnt)
        draw.text(((W - (box[2] - box[0])) / 2, top + line_idx * line_h), line, font=fnt, fill=text_color)
    for bar in range(4):
        bh = 10 + int(12 * abs(math.sin(t * 9 + bar)))
        x = W - 102 + bar * 9
        draw.rounded_rectangle((x, y + 27 - bh / 2, x + 5, y + 27 + bh / 2), radius=2, fill=ORANGE if idx == 0 else LIME)


def scene_state(t: float):
    voice_t = t - VOICE_DELAY
    half = 0.17
    for next_idx in range(1, len(SEGMENTS)):
        boundary = SEGMENTS[next_idx][0]
        if voice_t < boundary - half:
            return next_idx - 1, None, 0.0
        if voice_t <= boundary + half:
            return next_idx - 1, next_idx, ease((voice_t - boundary + half) / (half * 2))
    return len(SEGMENTS) - 1, None, 0.0


def render_frame(frame_number: int) -> Image.Image:
    t = frame_number / FPS
    first, second, progress = scene_state(t)
    local_first = max(0.0, t - VOICE_DELAY - SEGMENTS[first][0])
    layer = SCENES[first](local_first)
    if second is not None:
        local_second = max(0.0, t - VOICE_DELAY - SEGMENTS[second][0])
        incoming = SCENES[second](local_second)
        mask = Image.new("L", (W, H), 0)
        md = ImageDraw.Draw(mask)
        edge = int((W + 430) * progress) - 430
        md.polygon(((0, 0), (edge, 0), (edge + 430, H), (0, H)), fill=255)
        layer = Image.composite(incoming, layer, mask)
        stripe = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        ImageDraw.Draw(stripe).polygon(((edge - 16, 0), (edge + 16, 0), (edge + 446, H), (edge + 414, H)), fill=rgba(LIME, 210))
        layer.alpha_composite(stripe)
    draw_subtitle(layer, t)
    return layer.convert("RGB")


def create_music(path: Path):
    sample_rate = 48_000
    total = int(DURATION * sample_rate)
    timeline = np.arange(total) / sample_rate
    audio = np.zeros(total, dtype=np.float64)
    bpm = 116
    beat = 60 / bpm
    notes = [130.81, 164.81, 196.00, 246.94, 196.00, 164.81]
    for n, start in enumerate(np.arange(0, DURATION, beat / 2)):
        idx = int(start * sample_rate)
        length = min(int(0.20 * sample_rate), total - idx)
        tt = np.arange(length) / sample_rate
        freq = notes[n % len(notes)]
        audio[idx:idx + length] += 0.055 * np.sin(2 * np.pi * freq * tt) * np.exp(-tt * 14)
    rng = np.random.default_rng(17)
    for n, start in enumerate(np.arange(0, DURATION, beat)):
        idx = int(start * sample_rate)
        length = min(int(0.13 * sample_rate), total - idx)
        tt = np.arange(length) / sample_rate
        audio[idx:idx + length] += 0.16 * np.sin(2 * np.pi * (78 - 40 * tt) * tt) * np.exp(-tt * 24)
        if n % 2:
            clap = min(int(0.06 * sample_rate), total - idx)
            audio[idx:idx + clap] += 0.028 * rng.normal(0, 1, clap) * np.exp(-np.arange(clap) / sample_rate * 42)
    envelope = np.minimum(1, timeline / 0.65) * np.minimum(1, (DURATION - timeline) / 1.1)
    pcm = (np.tanh(audio * 1.45) * envelope * 32767 * 0.82).astype(np.int16)
    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(sample_rate)
        wav.writeframes(pcm.tobytes())


def main():
    if not VOICE.exists() or not VOICE_TIMINGS.exists():
        raise SystemExit("Ejecuta primero: python3 promo/generate_recommendations_voice.py")
    music = ASSETS / ".recommendations-music.wav"
    create_music(music)
    command = [
        "ffmpeg", "-y", "-loglevel", "error",
        "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
        "-i", str(music), "-i", str(VOICE),
        "-filter_complex",
        f"[1:a]volume=0.17[m];[2:a]adelay={int(VOICE_DELAY * 1000)}|{int(VOICE_DELAY * 1000)},volume=1.35[v];"
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
    music.unlink(missing_ok=True)
    if status:
        sys.exit(status)
    print(f"Video creado: {OUTPUT}")


if __name__ == "__main__":
    main()
