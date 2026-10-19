import assert from "node:assert/strict";
import { test } from "node:test";
import { parseAffinitySuggestions, readableEvidenceRationale } from "../lib/mdep-affinity-draft.ts";

const draft = [
  { direction: "costes", score: 1, rationale: "Relación indirecta documentada", evidence_ids: ["e1"] },
  { direction: "diferenciacion", score: 2, rationale: "Relación significativa documentada", evidence_ids: ["e1", "e2"] },
  { direction: "enfoque", score: 3, rationale: "Relación directa documentada", evidence_ids: ["e2"] },
];

test("recupera borradores guardados como lista y como objeto", () => {
  assert.deepEqual(parseAffinitySuggestions(JSON.stringify(draft)), draft);
  assert.deepEqual(parseAffinitySuggestions(JSON.stringify({ suggestions: draft })), draft);
});

test("un borrador inválido no se presenta como valoración", () => {
  assert.deepEqual(parseAffinitySuggestions("{invalid"), []);
  assert.deepEqual(parseAffinitySuggestions(JSON.stringify([{ direction: "costes", score: 9, rationale: "x", evidence_ids: [] }])), []);
});

test("las referencias internas se muestran con código y evidencia reconocible", () => {
  const id = "497a5d41-04cc-43b5-94f3-deb277fe8f8e";
  const evidence = new Map([[id, { factorCode: "D2", statement: "Informe técnico de mantenimiento" }]]);
  assert.equal(readableEvidenceRationale(`Equipos obsoletos (evidencia ${id}).`, evidence),
    "Equipos obsoletos (evidencia D2 · Informe técnico de mantenimiento).");
  assert.equal(readableEvidenceRationale("Equipos obsoletos (E1).", evidence, new Map([["E1", id]])),
    "Equipos obsoletos (D2 · Informe técnico de mantenimiento).");
  assert.equal(readableEvidenceRationale("Referencia 00000000-0000-0000-0000-000000000000", evidence),
    "Referencia [evidencia no identificada]");
});
