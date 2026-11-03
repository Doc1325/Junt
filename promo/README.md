# Video promocional de JuntApp

Pieza vertical de 24 segundos pensada para Reels, TikTok y Stories.

## Mensaje

**Menos mensajes. Más planes.** El video presenta el recorrido social actual:

1. El caos de decidir por chat.
2. Crear un grupo e invitar mediante un enlace privado.
3. Proponer opciones y votar.
4. Confirmar asistencia y compartir.
5. Entrar a una sala virtual con LiveKit.

La pieza no menciona recomendaciones por ubicación, ya que esa funcionalidad no forma parte del enfoque actual. La tarjeta de invitación tampoco revela los eventos del grupo antes de que la persona se una.

## Regenerar

```bash
python3 promo/render_promo.py
```

Requiere Python 3, Pillow, NumPy y ffmpeg. El resultado se guarda como `promo/juntapp-promo-vertical.mp4`.

## Versión con presentadora

La segunda pieza incorpora una presentadora ilustrada, locución y subtítulos. La marca aparece escrita como **Junt** y se pronuncia “Junte”.

```bash
cp promo/.env.tts.example promo/.env.tts.local
# Añade la clave únicamente en promo/.env.tts.local
python3 promo/generate_openai_voice.py
python3 promo/render_presenter_promo.py
```

`promo/.env.tts.local` está cubierto por `*.local` en `.gitignore`, por lo que la clave no se añade al repositorio. También se puede utilizar `OPENAI_API_KEY` desde el entorno. El generador usa `gpt-4o-mini-tts`, la voz `marin` y dirección de voz dominicana natural. El guion editable está en `promo/presenter-script.txt` y el resultado se guarda como `promo/junt-presenter-promo-vertical.mp4`.

La pieza incluye la indicación **“Locución generada con IA”**, necesaria para comunicar claramente que la voz no es humana.

### Variante masculina

```bash
python3 promo/generate_openai_voice.py --variant male --male-voice cedar
python3 promo/render_male_presenter_promo.py
```

Esta variante usa un avatar masculino independiente. La versión activa es la cuarta prueba y vuelve a usar `cedar`. Su locución recibe el texto fonético “jarto”, mientras el subtítulo visible conserva la ortografía “harto”. El render se guarda como `promo/junt-presenter-male-promo-vertical.mp4` y la copia estable como `promo/junt-presenter-male-cedar-v2-promo-vertical.mp4`.

Las cuatro pruebas masculinas quedan conservadas para comparación:

- `promo/junt-presenter-male-cedar-promo-vertical.mp4`
- `promo/junt-presenter-male-verse-promo-vertical.mp4`
- `promo/junt-presenter-male-onyx-promo-vertical.mp4`
- `promo/junt-presenter-male-cedar-v2-promo-vertical.mp4`

## Video de recomendaciones

Pieza alternativa sin presentador, centrada en la función **¿Pa dónde vamos?**. Muestra recomendaciones de eventos y películas, filtros por ciudad, presupuesto, tipo y categoría, el detalle del evento y su conversión en un plan para el grupo.

```bash
python3 promo/generate_recommendations_voice.py
python3 promo/generate_recommendations_voice.py --retime-existing
python3 promo/render_recommendations_promo.py
```

La locución usa `gpt-4o-mini-tts` con `cedar`. El resultado se guarda como `promo/junt-recommendations-promo-vertical.mp4`.

## Video combinado: descubrir y organizar

Esta pieza conecta ambos recorridos: descubrir eventos o películas, revisar sus datos, convertir una recomendación en plan y coordinar votación, asistencia, WhatsApp o sala virtual.

```bash
python3 promo/generate_combo_voice.py
python3 promo/generate_combo_voice.py --retime-existing
python3 promo/render_combo_promo.py
python3 promo/render_combo_promo.py --no-subtitles
python3 promo/generate_combo_voice.py --voice marin
python3 promo/generate_combo_voice.py --voice marin --retime-existing
python3 promo/render_combo_promo.py --voice marin --no-subtitles
python3 promo/render_combo_promo.py --voice cedar --no-avatar --no-subtitles
python3 promo/render_combo_promo.py --voice onyx --no-avatar --no-subtitles
python3 promo/render_combo_promo.py --voice marin --no-avatar --no-subtitles
```

Usa la voz `cedar`, combina la interfaz de recomendaciones con el avatar masculino y se guarda como `promo/junt-discover-and-organize-promo-vertical.mp4`. La variante sin subtítulos visibles se guarda como `promo/junt-discover-and-organize-no-subtitles-promo-vertical.mp4`.

La alternativa con voz `marin`, también sin subtítulos, se guarda como `promo/junt-discover-and-organize-marin-no-subtitles-promo-vertical.mp4`.

Las variantes `cedar`, `onyx` y `marin` con `--no-avatar --no-subtitles` eliminan al presentador, reorganizan la apertura como portada funcional y conservan únicamente la voz, la música y las animaciones del producto.
