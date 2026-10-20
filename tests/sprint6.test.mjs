import test from "node:test";
import assert from "node:assert/strict";
import { bscCoverage, initiativeActionBelongsToObjective, parseIds, sourceEvidenceIds } from "../lib/sprint6-policy.mts";

test("las cuatro perspectivas BSC requieren cobertura distinta", () => {
  assert.equal(bscCoverage([{ perspective: "financiera" }, { perspective: "financiera" }]).count, 1);
  assert.deepEqual(bscCoverage(["financiera", "cliente", "procesos", "aprendizaje"]
    .map((perspective) => ({ perspective }))).missing, []);
});

test("la evidencia proviene solo de acciones vinculadas y elimina duplicados", () => {
  const actions = [
    { id: "a1", evidence_ids_json: '["e1","e2"]' },
    { id: "a2", evidence_ids_json: '["e2","e3"]' },
    { id: "a3", evidence_ids_json: '["e4"]' },
  ];
  assert.deepEqual(sourceEvidenceIds(actions, ["a1", "a2"]), ["e1", "e2", "e3"]);
  assert.deepEqual(sourceEvidenceIds(actions, ["a3"]), ["e4"]);
  assert.deepEqual(parseIds('["a1","a1"]'), ["a1"]);
});

test("la iniciativa solo puede referir acciones de su objetivo", () => {
  assert.equal(initiativeActionBelongsToObjective('["a1"]', "a1"), true);
  assert.equal(initiativeActionBelongsToObjective('["a1"]', "a2"), false);
  assert.equal(initiativeActionBelongsToObjective('malformed', "a1"), false);
});
