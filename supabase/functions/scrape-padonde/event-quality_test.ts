import assert from "node:assert/strict";
import test from "node:test";

import { getEventQualityIssue } from "./event-quality.ts";

test("rechaza la página genérica de anuncios de Zona Colonial", () => {
  assert.equal(
    getEventQualityIssue({ more_info_url: "https://zonacolonial.do/actividades/" }),
    "embedded_ad_listing",
  );
  assert.equal(
    getEventQualityIssue({ more_info_url: "https://www.zonacolonial.do/actividades?ref=padonde" }),
    "embedded_ad_listing",
  );
});

test("conserva eventos reales de Zona Colonial", () => {
  assert.equal(
    getEventQualityIssue({ more_info_url: "https://zonacolonial.do/actividad/sade-en-jazz/" }),
    null,
  );
});

test("no bloquea otras fuentes ni URLs ausentes", () => {
  assert.equal(getEventQualityIssue({ more_info_url: "https://uepatickets.com/evento/concierto" }), null);
  assert.equal(getEventQualityIssue({ more_info_url: null }), null);
});
