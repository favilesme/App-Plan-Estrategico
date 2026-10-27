import test from "node:test";
import assert from "node:assert/strict";
import { reviewBlockers, reviewSourceIds, reviewSubject, reviewTokens, reviewVoteState,
  sameReviewSource } from "../lib/sprint6-review-policy.mts";

const objectives = ["financiera", "cliente", "procesos", "aprendizaje"].map((perspective, index) => ({
  id: `o${index}`, version: 1, perspective, status: "draft",
  source_action_ids_json: '["a1"]', evidence_ids_json: '["e1"]',
}));
const members = [
  { id: "m1", auth_user_id: "u1", display_name: "Directora", role: "owner", status: "active", is_leader: 1, is_director: 1 },
  { id: "m2", auth_user_id: "u2", display_name: "Líder 2", role: "leader", status: "active", is_leader: 1, is_director: 0 },
  { id: "m3", auth_user_id: "u3", display_name: "Líder 3", role: "admin", status: "active", is_leader: 1, is_director: 0 },
  { id: "m4", auth_user_id: "u4", display_name: "Observador", role: "observer", status: "active", is_leader: 0, is_director: 0 },
];
const votes = ["u1", "u2", "u3"].map((reviewer_user_id, index) => ({
  id: `v${index}`, reviewer_user_id, status: "validated", rationale: "Revisión del contenido", created_at: "hoy",
}));

test("objetivos requieren cobertura BSC y referencias de acciones aprobadas", () => {
  assert.deepEqual(reviewBlockers("objectives", objectives, [], members, ["a1"]), []);
  assert.match(reviewBlockers("objectives", objectives.slice(1), [], members, ["a1"])[0], /perspectiva/);
  assert.match(reviewBlockers("objectives", objectives, [], members, ["a2"])[0], /acciones aprobadas/);
});

test("iniciativas requieren objetivos aprobados y vínculos vigentes", () => {
  const initiative = { id: "i1", version: 1, status: "draft", objective_id: "o0", objective_version: 1,
    source_action_id: "a1", responsible_member_id: "m2" };
  assert.match(reviewBlockers("initiatives", objectives, [initiative], members, ["a1"])[0], /aprobar los objetivos/);
  const approved = objectives.map((item) => ({ ...item, status: "approved" }));
  assert.deepEqual(reviewBlockers("initiatives", approved, [initiative], members, ["a1"]), []);
  assert.match(reviewBlockers("initiatives", approved, [{ ...initiative, objective_version: 2 }], members, ["a1"])[0], /versión/);
});

test("el quórum requiere tres líderes activos, incluido el director, sin cambios solicitados", () => {
  assert.equal(reviewVoteState(votes, members).ready, true);
  assert.equal(reviewVoteState(votes.slice(1), members).ready, false);
  assert.equal(reviewVoteState([...votes.slice(1), { ...votes[0], reviewer_user_id: "u4" }], members).ready, false);
  assert.equal(reviewVoteState([{ ...votes[1], id: "nuevo", status: "changes_requested" }, ...votes], members).ready, false);
});

test("revisión queda atada a las versiones y participaciones exactas", () => {
  const tokens = reviewTokens("objectives", objectives, []);
  const source = JSON.stringify(reviewSourceIds(tokens, ["v1", "v2", "v3"]));
  assert.equal(sameReviewSource(source, tokens, ["v3", "v2", "v1"]), true);
  assert.equal(sameReviewSource(source, reviewTokens("objectives", [{ ...objectives[0], version: 2 }, ...objectives.slice(1)], []), ["v1", "v2", "v3"]), false);
  assert.match(reviewSubject("cycle", "mdep", "objectives", tokens), /^cycle:mdep:objectives:/);
});
