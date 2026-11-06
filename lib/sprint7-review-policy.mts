import { areaIssues, BUDGET_PERIODS, budgetIssues, kpiReadiness, planIssues, validDate } from "./sprint7-policy.mts";

export const DEMO_MARKER = "[SIMULADO PARA PRUEBA]";

export type ReviewCycle = { id: string; start_date: string; end_date: string };
export type ReviewObjective = { id: string; version: number; status: string };
export type ReviewInitiative = { id: string; version: number; status: string; objective_id: string; objective_version: number };
export type ReviewPlan = { id: string; version: number; status: string; initiative_id: string; initiative_version: number;
  objective_id: string; objective_version: number; responsible_member_id: string | null; start_date: string | null;
  end_date: string | null; milestones_json: string; resources: string; risks: string };
export type ReviewKpi = { id: string; version: number; status: string; objective_id: string; objective_version: number;
  formula: string; denominator: string; requires_denominator: number; source: string; baseline: string; target: string;
  frequency: string; responsible_member_id: string | null; direction: string; tolerance: string; tolerance_rationale: string };
export type ReviewBudget = { id: string; version: number; status: string; plan_id: string; period_key: string;
  amount: string; currency: string; source_note: string };
export type ReviewArea = { id: string; version: number; status: string; name: string; objective_ids_json: string };
export type ReviewMember = { id: string; status: string };
export type ReviewPackage = { cycle: ReviewCycle; objectives: ReviewObjective[]; initiatives: ReviewInitiative[];
  plans: ReviewPlan[]; kpis: ReviewKpi[]; budgets: ReviewBudget[]; areas: ReviewArea[]; members: ReviewMember[] };

function ids(raw: string): string[] | null {
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) && value.every((item) => typeof item === "string") ? value : null;
  } catch { return null; }
}

function milestones(raw: string): { date: string; name: string }[] | null {
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) && value.every((item) => typeof item === "object" && item !== null &&
      typeof item.date === "string" && typeof item.name === "string") ? value : null;
  } catch { return null; }
}

function current(status: string): boolean { return status === "draft" || status === "approved"; }
function active(id: string | null, members: ReviewMember[]): boolean {
  return Boolean(id && members.some((member) => member.id === id && member.status === "active"));
}

export function sprint7ReviewTokens(input: ReviewPackage): string[] {
  return [
    ...input.objectives.map((item) => `o:${item.id}:v${item.version}`),
    ...input.initiatives.map((item) => `i:${item.id}:v${item.version}:o:${item.objective_id}:v${item.objective_version}`),
    ...input.plans.map((item) => `p:${item.id}:v${item.version}:i:${item.initiative_id}:v${item.initiative_version}`),
    ...input.kpis.map((item) => `k:${item.id}:v${item.version}:o:${item.objective_id}:v${item.objective_version}`),
    ...input.budgets.map((item) => `b:${item.id}:v${item.version}:p:${item.plan_id}:${item.period_key}`),
    ...input.areas.map((item) => `a:${item.id}:v${item.version}`),
  ].sort();
}

export async function sprint7ReviewSubject(cycleId: string, tokens: string[]): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${cycleId}|${tokens.join("|")}`));
  return `sprint7.demo:${cycleId}:${Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

export function sprint7ReviewBlockers(input: ReviewPackage): string[] {
  const { cycle, objectives, initiatives, plans, kpis, budgets, areas, members } = input;
  const blockers: string[] = [];
  if (!objectives.length || objectives.some((item) => item.status !== "approved"))
    blockers.push("Los objetivos de origen deben estar aprobados.");
  if (!initiatives.length || initiatives.some((item) => item.status !== "approved" ||
    !objectives.some((objective) => objective.id === item.objective_id && objective.version === item.objective_version)))
    blockers.push("Las iniciativas deben estar aprobadas y ligadas a la versión vigente del objetivo.");

  if (plans.length !== initiatives.length || plans.some((plan) => {
    const initiative = initiatives.find((item) => item.id === plan.initiative_id);
    const items = milestones(plan.milestones_json);
    return !current(plan.status) || !initiative || plan.initiative_version !== initiative.version ||
      plan.objective_id !== initiative.objective_id || plan.objective_version !== initiative.objective_version ||
      !active(plan.responsible_member_id, members) || !items ||
      planIssues({ startDate: plan.start_date ?? "", endDate: plan.end_date ?? "", milestones: items ?? [],
        resources: plan.resources, risks: plan.risks, responsibleMemberId: plan.responsible_member_id ?? "" }).length > 0 ||
      !validDate(plan.start_date ?? "") || !validDate(plan.end_date ?? "") ||
      plan.start_date! < cycle.start_date || plan.end_date! > cycle.end_date ||
      !items.every((item) => item.name.includes(DEMO_MARKER)) ||
      !plan.resources.includes(DEMO_MARKER) || !plan.risks.includes(DEMO_MARKER);
  })) blockers.push("Faltan planes completos, vigentes o identificados como demostración.");

  if (kpis.length !== objectives.length || kpis.some((spec) => {
    const objective = objectives.find((item) => item.id === spec.objective_id);
    return !current(spec.status) || !objective || spec.objective_version !== objective.version ||
      !active(spec.responsible_member_id, members) ||
      kpiReadiness({ formula: spec.formula, denominator: spec.denominator,
        requiresDenominator: Boolean(spec.requires_denominator), source: spec.source, baseline: spec.baseline,
        target: spec.target, frequency: spec.frequency, responsibleMemberId: spec.responsible_member_id ?? "",
        direction: spec.direction, tolerance: spec.tolerance, toleranceRationale: spec.tolerance_rationale }) !== "lista_para_revision" ||
      !spec.source.includes(DEMO_MARKER) || !spec.tolerance_rationale.includes(DEMO_MARKER);
  })) blockers.push("Faltan KPI completos, vigentes o identificados como demostración.");

  const allKeys = new Set<string>();
  const currencies = new Set<string>();
  if (budgets.length !== plans.length * BUDGET_PERIODS.length || budgets.some((entry) => {
    const key = `${entry.plan_id}:${entry.period_key}`;
    const duplicate = allKeys.has(key);
    allKeys.add(key);
    currencies.add(entry.currency);
    return duplicate || !current(entry.status) || !plans.some((plan) => plan.id === entry.plan_id) ||
      budgetIssues({ periodKey: entry.period_key, amount: entry.amount, currency: entry.currency,
        sourceNote: entry.source_note }).length > 0 || !entry.source_note.includes(DEMO_MARKER);
  }) || currencies.size !== 1 || plans.some((plan) =>
    BUDGET_PERIODS.some((period) => !allKeys.has(`${plan.id}:${period}`))))
    blockers.push("El presupuesto requiere 14 períodos válidos por plan, una moneda y origen de demostración visible.");

  const firstYearMonth = cycle.start_date.slice(0, 7);
  if (plans.some((plan) => budgets.some((entry) => {
    if (entry.plan_id !== plan.id || !/^Y1-M\d{2}$/.test(entry.period_key) || !plan.start_date) return false;
    const monthIndex = Number(entry.period_key.slice(4)) - 1;
    const [year, month] = firstYearMonth.split("-").map(Number);
    const periodMonth = new Date(Date.UTC(year, month - 1 + monthIndex, 1)).toISOString().slice(0, 7);
    return periodMonth < plan.start_date.slice(0, 7) && Number(entry.amount.replace(",", ".")) !== 0;
  }))) blockers.push("Hay gasto presupuestado antes del mes de inicio del plan.");

  if (areas.length !== 3 || areas.some((area) => {
    const selected = ids(area.objective_ids_json);
    return !current(area.status) || !area.name.includes(DEMO_MARKER) || !selected ||
      areaIssues({ name: area.name, objectiveIds: selected ?? [] }, objectives.map((item) => item.id),
        areas.filter((other) => other.id !== area.id).map((other) => other.name)).length > 0 ||
      !selected.every((id) => kpis.some((spec) => spec.objective_id === id));
  })) blockers.push("Se requieren tres CMI de área válidos e identificados como demostración.");
  return blockers;
}
