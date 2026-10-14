import test from "node:test";
import assert from "node:assert/strict";
import { completeScore, matrixPairs, matrixVoteState, quadrantResults, vulnerabilityResult } from "../lib/foda-matrix.ts";

const evidence = (id, factorId) => ({ id, factor_id: factorId, statement: `Evidencia ${id}` });
const factor = (axis, sequence) => ({
  id: `${axis}${sequence}`, axis, code: `${axis}${sequence}`, sequence,
  status: "approved", description: `Factor ${axis}${sequence}`,
  evidence: [evidence(`e-${axis}${sequence}`, `${axis}${sequence}`)],
});
const snapshot = { setId: "set", version: 1, revision: 0,
  factors: [factor("F", 1), factor("F", 2), factor("O", 1), factor("O", 2), factor("D", 1), factor("A", 1)] };
const cross = (quadrant, internal, external, score, evidenceIds) => ({
  id: `${quadrant}-${internal}-${external}`, matrix_id: "m", quadrant,
  internal_factor_id: internal, external_factor_id: external,
  final_score: score, final_rationale: "Impacto potencial documentado", final_evidence_ids_json: JSON.stringify(evidenceIds),
});

test("FO cruza solo F con O y DA solo D con A, sin puntuar FA ni DO", () => {
  assert.equal(matrixPairs(snapshot, "FO").length, 4);
  assert.equal(matrixPairs(snapshot, "DA").length, 1);
  assert.deepEqual(matrixPairs(snapshot, "FO").map((pair) => pair.key),
    ["FO:F1:O1", "FO:F2:O1", "FO:F1:O2", "FO:F2:O2"]);
});

test("la prioridad espera a la matriz completa y usa 4,5 inclusivo", () => {
  const scores = [cross("FO", "F1", "O1", 9, ["e-F1"]), cross("FO", "F2", "O1", 0, ["e-O1"]),
    cross("FO", "F1", "O2", 0, ["e-F1"]), cross("FO", "F2", "O2", 9, ["e-O2"])];
  assert.equal(quadrantResults(snapshot, "FO", scores.slice(0, 3)).internal[0].priority, null);
  const result = quadrantResults(snapshot, "FO", scores);
  assert.equal(result.total, 18);
  assert.equal(result.internal[0].average, 4.5);
  assert.equal(result.internal[0].priority, "P1");
  assert.equal(result.external[1].priority, "P1");
  assert.equal(result.internal[0].position, 1);
  assert.equal(result.internal[1].position, 1);
  assert.equal(quadrantResults(snapshot, "DA", [cross("DA", "D1", "A1", 3, ["e-D1"])]).internal[0].priority, "P2");
});

test("un cruce no se completa sin evidencia del par o con nota ajena a la escala", () => {
  const pair = matrixPairs(snapshot, "FO")[0];
  assert.equal(completeScore(cross("FO", "F1", "O1", 9, []), pair), false);
  assert.equal(completeScore(cross("FO", "F1", "O1", 9, ["e-D1"]), pair), false);
  assert.equal(completeScore(cross("FO", "F1", "O1", 5, ["e-F1"]), pair), false);
  assert.equal(completeScore(cross("FO", "F1", "O1", 0, ["e-F1"]), pair), true);
});

test("vulnerabilidad aplica valores y orden de zonas documentados", () => {
  assert.deepEqual(vulnerabilityResult({ impact: "Alta", probability: "Alta", action_capacity: "Baja" }),
    { impact: 100, probability: 100, actionCapacity: 25, degree: 100, zone: "Muy crítico", order: 0 });
  assert.equal(vulnerabilityResult({ impact: "Alta", probability: "Alta", action_capacity: "Alta" }).zone, "Crítico");
  assert.equal(vulnerabilityResult({ impact: "Baja", probability: "Baja", action_capacity: "Baja" }).zone, "Alerta");
  assert.equal(vulnerabilityResult({ impact: "Baja", probability: "Baja", action_capacity: "Media" }).zone, "Preparado");
});

test("quórum: tres líderes activos, con director y sin solicitud de cambios", () => {
  const leaders = [1, 2, 3].map((i) => ({ id: `l${i}`, is_leader: 1, is_director: i === 1 ? 1 : 0,
    status: "active", role: "leader" }));
  const votes = leaders.map((leader, i) => ({ id: `v${i}`, member_id: leader.id, decision: "validated" }));
  assert.equal(matrixVoteState(votes, leaders).ready, true);
  assert.equal(matrixVoteState(votes.slice(1), leaders).ready, false);
  assert.equal(matrixVoteState([{ ...votes[0], decision: "changes_requested" }, ...votes.slice(1)], leaders).ready, false);
});
