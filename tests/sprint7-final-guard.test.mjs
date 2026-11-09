import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { finalApprovalInsert } from "../lib/sprint7-final-guard.mts";
import { sprint7ReviewTokens } from "../lib/sprint7-review-policy.mts";
import { BUDGET_PERIODS } from "../lib/sprint7-policy.mts";

function fixture() {
  const db = new DatabaseSync(":memory:");
  db.exec(`CREATE TABLE approvals (id TEXT PRIMARY KEY, cycle_id TEXT, gate_key TEXT,
    subject_id TEXT, status TEXT, reviewer_user_id TEXT, rationale TEXT,
    source_ids_json TEXT, methodology_version TEXT);
    CREATE TABLE strategic_objectives (id TEXT, cycle_id TEXT, status TEXT, version INTEGER);
    CREATE TABLE strategic_initiatives (id TEXT, cycle_id TEXT, status TEXT, version INTEGER,
      objective_id TEXT, objective_version INTEGER);
    CREATE TABLE execution_plans (id TEXT, cycle_id TEXT, status TEXT, version INTEGER,
      initiative_id TEXT, initiative_version INTEGER);
    CREATE TABLE kpi_specs (id TEXT, cycle_id TEXT, status TEXT, version INTEGER,
      objective_id TEXT, objective_version INTEGER);
    CREATE TABLE budget_entries (id TEXT, cycle_id TEXT, status TEXT, version INTEGER,
      plan_id TEXT, period_key TEXT);
    CREATE TABLE area_scorecards (id TEXT, cycle_id TEXT, status TEXT, version INTEGER);`);
  const cycleId = "cycle-1";
  const objectives = Array.from({ length: 5 }, (_, i) => ({ id: `o${i}`, version: 1, status: "approved" }));
  const initiatives = Array.from({ length: 6 }, (_, i) => ({ id: `i${i}`, version: 1,
    status: "approved", objective_id: objectives[i % 5].id, objective_version: 1 }));
  const plans = initiatives.map((initiative, i) => ({ id: `p${i}`, version: 2, status: "draft",
    initiative_id: initiative.id, initiative_version: 1 }));
  const kpis = objectives.map((objective, i) => ({ id: `k${i}`, version: 2, status: "draft",
    objective_id: objective.id, objective_version: 1 }));
  const budgets = plans.flatMap((plan) => BUDGET_PERIODS.map((period_key, i) => ({
    id: `${plan.id}-b${i}`, version: 2, status: "draft", plan_id: plan.id, period_key,
  })));
  const areas = Array.from({ length: 3 }, (_, i) => ({ id: `a${i}`, version: 1, status: "draft" }));
  db.exec("BEGIN");
  for (const item of objectives) db.prepare("INSERT INTO strategic_objectives VALUES (?, ?, ?, ?)")
    .run(item.id, cycleId, item.status, item.version);
  for (const item of initiatives) db.prepare("INSERT INTO strategic_initiatives VALUES (?, ?, ?, ?, ?, ?)")
    .run(item.id, cycleId, item.status, item.version, item.objective_id, item.objective_version);
  for (const item of plans) db.prepare("INSERT INTO execution_plans VALUES (?, ?, ?, ?, ?, ?)")
    .run(item.id, cycleId, item.status, item.version, item.initiative_id, item.initiative_version);
  for (const item of kpis) db.prepare("INSERT INTO kpi_specs VALUES (?, ?, ?, ?, ?, ?)")
    .run(item.id, cycleId, item.status, item.version, item.objective_id, item.objective_version);
  for (const item of budgets) db.prepare("INSERT INTO budget_entries VALUES (?, ?, ?, ?, ?, ?)")
    .run(item.id, cycleId, item.status, item.version, item.plan_id, item.period_key);
  for (const item of areas) db.prepare("INSERT INTO area_scorecards VALUES (?, ?, ?, ?)")
    .run(item.id, cycleId, item.status, item.version);
  db.exec("COMMIT");
  const tokens = sprint7ReviewTokens({ objectives, initiatives, plans, kpis, budgets, areas });
  return { db, cycleId, tokens };
}

test("la aprobación final admite 109 versiones con menos de 100 parámetros D1", () => {
  const { db, cycleId, tokens } = fixture();
  assert.equal(tokens.length, 109);
  const input = { id: "final-1", cycleId, subject: "subject-1", reviewerUserId: "director-1",
    rationale: "Aprobado para demostración comercial.", sourceIdsJson: JSON.stringify(tokens),
    methodologyVersion: "1", tokens };
  const insert = finalApprovalInsert(input);
  assert.equal(insert.values.length, 45);
  assert.equal(db.prepare(insert.sql).run(...insert.values).changes, 1);
  assert.equal(db.prepare(finalApprovalInsert({ ...input, id: "final-2" }).sql)
    .run(...finalApprovalInsert({ ...input, id: "final-2" }).values).changes, 0);
  db.close();
});

test("un cambio de versión presupuestaria impide aprobar el conjunto anterior", () => {
  const { db, cycleId, tokens } = fixture();
  db.prepare("UPDATE budget_entries SET version = 3 WHERE id = ?").run("p0-b0");
  const insert = finalApprovalInsert({ id: "stale-final", cycleId, subject: "stale-subject",
    reviewerUserId: "director-1", rationale: "Decisión sobre versión anterior.",
    sourceIdsJson: JSON.stringify(tokens), methodologyVersion: "1", tokens });
  assert.equal(db.prepare(insert.sql).run(...insert.values).changes, 0);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM approvals").get().count, 0);
  db.close();
});
