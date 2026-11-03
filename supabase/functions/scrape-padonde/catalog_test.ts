import assert from "node:assert/strict";
import test from "node:test";

import { isRelevantEventSlug } from "./catalog.ts";

const now = new Date("2026-10-11T12:00:00Z");

test("incluye el mes actual, el anterior y meses futuros", () => {
  assert.equal(isRelevantEventSlug("concierto-septiembre-2026", now), true);
  assert.equal(isRelevantEventSlug("concierto-octubre-2026", now), true);
  assert.equal(isRelevantEventSlug("concierto-enero-2027", now), true);
});

test("descarta slugs históricos con mes y año", () => {
  assert.equal(isRelevantEventSlug("concierto-agosto-2026", now), false);
  assert.equal(isRelevantEventSlug("concierto-julio-2025", now), false);
});

test("conserva slugs sin fecha para validarlos desde el detalle", () => {
  assert.equal(isRelevantEventSlug("festival-del-cafe-zona-colonial", now), true);
});
