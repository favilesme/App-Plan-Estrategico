export type Milestone = { date: string; name: string };
export type KpiDirection = "higher" | "lower" | "range";

export function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function parseMilestones(value: string): { milestones: Milestone[]; error: boolean } {
  const milestones: Milestone[] = [];
  for (const line of value.split(/\r?\n/).map((part) => part.trim()).filter(Boolean)) {
    const match = /^(\d{4}-\d{2}-\d{2})\s*\|\s*(.{3,160})$/.exec(line);
    if (!match || !validDate(match[1])) return { milestones: [], error: true };
    milestones.push({ date: match[1], name: match[2].trim() });
  }
  return { milestones, error: false };
}

export function planIssues(input: { startDate: string; endDate: string; milestones: Milestone[];
  resources: string; risks: string; responsibleMemberId: string }): string[] {
  const issues: string[] = [];
  if (!input.responsibleMemberId) issues.push("responsable");
  if (!input.startDate || !validDate(input.startDate)) issues.push("fecha de inicio");
  if (!input.endDate || !validDate(input.endDate)) issues.push("fecha de cierre");
  if (validDate(input.startDate) && validDate(input.endDate) && input.endDate < input.startDate)
    issues.push("orden de fechas");
  if (!input.milestones.length) issues.push("hitos");
  if (input.milestones.some((item) => !validDate(item.date) || !item.name.trim() ||
    (validDate(input.startDate) && item.date < input.startDate) ||
    (validDate(input.endDate) && item.date > input.endDate))) issues.push("fechas de hitos");
  if (!input.resources.trim()) issues.push("recursos");
  if (!input.risks.trim()) issues.push("riesgos y condiciones");
  return issues;
}

function number(value: string): number | null {
  if (!value.trim() || !/^[+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+)$/.test(value.trim())) return null;
  const parsed = Number(value.trim().replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function pair(value: string): [number, number] | null {
  const parts = value.split("..");
  if (parts.length !== 2) return null;
  const low = number(parts[0]), high = number(parts[1]);
  return low !== null && high !== null && low < high ? [low, high] : null;
}

export function kpiIssues(input: { formula: string; denominator: string; requiresDenominator: boolean;
  source: string; baseline: string; target: string; frequency: string; responsibleMemberId: string;
  direction: string; tolerance: string; toleranceRationale: string }): string[] {
  const issues: string[] = [];
  if (!input.formula.trim()) issues.push("fórmula");
  if ((input.requiresDenominator || /[/÷]/.test(input.formula)) && !input.denominator.trim()) issues.push("denominador");
  if (!input.source.trim()) issues.push("fuente");
  if (number(input.baseline) === null) issues.push("línea base");
  if (!input.frequency.trim()) issues.push("frecuencia");
  if (!input.responsibleMemberId) issues.push("responsable");
  if (!["higher", "lower", "range"].includes(input.direction)) issues.push("sentido");
  if (!input.toleranceRationale.trim()) issues.push("fundamento de tolerancia");
  if (input.direction === "range") {
    const target = pair(input.target), tolerance = pair(input.tolerance);
    if (!target) issues.push("meta en rango");
    if (!tolerance || target && !(tolerance[0] < target[0] && tolerance[1] > target[1]))
      issues.push("tolerancia en rango");
  } else {
    const target = number(input.target), tolerance = number(input.tolerance);
    if (target === null) issues.push("meta");
    if (tolerance === null || target !== null && (
      input.direction === "higher" && tolerance >= target ||
      input.direction === "lower" && tolerance <= target)) issues.push("tolerancia");
  }
  return issues;
}

export function kpiReadiness(input: Parameters<typeof kpiIssues>[0]): "pendiente" | "no_calculable" | "lista_para_revision" {
  const issues = kpiIssues(input);
  if (issues.includes("denominador")) return "no_calculable";
  return issues.length ? "pendiente" : "lista_para_revision";
}

export const BUDGET_PERIODS = [
  ...Array.from({ length: 12 }, (_, index) => `Y1-M${String(index + 1).padStart(2, "0")}`),
  "Y2", "Y3",
];

export function budgetIssues(input: { periodKey: string; amount: string; currency: string; sourceNote: string }): string[] {
  const issues: string[] = [];
  if (!BUDGET_PERIODS.includes(input.periodKey)) issues.push("periodo");
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(input.amount)) issues.push("importe");
  if (!/^[A-Z]{3}$/.test(input.currency)) issues.push("moneda");
  if (!input.sourceNote.trim()) issues.push("sustento");
  return issues;
}

export function areaIssues(input: { name: string; objectiveIds: string[] },
  approvedObjectiveIds: string[], otherNames: string[]): string[] {
  const issues: string[] = [];
  if (input.name.trim().length < 3 || input.name.trim().length > 120) issues.push("nombre de área");
  if (otherNames.some((name) => name.trim().toLocaleLowerCase() === input.name.trim().toLocaleLowerCase()))
    issues.push("área duplicada");
  if (!input.objectiveIds.length) issues.push("KPI asignados");
  if (input.objectiveIds.some((id) => !approvedObjectiveIds.includes(id))) issues.push("objetivo desconocido");
  return issues;
}
