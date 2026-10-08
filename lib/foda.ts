import { MAX_FODA_FACTORS_PER_AXIS, MIN_VALIDATION_QUORUM } from "./methodology.ts";

export const FODA_AXES = ["F", "D", "O", "A"] as const;
export type FodaAxis = (typeof FODA_AXES)[number];
export type FactorStatus = "proposed" | "needs_clarification" | "approved" | "discarded";
export type ValidationDecision = "validated" | "doubt" | "changes_requested";

export const axisLabels: Record<FodaAxis, string> = {
  F: "Fortalezas", D: "Debilidades", O: "Oportunidades", A: "Amenazas",
};

export type FodaFactor = {
  id: string; set_id: string; cycle_id: string; axis: FodaAxis; code: string; sequence: number;
  description: string; area: string; classification_reason: string; status: FactorStatus;
  version: number; created_by_user_id: string; updated_by_user_id: string;
  created_at: string; updated_at: string;
};

export type FodaEvidence = {
  id: string; factor_id: string; evidence_type: "quantitative" | "qualitative";
  statement: string; source_type: string; source_detail: string; period: string;
  diagnostic_input_id: string | null; version: number; created_by_user_id: string;
  updated_by_user_id: string; created_at: string; updated_at: string;
};

export type FodaSet = {
  id: string; cycle_id: string; version: number; revision: number;
  status: "draft" | "frozen"; frozen_at: string | null; frozen_by_user_id: string | null;
};

export type FodaValidation = {
  id: string; set_id: string; set_version: number; revision: number; member_id: string;
  decision: ValidationDecision; rationale: string; created_at: string;
};

export type EligibleLeader = {
  id: string; display_name: string; is_leader: number; is_director: number;
  status: string; role: string;
};

export function normalizeFactor(text: string) {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

export function duplicateFactorIds(factors: FodaFactor[]) {
  const byText = new Map<string, string[]>();
  for (const factor of factors.filter((item) => item.status !== "discarded")) {
    const key = normalizeFactor(factor.description);
    if (!key) continue;
    byText.set(key, [...(byText.get(key) ?? []), factor.id]);
  }
  return new Set([...byText.values()].filter((ids) => ids.length > 1).flat());
}

export function latestValidations(records: FodaValidation[]) {
  const byMember = new Map<string, FodaValidation>();
  for (const record of records) if (!byMember.has(record.member_id)) byMember.set(record.member_id, record);
  return [...byMember.values()];
}

export function quorum(validations: FodaValidation[], leaders: EligibleLeader[]) {
  const eligible = new Map(leaders.filter((item) => item.status === "active" &&
    item.is_leader && ["owner", "admin", "leader"].includes(item.role)).map((item) => [item.id, item]));
  const current = latestValidations(validations).filter((item) => eligible.has(item.member_id));
  const participants = current.filter((item) => item.decision !== "changes_requested");
  return {
    current, participants,
    count: participants.length,
    hasDirector: participants.some((item) => eligible.get(item.member_id)?.is_director),
    hasDoubt: participants.some((item) => item.decision === "doubt"),
    hasChangesRequested: current.some((item) => item.decision === "changes_requested"),
    ready: participants.length >= MIN_VALIDATION_QUORUM &&
      participants.some((item) => eligible.get(item.member_id)?.is_director) &&
      !current.some((item) => item.decision === "changes_requested"),
  };
}

export function factorIssues(factors: FodaFactor[], evidence: FodaEvidence[]) {
  const active = factors.filter((item) => item.status !== "discarded");
  const duplicates = duplicateFactorIds(active);
  const issues: string[] = [];
  for (const axis of FODA_AXES) {
    const count = active.filter((item) => item.axis === axis).length;
    if (count === 0) issues.push(`Registra al menos un factor ${axis} para preparar las matrices FO y DA.`);
    if (count > MAX_FODA_FACTORS_PER_AXIS) issues.push(`${axis}: ${count} factores activos; el máximo para el cierre es ${MAX_FODA_FACTORS_PER_AXIS}. Depura sin borrar hallazgos.`);
  }
  for (const factor of active) {
    if (factor.status === "needs_clarification") issues.push(`${factor.code}: requiere aclaración de su clasificación o contenido.`);
    if (!factor.classification_reason.trim()) issues.push(`${factor.code}: falta explicar la clasificación.`);
    if (!evidence.some((item) => item.factor_id === factor.id)) issues.push(`${factor.code}: falta al menos una evidencia cualitativa o cuantitativa.`);
    if (duplicates.has(factor.id)) issues.push(`${factor.code}: descripción duplicada; depura antes del cierre.`);
  }
  return issues;
}
