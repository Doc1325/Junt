#!/usr/bin/env python3
"""Renderiza el video promocional vertical de JuntApp.

No requiere recursos externos: dibuja la UI con Pillow, compone una pista
musical original con NumPy y codifica el resultado con ffmpeg.
"""

from __future__ import annotations

import math
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "promo"
OUTPUT = OUT_DIR / "juntapp-promo-vertical.mp4"
W, H = 1080, 1920
FPS = 30
DURATION = 24

INK = "#18261f"
OLIVE = "#28533a"
OLIVE_DARK = "#163626"
LIME = "#d8ff62"
PAPER = "#f6f5f0"
WHITE = "#fffdf7"
MUTED = "#69746d"
LINE = "#d9ddd4"
ORANGE = "#ff8a5b"
BLUE = "#75a7ff"

FONT_SANS = "/System/Library/Fonts/Avenir Next.ttc"
FONT_DISPLAY = "/System/Library/Fonts/Supplemental/Georgia.ttf"
FONT_DISPLAY_BOLD = "/System/Library/Fonts/Supplemental/Georgia Bold.ttf"


def font(size: int, display: bool = False, bold: bool = False) -> ImageFont.FreeTypeFont:
    path = FONT_DISPLAY_BOLD if display and bold else FONT_DISPLAY if display else FONT_SANS
    return ImageFont.truetype(path, size=size, index=0)


def clamp(value: float, low: float = 0, high: float = 1) -> float:
    return max(low, min(high, value))


def ease(value: float) -> float:
    value = clamp(value)
    return 1 - (1 - value) ** 3


def ease_in_out(value: float) -> float:
    value = clamp(value)
    return value * value * (3 - 2 * value)


def scene_progress(t: float, start: float, end: float) -> float:
    return clamp((t - start) / (end - start))


def alpha_at(t: float, start: float, end: float, fade: float = 0.35) -> float:
    return min(ease((t - start) / fade), ease((end - t) / fade))


def rgba(hex_color: str, alpha: int = 255) -> tuple[int, int, int, int]:
    color = hex_color.lstrip("#")
    return tuple(int(color[i : i + 2], 16) for i in (0, 2, 4)) + (alpha,)


def text_center(draw: ImageDraw.ImageDraw, y: float, text: str, fnt, fill, spacing=8):
    box = draw.multiline_textbbox((0, 0), text, font=fnt, spacing=spacing, align="center")
    width = box[2] - box[0]
    draw.multiline_text(((W - width) / 2, y), text, font=fnt, fill=fill, spacing=spacing, align="center")


def pill(draw, xy, fill, outline=None, width=2, radius=999):
    draw.rounded_rectangle(xy, radius=radius, fill=fill, outline=outline, width=width)


def paste_alpha(base: Image.Image, layer: Image.Image, alpha: float = 1):
    if alpha < 1:
        layer = layer.copy()
        layer.putalpha(layer.getchannel("A").point(lambda v: int(v * alpha)))
    base.alpha_composite(layer)


def draw_logo(layer: Image.Image, center: tuple[int, int], size: int, dark=False):
    draw = ImageDraw.Draw(layer)
    x, y = center
    fill = PAPER if dark else INK
    dot = LIME
    fnt = font(int(size * 0.40), display=True, bold=True)
    word = "junt"
    box = draw.textbbox((0, 0), word, font=fnt)
    tw = box[2] - box[0]
    draw.text((x - tw / 2 - size * 0.03, y - size * 0.26), word, font=fnt, fill=fill)
    r = int(size * 0.055)
    draw.ellipse((x + tw / 2 - r, y + size * 0.08 - r, x + tw / 2 + r, y + size * 0.08 + r), fill=dot)


def phone_frame(layer: Image.Image, x: int, y: int, w: int, h: int, title: str, subtitle: str = ""):
    draw = ImageDraw.Draw(layer)
    shadow = Image.new("RGBA", layer.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle((x + 12, y + 24, x + w + 12, y + h + 24), radius=54, fill=(12, 26, 18, 65))
    shadow = shadow.filter(ImageFilter.GaussianBlur(22))
    layer.alpha_composite(shadow)
    draw.rounded_rectangle((x, y, x + w, y + h), radius=54, fill=WHITE, outline=INK, width=5)
    draw.rounded_rectangle((x + w * 0.37, y + 18, x + w * 0.63, y + 38), radius=10, fill=INK)
    draw.text((x + 48, y + 78), title, font=font(42, display=True, bold=True), fill=INK)
    if subtitle:
        draw.text((x + 48, y + 134), subtitle, font=font(23), fill=MUTED)
    return draw


def chat_bubble(layer, x, y, width, message, color, delay, local_t, right=False):
    p = ease((local_t - delay) / 0.45)
    if p <= 0:
        return
    y += int((1 - p) * 70)
    bubble = Image.new("RGBA", layer.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(bubble)
    h = 120
    bx = x + (1 - p) * (100 if right else -100)
    draw.rounded_rectangle((bx, y, bx + width, y + h), radius=42, fill=rgba(color, int(255 * p)))
    draw.text((bx + 34, y + 35), message, font=font(30), fill=rgba(INK, int(255 * p)))
    paste_alpha(layer, bubble, p)


def scene_hook(t: float) -> Image.Image:
    layer = Image.new("RGBA", (W, H), rgba(PAPER))
    draw = ImageDraw.Draw(layer)
    local = scene_progress(t, 0, 3.2) * 3.2
    alpha = alpha_at(t, 0, 3.2)
    text_center(draw, 145, "¿Otra vez 200 mensajes\npara decidir?", font(74, display=True, bold=True), INK, 10)
    chat_bubble(layer, 95, 475, 570, "¿Qué hacemos el viernes?", "#ffffff", 0.10, local)
    chat_bubble(layer, 345, 635, 640, "Yo puedo... pero después de las 9", LIME, 0.45, local, True)
    chat_bubble(layer, 95, 795, 540, "¿Cena o algo tranqui?", "#ffffff", 0.82, local)
    chat_bubble(layer, 395, 955, 590, "Hagamos otra encuesta...", "#cfe5d8", 1.18, local, True)
    count = min(47, int(max(0, local - 1.15) * 38))
    pill(draw, (320, 1285, 760, 1380), fill=INK)
    label = f"{count} mensajes después…"
    box = draw.textbbox((0, 0), label, font=font(29))
    draw.text(((W - (box[2] - box[0])) / 2, 1313), label, font=font(29), fill=PAPER)
    draw.line((W / 2, 1518, W / 2, 1585), fill=OLIVE, width=9)
    draw.line((W / 2 - 22, 1560, W / 2, 1585, W / 2 + 22, 1560), fill=OLIVE, width=9, joint="curve")
    layer.putalpha(int(255 * alpha))
    return layer


def scene_brand(t: float) -> Image.Image:
    layer = Image.new("RGBA", (W, H), rgba(OLIVE_DARK))
    draw = ImageDraw.Draw(layer)
    p = scene_progress(t, 3.2, 5.8)
    alpha = alpha_at(t, 3.2, 5.8)
    # Halo vivo detrás de la marca.
    halo = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    hd = ImageDraw.Draw(halo)
    radius = int(230 + 30 * math.sin(p * math.pi))
    hd.ellipse((W / 2 - radius, 480 - radius, W / 2 + radius, 480 + radius), fill=rgba(LIME, 42))
    halo = halo.filter(ImageFilter.GaussianBlur(70))
    layer.alpha_composite(halo)
    scale = 0.78 + 0.22 * ease(p / 0.45)
    draw_logo(layer, (W // 2, 500), int(680 * scale), dark=True)
    text_center(draw, 800, "El plan sale.\nEl chat descansa.", font(77, display=True, bold=True), PAPER, 15)
    pill(draw, (315, 1110, 765, 1205), fill=LIME)
    text_center(draw, 1132, "TODO EN UN SOLO LUGAR", font(24), INK)
    # Pequeños avatares para reforzar la idea de grupo.
    for i, color in enumerate((ORANGE, BLUE, LIME, "#f5c6df")):
        cx = 405 + i * 90
        draw.ellipse((cx - 38, 1370 - 38, cx + 38, 1370 + 38), fill=color, outline=PAPER, width=5)
        draw.ellipse((cx - 11, 1348, cx + 11, 1370), fill=INK)
        draw.arc((cx - 22, 1362, cx + 22, 1400), 180, 360, fill=INK, width=8)
    layer.putalpha(int(255 * alpha))
    return layer


def scene_invite(t: float) -> Image.Image:
    layer = Image.new("RGBA", (W, H), rgba(LIME))
    draw = ImageDraw.Draw(layer)
    local = (t - 5.8)
    alpha = alpha_at(t, 5.8, 9.2)
    text_center(draw, 90, "Crea el grupo.", font(76, display=True, bold=True), INK)
    text_center(draw, 188, "Invita con un enlace privado.", font(32), OLIVE)
    phone_y = int(350 + (1 - ease(local / 0.65)) * 150)
    x, y, w, h = 155, phone_y, 770, 1250
    pd = phone_frame(layer, x, y, w, h, "Invitar amigos", "Solo verán los planes al unirse")
    pd.rounded_rectangle((x + 48, y + 220, x + w - 48, y + 520), radius=32, fill=PAPER, outline=LINE, width=3)
    pd.text((x + 82, y + 265), "PLAN DE PANAS", font=font(22), fill=MUTED)
    pd.text((x + 82, y + 315), "Únete al grupo", font=font(48, display=True, bold=True), fill=INK)
    pd.text((x + 82, y + 395), "Inicia sesión para aceptar la invitación.", font=font(23), fill=MUTED)
    pd.rounded_rectangle((x + 48, y + 575, x + w - 48, y + 680), radius=30, fill=OLIVE)
    pd.text((x + 185, y + 605), "Copiar enlace", font=font(30), fill=PAPER)
    pd.rounded_rectangle((x + 48, y + 715, x + w - 48, y + 820), radius=30, fill="#25d366")
    pd.text((x + 145, y + 745), "Compartir por WhatsApp", font=font(27), fill=INK)
    # Pulso del toque.
    if local > 1.7:
        pulse = (local - 1.7) % 1.2
        r = int(18 + pulse * 55)
        a = int(130 * (1 - min(1, pulse)))
        cx, cy = x + w - 105, y + 630
        pd.ellipse((cx - r, cy - r, cx + r, cy + r), outline=rgba(INK, a), width=7)
    layer.putalpha(int(255 * alpha))
    return layer


def scene_vote(t: float) -> Image.Image:
    layer = Image.new("RGBA", (W, H), rgba(PAPER))
    draw = ImageDraw.Draw(layer)
    local = t - 9.2
    alpha = alpha_at(t, 9.2, 13.0)
    text_center(draw, 82, "Propón. Voten. Decidan.", font(67, display=True, bold=True), INK)
    text_center(draw, 178, "Sin perseguir respuestas por el chat.", font(31), MUTED)
    x, y, w, h = 135, 320, 810, 1330
    pd = phone_frame(layer, x, y, w, h, "Cena del viernes", "Viernes · 8:30 p. m.")
    options = [
        ("Pizza y juegos", 0.82, "5 votos"),
        ("Tacos", 0.58, "3 votos"),
        ("Algo en casa", 0.34, "2 votos"),
    ]
    for idx, (label, target, votes) in enumerate(options):
        oy = y + 245 + idx * 220
        pd.rounded_rectangle((x + 46, oy, x + w - 46, oy + 178), radius=28, fill="#ffffff", outline=LINE, width=3)
        pd.text((x + 78, oy + 32), label, font=font(31), fill=INK)
        pd.text((x + w - 175, oy + 39), votes, font=font(22), fill=MUTED)
        pd.rounded_rectangle((x + 78, oy + 105, x + w - 78, oy + 127), radius=11, fill=LINE)
        fill_p = ease((local - 0.55 - idx * 0.25) / 0.65)
        pd.rounded_rectangle((x + 78, oy + 105, x + 78 + int((w - 156) * target * fill_p), oy + 127), radius=11, fill=OLIVE)
        if idx == 0 and local > 1.35:
            pd.ellipse((x + w - 105, oy + 42, x + w - 65, oy + 82), fill=LIME, outline=INK, width=2)
            pd.text((x + w - 98, oy + 39), "✓", font=font(28), fill=INK)
    pd.rounded_rectangle((x + 46, y + 970, x + w - 46, y + 1078), radius=30, fill=INK)
    pd.text((x + 220, y + 1001), "Confirmar opción", font=font(29), fill=PAPER)
    pill(draw, (319, 1720, 761, 1810), fill=LIME, outline=INK, width=3)
    text_center(draw, 1743, "VOTA MÁS DE UNA OPCIÓN", font(22), INK)
    layer.putalpha(int(255 * alpha))
    return layer


def scene_attendance(t: float) -> Image.Image:
    layer = Image.new("RGBA", (W, H), rgba(OLIVE_DARK))
    draw = ImageDraw.Draw(layer)
    local = t - 13.0
    alpha = alpha_at(t, 13.0, 16.6)
    text_center(draw, 95, "¿Quién se apunta?", font(77, display=True, bold=True), PAPER)
    text_center(draw, 198, "Confirmen asistencia y compartan el resultado.", font(30), "#cfe0d4")
    x, y, w, h = 140, 345, 800, 1225
    pd = phone_frame(layer, x, y, w, h, "Asistencia", "4 personas respondieron")
    statuses = [
        ("Lia", "Voy", LIME),
        ("Mario", "Voy", LIME),
        ("Ana", "Tal vez", "#ffd166"),
        ("Joel", "Voy", LIME),
    ]
    for idx, (name, status, color) in enumerate(statuses):
        oy = y + 230 + idx * 150
        reveal = ease((local - 0.3 - idx * 0.18) / 0.5)
        pd.ellipse((x + 55, oy, x + 135, oy + 80), fill=color)
        pd.text((x + 81, oy + 20), name[0], font=font(29), fill=INK)
        pd.text((x + 165, oy + 8), name, font=font(30), fill=INK)
        pd.rounded_rectangle((x + w - 230, oy + 7, x + w - 55, oy + 70), radius=28, fill=rgba(color, int(255 * reveal)))
        pd.text((x + w - 190, oy + 23), status, font=font(22), fill=INK)
    pd.line((x + 55, y + 870, x + w - 55, y + 870), fill=LINE, width=3)
    pd.text((x + 55, y + 920), "TU RESPUESTA", font=font(21), fill=MUTED)
    labels = [("Voy", LIME), ("Tal vez", "#fff1c6"), ("No voy", "#f0ebe4")]
    for idx, (label, color) in enumerate(labels):
        bx = x + 55 + idx * 225
        pd.rounded_rectangle((bx, y + 970, bx + 195, y + 1050), radius=26, fill=color, outline=INK if idx == 0 else LINE, width=3)
        pd.text((bx + 49, y + 994), label, font=font(22), fill=INK)
    pd.rounded_rectangle((x + 55, y + 1090, x + w - 55, y + 1175), radius=28, fill="#25d366")
    pd.text((x + 205, y + 1114), "Compartir plan", font=font(26), fill=INK)
    layer.putalpha(int(255 * alpha))
    return layer


def scene_live(t: float) -> Image.Image:
    layer = Image.new("RGBA", (W, H), rgba("#e9eefc"))
    draw = ImageDraw.Draw(layer)
    local = t - 16.6
    alpha = alpha_at(t, 16.6, 20.4)
    text_center(draw, 80, "¿El plan es virtual?", font(70, display=True, bold=True), INK)
    text_center(draw, 180, "Entren juntos desde JuntApp.", font(32), OLIVE)
    x, y, w, h = 125, 320, 830, 1330
    pd = phone_frame(layer, x, y, w, h, "Noche de juegos", "Sala en vivo · LiveKit")
    colors = ["#ffb38a", "#8fb7ff", "#b9e39c", "#efb9d5"]
    names = ["Lia", "Mario", "Ana", "Joel"]
    for idx in range(4):
        col, row = idx % 2, idx // 2
        bx = x + 48 + col * 365
        by = y + 220 + row * 355
        pd.rounded_rectangle((bx, by, bx + 330, by + 315), radius=28, fill=colors[idx])
        bounce = int(math.sin(local * 3 + idx) * 8)
        pd.ellipse((bx + 118, by + 65 + bounce, bx + 212, by + 159 + bounce), fill=INK)
        pd.arc((bx + 85, by + 142 + bounce, bx + 245, by + 275 + bounce), 180, 360, fill=INK, width=30)
        pd.rounded_rectangle((bx + 18, by + 255, bx + 100, by + 294), radius=18, fill=rgba(INK, 200))
        pd.text((bx + 34, by + 266), names[idx], font=font(18), fill=PAPER)
    # Controles de llamada.
    for idx in range(3):
        cx = x + 260 + idx * 155
        color = "#ffffff" if idx < 2 else "#ff6b6b"
        pd.ellipse((cx - 48, y + 1020, cx + 48, y + 1116), fill=color, outline=LINE, width=2)
        if idx == 0:
            pd.ellipse((cx - 14, y + 1052, cx + 14, y + 1080), fill=INK)
        elif idx == 1:
            pd.rounded_rectangle((cx - 18, y + 1048, cx + 18, y + 1083), radius=8, fill=INK)
            pd.polygon(((cx + 18, y + 1056), (cx + 34, y + 1047), (cx + 34, y + 1084), (cx + 18, y + 1075)), fill=INK)
        else:
            pd.line((cx - 15, y + 1052, cx + 15, y + 1083), fill=INK, width=8)
            pd.line((cx + 15, y + 1052, cx - 15, y + 1083), fill=INK, width=8)
    pill(draw, (405, 1710, 675, 1795), fill=OLIVE)
    text_center(draw, 1732, "EN VIVO", font(23), PAPER)
    layer.putalpha(int(255 * alpha))
    return layer


def scene_finale(t: float) -> Image.Image:
    layer = Image.new("RGBA", (W, H), rgba(LIME))
    draw = ImageDraw.Draw(layer)
    p = scene_progress(t, 20.4, 24.0)
    alpha = alpha_at(t, 20.4, 24.0, fade=0.42)
    for i, color in enumerate((ORANGE, BLUE, OLIVE, "#f3b8d4")):
        angle = p * 2 * math.pi + i * math.pi / 2
        cx = W / 2 + math.cos(angle) * (330 + i * 15)
        cy = 535 + math.sin(angle) * (220 + i * 20)
        draw.ellipse((cx - 48, cy - 48, cx + 48, cy + 48), fill=color, outline=INK, width=3)
    draw_logo(layer, (W // 2, 500), 780, dark=False)
    text_center(draw, 850, "Menos mensajes.\nMás planes.", font(86, display=True, bold=True), INK, 14)
    text_center(draw, 1100, "Grupos, votos, asistencia y salas en vivo.", font(30), OLIVE)
    pill(draw, (225, 1265, 855, 1385), fill=INK)
    text_center(draw, 1300, "CREA EL PRÓXIMO EN JUNTAPP", font(25), PAPER)
    text_center(draw, 1550, "Disponible en web", font(25), OLIVE)
    layer.putalpha(int(255 * alpha))
    return layer


def render_frame(t: float) -> Image.Image:
    # Fondo base evita transparencias al codificar.
    base = Image.new("RGBA", (W, H), rgba(PAPER))
    scenes = (
        (0.0, 3.2, scene_hook),
        (3.2, 5.8, scene_brand),
        (5.8, 9.2, scene_invite),
        (9.2, 13.0, scene_vote),
        (13.0, 16.6, scene_attendance),
        (16.6, 20.4, scene_live),
        (20.4, 24.0, scene_finale),
    )
    for start, end, renderer in scenes:
        if start - 0.5 <= t <= end + 0.5:
            base.alpha_composite(renderer(t))
    return base.convert("RGB")


def create_music(path: Path):
    sample_rate = 48_000
    total = DURATION * sample_rate
    timeline = np.arange(total) / sample_rate
    audio = np.zeros(total, dtype=np.float64)
    bpm = 110
    beat = 60 / bpm

    # Progresión original, cálida y ligera: C - Am - F - G.
    chords = [
        (130.81, 164.81, 196.00),
        (110.00, 130.81, 164.81),
        (87.31, 110.00, 130.81),
        (98.00, 123.47, 146.83),
    ]
    chord_len = beat * 4
    for start in np.arange(0, DURATION, chord_len):
        chord = chords[int(start / chord_len) % len(chords)]
        mask = (timeline >= start) & (timeline < min(DURATION, start + chord_len))
        tt = timeline[mask] - start
        fade = np.minimum(1, tt / 0.18) * np.minimum(1, (chord_len - tt) / 0.22)
        for frequency in chord:
            audio[mask] += 0.055 * np.sin(2 * np.pi * frequency * tt) * fade
            audio[mask] += 0.018 * np.sin(2 * np.pi * frequency * 2 * tt) * fade

    # Bajo, kick, palmada y hi-hat.
    rng = np.random.default_rng(42)
    for n, start in enumerate(np.arange(0, DURATION, beat)):
        idx = int(start * sample_rate)
        length = min(int(0.22 * sample_rate), total - idx)
        tt = np.arange(length) / sample_rate
        kick = np.sin(2 * np.pi * (72 - 38 * tt) * tt) * np.exp(-tt * 18)
        audio[idx : idx + length] += 0.22 * kick
        if n % 2 == 1:
            length_s = min(int(0.12 * sample_rate), total - idx)
            noise = rng.normal(0, 1, length_s) * np.exp(-np.arange(length_s) / sample_rate * 32)
            audio[idx : idx + length_s] += 0.055 * noise
        # Bajo en cada pulso.
        root = chords[(n // 4) % len(chords)][0] / 2
        bass = np.sin(2 * np.pi * root * tt) * np.exp(-tt * 5)
        audio[idx : idx + length] += 0.08 * bass

    for start in np.arange(beat / 2, DURATION, beat / 2):
        idx = int(start * sample_rate)
        length = min(int(0.055 * sample_rate), total - idx)
        noise = rng.normal(0, 1, length) * np.exp(-np.arange(length) / sample_rate * 70)
        audio[idx : idx + length] += 0.025 * noise

    # Entrada y salida limpias, con limitador suave.
    envelope = np.minimum(1, timeline / 0.7) * np.minimum(1, (DURATION - timeline) / 1.1)
    audio = np.tanh(audio * 1.4) * envelope
    pcm = (audio * 32767 * 0.88).astype(np.int16)
    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(sample_rate)
        wav.writeframes(pcm.tobytes())


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    audio_path = OUT_DIR / ".juntapp-promo-audio.wav"
    create_music(audio_path)
    command = [
        "ffmpeg",
        "-y",
        "-loglevel",
        "error",
        "-f",
        "rawvideo",
        "-pix_fmt",
        "rgb24",
        "-s",
        f"{W}x{H}",
        "-r",
        str(FPS),
        "-i",
        "-",
        "-i",
        str(audio_path),
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-crf",
        "18",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        "160k",
        "-movflags",
        "+faststart",
        "-shortest",
        str(OUTPUT),
    ]
    process = subprocess.Popen(command, stdin=subprocess.PIPE)
    assert process.stdin is not None
    try:
        for frame_number in range(DURATION * FPS):
            frame = render_frame(frame_number / FPS)
            process.stdin.write(frame.tobytes())
            if frame_number % FPS == 0:
                print(f"Renderizando {frame_number // FPS:02d}/{DURATION}s", flush=True)
    except BrokenPipeError:
        process.wait()
        sys.exit(process.returncode or 1)
    finally:
        process.stdin.close()
    status = process.wait()
    audio_path.unlink(missing_ok=True)
    if status:
        sys.exit(status)
    print(f"Video creado: {OUTPUT}")


if __name__ == "__main__":
    main()
