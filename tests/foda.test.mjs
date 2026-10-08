import test from "node:test";
import assert from "node:assert/strict";
import { duplicateFactorIds, factorIssues, latestValidations, quorum } from "../lib/foda.ts";

const factor = (axis, number, description = `${axis} factor ${number}`) => ({
  id: `${axis}${number}`, set_id: "set", cycle_id: "cycle", axis, code: `${axis}${number}`,
  sequence: number, description, area: "Dirección", classification_reason: "Clasificación explicada",
  status: "proposed", version: 1, created_by_user_id: "u", updated_by_user_id: "u",
  created_at: "2026-10-08", updated_at: "2026-10-08",
});
const evidence = (item) => ({ id: `e${item.id}`, factor_id: item.id, evidence_type: "qualitative",
  statement: "Dato documentado", source_type: "documento", source_detail: "Informe interno",
  period: "2026", diagnostic_input_id: null, version: 1, created_by_user_id: "u",
  updated_by_user_id: "u", created_at: "2026-10-08", updated_at: "2026-10-08" });
const leaders = [
  { id: "director", display_name: "Dirección", role: "owner", is_leader: 1, is_director: 1, status: "active" },
  { id: "l2", display_name: "Líder 2", role: "leader", is_leader: 1, is_director: 0, status: "active" },
  { id: "l3", display_name: "Líder 3", role: "leader", is_leader: 1, is_director: 0, status: "active" },
  { id: "observer", display_name: "Observador", role: "observer", is_leader: 0, is_director: 0, status: "active" },
];
const vote = (member_id, decision = "validated", id = member_id) => ({
  id, set_id: "set", set_version: 1, revision: 1, member_id, decision,
  rationale: "Evidencia revisada", created_at: "2026-10-08",
});

test("FODA base requires one evidenced factor in every axis and never treats an empty axis as complete", () => {
  const factors = [factor("F", 1), factor("D", 1), factor("O", 1), factor("A", 1)];
  assert.deepEqual(factorIssues(factors, factors.map(evidence)), []);
  assert.match(factorIssues(factors.slice(0, 3), factors.slice(0, 3).map(evidence)).join(" "), /factor A/);
  assert.match(factorIssues(factors, factors.slice(0, 3).map(evidence)).join(" "), /A1: falta/);
});

test("duplicates and more than ten factors in one axis block closure without deleting records", () => {
  const factors = [factor("F", 1, "La marca es reconocida"), factor("D", 1, "LA MARCA ES RECONOCIDA"),
    factor("O", 1), factor("A", 1), ...Array.from({ length: 10 }, (_, index) => factor("F", index + 2))];
  const issues = factorIssues(factors, factors.map(evidence)).join(" ");
  assert.equal(duplicateFactorIds(factors).size, 2);
  assert.match(issues, /F: 11 factores/);
  assert.match(issues, /duplicada/);
});

test("quorum counts distinct active leaders, requires director, and routes doubts or changes", () => {
  assert.equal(quorum([vote("l2"), vote("l3"), vote("observer")], leaders).ready, false);
  const accepted = quorum([vote("director"), vote("l2"), vote("l3")], leaders);
  assert.equal(accepted.ready, true);
  assert.equal(accepted.count, 3);
  assert.equal(quorum([vote("director", "doubt"), vote("l2"), vote("l3")], leaders).hasDoubt, true);
  assert.equal(quorum([vote("director"), vote("l2", "changes_requested"), vote("l3")], leaders).ready, false);
  const latest = latestValidations([vote("l2", "doubt", "new"), vote("l2", "validated", "old")]);
  assert.equal(latest[0].decision, "doubt");
});
