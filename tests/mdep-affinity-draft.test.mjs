import assert from "node:assert/strict";
import { test } from "node:test";
import { parseAffinitySuggestions } from "../lib/mdep-affinity-draft.ts";

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
