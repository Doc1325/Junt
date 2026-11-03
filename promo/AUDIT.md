# Auditoría de los videos promocionales

## Variante masculina — resultado final

- Formato: H.264 + AAC, 1080 × 1920, 30 fps.
- Duración: 33.44 segundos.
- Avatar: dos fonemas visuales con identidad, postura y encuadre consistentes.
- Voz: OpenAI `gpt-4o-mini-tts`, voz `cedar`, español dominicano dirigido por prompt.
- Locución: 31.09 segundos, con pausas de 300 ms entre bloques.
- Mezcla final: volumen medio aproximado de −18.9 dB y pico máximo de −0.5 dB.
- Seguridad: la clave se lee desde `promo/.env.tts.local`, ignorado por Git.
- Transparencia: el cierre indica “Locución generada con IA”.

### Iteraciones realizadas

1. La primera toma llevó la frase sobre el junte virtual a unas 202 palabras por minuto. Se regeneró ese bloque a menor velocidad; la versión final quedó cerca de 158 palabras por minuto.
2. El primer render mezcló la variante masculina unos 1.2 dB por debajo de la femenina. Se aumentó únicamente la ganancia de la voz masculina, manteniendo el limitador.
3. Algunos puntos decorativos podían atravesar el titular. Se reservó una zona limpia de 300 px en la parte superior.
4. Se revisaron ocho fotogramas distribuidos por toda la pieza para comprobar legibilidad, encuadre, continuidad del avatar y ausencia de elementos privados en la invitación.
5. Una revisión cuadro a cuadro de los cinco cambios de escena reveló dobles avatares durante el fundido cruzado. Se sustituyó por un desplazamiento horizontal de 360 ms, que conserva nítidos al personaje y los titulares.
6. La locución masculina se aceleró moderadamente: pasó de 35.11 a 32.85 segundos sin aplicar estiramiento de audio posterior.
7. El arranque separaba “Si / tú / ta / harto”. Se cambió el texto fonético, se compactaron únicamente sus silencios internos y se reajustó el tempo preservando la afinación. La versión final no contiene pausas mayores de 160 ms durante el arranque.

El cierre conserva un ritmo más pausado que el cuerpo del anuncio para que la marca y el llamado a la acción tengan tiempo de asentarse.

## Variante masculina `verse`

- Se conservó por separado la versión anterior con `cedar`.
- La pronunciación cambió a “Si tú ta jarto”, con `jarto` escrito también en subtítulos.
- El arranque queda unido, sin pausas detectables mayores de 160 ms, a unas 174 palabras por minuto.
- Se ajustaron individualmente los ritmos de las seis frases y después se aplicó un 6 % uniforme preservando la afinación.
- Locución final: 32.84 segundos. Video final: aproximadamente 35.19 segundos.

## Variante masculina `onyx`

- La tercera versión usa OpenAI `gpt-4o-mini-tts` con la voz `onyx` y conserva por separado las versiones `cedar` y `verse`.
- La entrada se pronuncia como una sola frase: “Si tú ta jarto”, sin silencios internos detectables mayores de 160 ms durante los primeros cinco segundos.
- Se regeneraron de forma independiente el primer y el tercer bloque para evitar cortes artificiales y mantener un ritmo uniforme.
- Ritmo aproximado por bloque: 201, 203, 175, 180, 206 y 127 palabras por minuto. El cierre permanece deliberadamente más pausado.
- Locución final: 30.95 segundos. Video final: 33.30 segundos.
- Mezcla final: volumen medio de −18.8 dB y pico máximo de −0.8 dB.
- Verificación visual: 1080 × 1920 a 30 fps, sin cuadros negros detectados; los cambios de escena mantienen el desplazamiento horizontal de 360 ms.

## Cuarta variante — `cedar` corregida

- Se volvió a `cedar`, manteniendo intacta la primera versión de esa voz.
- La entrada de TTS usa “Si tú ta jarto”, con indicación explícita de jota aspirada dominicana; el subtítulo muestra “Si tú ’tá harto”.
- Se detectaron dos microcortes en una toma intermedia y se regeneró únicamente el primer bloque con compactación más estricta.
- El resultado no contiene silencios detectables de 80 ms o más durante los primeros cinco segundos.
- Ritmo aproximado por bloque: 209, 209, 190, 192, 192 y 115 palabras por minuto. El cierre conserva deliberadamente un ritmo más pausado.
- Locución final: 30.65 segundos. Video final: 33.00 segundos.
- Mezcla final: volumen medio de −18.8 dB y pico máximo de −0.8 dB.
- Verificación visual: subtítulo “harto” confirmado, 1080 × 1920 a 30 fps y sin cuadros negros detectados.

## Video de recomendaciones

- Concepto visual independiente: no utiliza avatar; presenta tarjetas cinéticas, filtros, detalle del evento y conversión a plan.
- Las afirmaciones coinciden con el producto actual: ciudad, presupuesto, tipo y categoría; catálogo de eventos y cine; fecha, lugar, precio y acción “Usar para plan”.
- Locución: OpenAI `gpt-4o-mini-tts`, voz `cedar`, con divulgación visible de voz generada por IA.
- La toma inicial duraba 34.57 segundos y hacía demasiado lenta la lista de categorías. Se reajustó el tempo por bloque preservando la afinación hasta 30.03 segundos de locución.
- Video final: 32.33 segundos, H.264 + AAC, 1080 × 1920 y 30 fps.
- Mezcla final: volumen medio de −19.2 dB y pico máximo de −0.4 dB.
- Verificación visual: nueve fotogramas distribuidos por toda la pieza, subtítulos legibles, transiciones diagonales consistentes y ningún cuadro negro detectado.

## Video combinado — descubrir y organizar

- Recorrido: problema inicial → recomendaciones filtradas → detalle del evento → conversión a plan → votación, asistencia y WhatsApp → sala virtual → cierre de marca.
- Locución: OpenAI `gpt-4o-mini-tts`, voz `cedar`, con divulgación visible de voz generada por IA.
- La primera toma duró 37.89 segundos. Se ajustó el tempo por bloque preservando la afinación hasta 33.83 segundos de locución.
- Ritmo aproximado por bloque: 163, 183, 193, 176, 174 y 150 palabras por minuto.
- La transición inicial superponía fragmentos de titulares. Se sustituyó por una compuerta naranja que cubre una escena antes de revelar la siguiente.
- Revisión solicitada: la locución y los subtítulos dicen “comparten el enlace” sin mencionar una plataforma concreta; el botón ahora dice “Compartir”.
- Se eliminó el círculo naranja situado al inicio de la flecha en la conversión de evento a plan.
- El cierre se rediseñó como una portada crema sin avatar: nombre `Junt` centrado y dominante, resumen de “Descubre” y “Organiza”, llamada a la acción y sin puntos decorativos junto al logotipo.
- Se sustituyeron dos glifos de check incompatibles con la fuente por trazos vectoriales y se sincronizaron literalmente los subtítulos con la locución.
- Video final: 36.09 segundos, H.264 + AAC, 1080 × 1920 y 30 fps.
- Mezcla final: volumen medio de −19.2 dB y pico máximo de −0.4 dB.
- Verificación visual: nueve fotogramas distribuidos por toda la pieza, interfaces legibles y ningún cuadro negro detectado.
- Variante sin subtítulos: conserva la locución y todos los gráficos de interfaz, omite únicamente los bloques de subtítulos y se exporta como `junt-discover-and-organize-no-subtitles-promo-vertical.mp4`.
- Alternativa Marin sin subtítulos: locución reajustada a 34.23 segundos; video de 36.53 segundos, H.264 + AAC, 1080 × 1920 a 30 fps, volumen medio de −18.8 dB, pico de −1.4 dB y sin cuadros negros detectados.
- Trío sin presentador ni subtítulos: Cedar 36.09 s (−19.2 dB, pico −0.4 dB), Onyx 36.58 s (−18.9 dB, pico −0.5 dB) y Marin 36.53 s (−18.8 dB, pico −1.4 dB). Las tres exportaciones son H.264 + AAC, 1080 × 1920 a 30 fps, no contienen pista de subtítulos y no presentan cuadros negros.
