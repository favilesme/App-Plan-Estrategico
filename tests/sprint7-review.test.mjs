import test from "node:test";
import assert from "node:assert/strict";
import { BUDGET_PERIODS } from "../lib/sprint7-policy.mts";
import { DEMO_MARKER, sprint7ReviewBlockers, sprint7ReviewSubject,
  sprint7ReviewTokens } from "../lib/sprint7-review-policy.mts";

function packageFixture() {
  const cycle = { id: "cycle-1", start_date: "2026-10-01", end_date: "2029-09-30" };
  const objectives = [{ id: "objective-1", version: 2, status: "approved" }];
  const initiatives = [{ id: "initiative-1", version: 1, status: "approved",
    objective_id: "objective-1", objective_version: 2 }];
  const plans = [{ id: "plan-1", version: 1, status: "draft", initiative_id: "initiative-1",
    initiative_version: 1, objective_id: "objective-1", objective_version: 2,
    responsible_member_id: "member-1", start_date: "2026-10-01", end_date: "2027-09-30",
    milestones_json: JSON.stringify([{ date: "2027-03-15", name: `${DEMO_MARKER} Revisar piloto` }]),
    resources: `${DEMO_MARKER} Recursos ilustrativos`, risks: `${DEMO_MARKER} Riesgo ilustrativo` }];
  const kpis = [{ id: "kpi-1", version: 1, status: "draft", objective_id: "objective-1",
    objective_version: 2, formula: "ventas actuales / ventas anteriores × 100", denominator: "ventas anteriores",
    requires_denominator: 1, source: `${DEMO_MARKER} Registro ficticio`, baseline: "2", target: "6",
    frequency: "anual", responsible_member_id: "member-1", direction: "higher", tolerance: "4",
    tolerance_rationale: `${DEMO_MARKER} Límite ilustrativo` }];
  const budgets = BUDGET_PERIODS.map((period_key, index) => ({ id: `budget-${index}`, version: 1,
    status: "draft", plan_id: "plan-1", period_key, amount: "100", currency: "USD",
    source_note: `${DEMO_MARKER} Importe ilustrativo` }));
  const areas = ["Comercial", "Producto", "Operaciones"].map((name, index) => ({ id: `area-${index}`,
    version: 1, status: "draft", name: `${DEMO_MARKER} ${name}`,
    objective_ids_json: JSON.stringify(["objective-1"]) }));
  const members = [{ id: "member-1", status: "active" }];
  return { cycle, objectives, initiatives, plans, kpis, budgets, areas, members };
}

test("un conjunto ficticio completo queda listo para participación humana", () => {
  const input = packageFixture();
  assert.deepEqual(sprint7ReviewBlockers(input), []);
  assert.equal(sprint7ReviewTokens(input).length, 21);
});

test("el conjunto bloquea cobertura, versiones y procedencia ficticia incompletas", () => {
  const input = packageFixture();
  input.budgets.pop();
  assert.ok(sprint7ReviewBlockers(input).some((item) => item.includes("14 períodos")));
  input.budgets = packageFixture().budgets;
  input.kpis[0].source = "Registro sin marca";
  assert.ok(sprint7ReviewBlockers(input).some((item) => item.includes("KPI")));
  input.kpis[0].source = `${DEMO_MARKER} Registro ficticio`;
  input.plans[0].initiative_version = 2;
  assert.ok(sprint7ReviewBlockers(input).some((item) => item.includes("planes")));
});

test("una edición cambia la huella sometida a aprobación", async () => {
  const input = packageFixture();
  const before = await sprint7ReviewSubject(input.cycle.id, sprint7ReviewTokens(input));
  input.budgets[0].version += 1;
  const after = await sprint7ReviewSubject(input.cycle.id, sprint7ReviewTokens(input));
  assert.notEqual(before, after);
});

test("un gasto anterior al inicio del plan bloquea la revisión", () => {
  const input = packageFixture();
  input.plans[0].start_date = "2027-01-15";
  assert.ok(sprint7ReviewBlockers(input).some((item) => item.includes("antes del mes")));
  for (const entry of input.budgets.slice(0, 3)) entry.amount = "0";
  assert.deepEqual(sprint7ReviewBlockers(input), []);
});
