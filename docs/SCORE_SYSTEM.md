# JuntApp — Sistema de Score de Recomendaciones (100 pts)

Decisiones: ciudad NO puntúa (solo filtra), eventos > cine, Música y Festival priman.

## Pesos

| Dimensión | Max | Reglas |
|---|---|---|
| Categoría | 35 | Exacta +25. Premium: Música +10, Festival +8 (acumulable con exacta). Ej: filtro Música + item Música = 35; filtro Todas + item Música = 10, Festival = 8, resto = 0 |
| Fecha/proximidad | 25 | Hoy +25, decaimiento lineal a 7 días (`25 * (1 - d/7)`), finde (vie–dom) +5, >60d −5. Cap [0,25] |
| Presupuesto | 15 | Gratis+filtro Gratis +15. De pago+filtro De pago +10 + bono barato `max(0, 5 - price/2000)` (parse `RD$2,000`→2000). Si `Cualquiera`: Gratis +5, De pago +0 |
| Calidad | 15 | imagen real (!=N/A) +5, descripción >50 chars +4, `hour_start` +2, `source_url` +1, cine `rating>7.5` +3. Cap 15 |
| Tipo | 10 | Solo si `type=todos`: evento +10, cine +0. Si filtro específico, 0 |
| Ciudad | 0 | Filtro duro (`eq province`), no puntúa |

Total = suma capada a 100. Orden: `score DESC`, desempate `start_date ASC`. Override `?sort=fecha` (fecha ASC) y `?sort=precio` (Gratis primero, luego monto ASC).

## Respuesta

Cada item incluye `score` (0–100) y `scoreBreakdown {category, recency, budget, quality, type}`.

## Ejemplos

- `Todas/todos` → arriba eventos Música/Festival próximos Gratis (Ivy Negro, JAZZ NIGHT); cine abajo salvo rating alto.
- `category=Música` → base 25 + premium 10 empatan; desempata fecha+presupuesto+calidad.
- `J-ROD (Música, De pago, RD$2,000)`: 25+10 (cat) +10+bono~4 (pto) + fecha + calidad +10 (tipo) ≈ 70-85 en `De pago`.
