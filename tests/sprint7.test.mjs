import test from "node:test";
import assert from "node:assert/strict";
import { areaIssues, BUDGET_PERIODS, budgetIssues, kpiIssues, kpiReadiness,
  parseMilestones, planIssues } from "../lib/sprint7-policy.mts";

test("un plan rechaza fechas inválidas y deja visibles sus datos pendientes", () => {
  assert.deepEqual(parseMilestones("2027-02-30 | Apertura"), { milestones: [], error: true });
  const parsed = parseMilestones("2027-04-15 | Validar capacidad\n2027-06-30 | Revisar aceptación");
  assert.equal(parsed.error, false);
  const complete = { startDate: "2027-01-01", endDate: "2027-12-31", milestones: parsed.milestones,
    resources: "Horas y capacidad a presupuestar", risks: "Rentabilidad por verificar", responsibleMemberId: "m1" };
  assert.deepEqual(planIssues(complete), []);
  assert.deepEqual(planIssues({ ...complete, endDate: "2027-03-01", resources: "" }),
    ["fechas de hitos", "recursos"]);
});

test("un KPI con denominador ausente es no calculable", () => {
  const spec = { formula: "ventas del segmento / ventas totales × 100", denominator: "",
    requiresDenominator: true, source: "ERP auditado", baseline: "12,5", target: "15",
    frequency: "trimestral", responsibleMemberId: "m1", direction: "higher",
    tolerance: "13", toleranceRationale: "Banda decidida por el cliente" };
  assert.equal(kpiReadiness(spec), "no_calculable");
  assert.deepEqual(kpiIssues({ ...spec, denominator: "ventas totales" }), []);
  assert.equal(kpiReadiness({ ...spec, denominator: "ventas totales" }), "lista_para_revision");
});

test("las tolerancias respetan el sentido y no aceptan bandas invertidas", () => {
  const base = { formula: "coste unitario", denominator: "", requiresDenominator: false,
    source: "Contabilidad", baseline: "10", target: "8", frequency: "mensual",
    responsibleMemberId: "m1", direction: "lower", tolerance: "9",
    toleranceRationale: "Aprobación pendiente" };
  assert.deepEqual(kpiIssues(base), []);
  assert.ok(kpiIssues({ ...base, tolerance: "7" }).includes("tolerancia"));
  assert.deepEqual(kpiIssues({ ...base, direction: "range", target: "8..10", tolerance: "7..11" }), []);
  assert.ok(kpiIssues({ ...base, direction: "range", target: "8..10", tolerance: "9..11" })
    .includes("tolerancia en rango"));
});

test("el presupuesto exige doce meses y dos años sin importes supuestos", () => {
  assert.equal(BUDGET_PERIODS.length, 14);
  assert.deepEqual(budgetIssues({ periodKey: "Y1-M12", amount: "0", currency: "USD",
    sourceNote: "Presupuesto aprobado por el cliente" }), []);
  assert.ok(budgetIssues({ periodKey: "Y1-M13", amount: "12.345", currency: "",
    sourceNote: "" }).includes("periodo"));
  assert.ok(budgetIssues({ periodKey: "Y2", amount: "", currency: "USD",
    sourceNote: "" }).includes("importe"));
});

test("los CMI de área requieren nombre único y objetivos aprobados", () => {
  assert.deepEqual(areaIssues({ name: "Comercial", objectiveIds: ["o1"] }, ["o1", "o2"], []), []);
  assert.ok(areaIssues({ name: "comercial", objectiveIds: ["o2"] }, ["o1", "o2"], ["Comercial"])
    .includes("área duplicada"));
  assert.ok(areaIssues({ name: "Operaciones", objectiveIds: ["unknown"] }, ["o1"], [])
    .includes("objetivo desconocido"));
});
