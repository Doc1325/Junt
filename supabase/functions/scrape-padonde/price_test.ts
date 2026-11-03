import assert from "node:assert/strict";
import test from "node:test";

import { inferPaidPriceFromText, mapPrice, resolveEventPrice } from "./price.ts";

test("detecta consumo mínimo con monto aunque el origen diga Gratis", () => {
  const description = "Entrada: Reserva gratuita por tix.do. CONSUMO MÍNIMO EN EL LOCAL DE 1,000 PESOS";
  assert.equal(inferPaidPriceFromText(description), "Consumo mínimo RD$1,000");
  assert.equal(resolveEventPrice({ ldPrice: "Gratis", rscPrice: "Gratis", mainBadges: ["Música", "Gratis"], description }), "Consumo mínimo RD$1,000");
});

test("detecta consumo mínimo expresado en miles", () => {
  assert.equal(inferPaidPriceFromText("CONSUMO MÍNIMO DE 1 MIL PESOS"), "Consumo mínimo RD$1,000");
});

test("un badge de pago prevalece sobre fuentes estructuradas marcadas Gratis", () => {
  assert.equal(resolveEventPrice({ ldPrice: "Gratis", rscPrice: "Gratis", mainBadges: ["Comedia", "Hasta RD$3,000"] }), "Hasta RD$3,000");
});

test("conserva Gratis cuando no existe evidencia contradictoria", () => {
  assert.equal(resolveEventPrice({ ldPrice: "Gratis", mainBadges: ["Teatro", "Gratis"], description: "Actividad abierta al público." }), "Gratis");
  assert.deepEqual(mapPrice("Gratis"), { priceTag: "Gratis", priceText: "Gratis" });
});

test("clasifica cover y boletas como De pago", () => {
  assert.deepEqual(mapPrice("Cover RD$1,500"), { priceTag: "De pago", priceText: "Cover RD$1,500" });
  assert.equal(resolveEventPrice({ ldPrice: "Gratis", description: "Boletas RD$2,500 en preventa" }), "RD$2,500");
});

test("un cero de JSON-LD sigue siendo precio desconocido, no Gratis", () => {
  assert.equal(resolveEventPrice({ ldPrice: 0 }), "De pago");
  assert.deepEqual(mapPrice("De pago"), { priceTag: "De pago", priceText: null });
});
