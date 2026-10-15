import assert from "node:assert/strict";
import { test } from "node:test";
import { affinityScore, directionResult, mdepRecommendation, viabilityScore } from "../lib/mdep.ts";

test("afinidad usa todas las acciones validadas en cada denominador", () => {
  const actions = [{ id: "A1", priority: 5 }, { id: "A2", priority: 4 }];
  const affinities = [{ action_id: "A1", direction: "costes", score: 3 }, { action_id: "A2", direction: "costes", score: 0 }];
  assert.equal(affinityScore(actions, affinities, "costes"), 100 * 5 / 9);
  assert.equal(affinityScore(actions, affinities, "enfoque"), null);
  assert.equal(affinityScore([{ id: "A1", priority: null }], affinities, "costes"), null);
});

test("viabilidad y 60/40 conservan decimales y falta no equivale a cero", () => {
  const actions = [{ id: "A1", priority: 3 }];
  const affinities = [{ action_id: "A1", direction: "costes", score: 2 }];
  const criteria = ["ventaja_economica", "sistema_eficiencia", "relevancia_cliente", "sostenibilidad"]
    .map((criterion_key) => ({ direction: "costes", criterion_key, score: 3 }));
  assert.equal(viabilityScore(criteria, "costes"), 75);
  const result = directionResult(actions, affinities, criteria, [{ direction: "costes", status: "met" }], "costes");
  assert.equal(result.score, 70);
  assert.equal(directionResult(actions, affinities, criteria.slice(1), [{ direction: "costes", status: "met" }], "costes").score, null);
});

test("condición obligatoria bloquea incluso un puntaje alto", () => {
  const r = directionResult([{ id: "A1", priority: 5 }], [{ action_id: "A1", direction: "costes", score: 3 }],
    ["ventaja_economica", "sistema_eficiencia", "relevancia_cliente", "sostenibilidad"].map((criterion_key) => ({ direction: "costes", criterion_key, score: 4 })),
    [{ direction: "costes", status: "pending" }], "costes");
  assert.equal(r.score, 100);
  assert.equal(r.eligible, false);
  assert.equal(mdepRecommendation([r]).direction, null);
});

test("empate y diferencia menor que diez exigen deliberación", () => {
  const a = { direction: "costes", score: 80, eligible: true };
  const b = { direction: "enfoque", score: 75, eligible: true };
  assert.equal(mdepRecommendation([a, b]).direction, null);
  assert.equal(mdepRecommendation([a, { ...b, score: 69 }]).direction, "costes");
});

test("no promociona otra dirección cuando la de mayor puntaje está bloqueada", () => {
  assert.equal(mdepRecommendation([
    { direction: "costes", score: 90, eligible: false },
    { direction: "enfoque", score: 80, eligible: true },
  ]).direction, null);
});
