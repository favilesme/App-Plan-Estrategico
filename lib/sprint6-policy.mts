export const PERSPECTIVES = ["financiera", "cliente", "procesos", "aprendizaje"] as const;
export type Perspective = typeof PERSPECTIVES[number];

export type ObjectiveDraftFields = {
  perspective: string; statement: string; desiredResult: string; strategyLink: string;
  sourceActionIds: string[]; evidenceNote: string; kpiName: string; kpiUnit: string;
  kpiDefinition: string;
};

export const OBJECTIVE_VALIDATION_MESSAGES = {
  perspective: "Selecciona una perspectiva BSC.",
  statement: "El objetivo estratégico debe tener entre 15 y 300 caracteres.",
  desired_result: "El resultado esperado debe tener entre 15 y 800 caracteres.",
  strategy_link: "Explica el vínculo con la dirección aprobada en 20 a 1000 caracteres.",
  source_action_id: "Selecciona al menos una acción aprobada que sustente el objetivo.",
  source_action_unknown: "Una acción seleccionada ya no pertenece a la estrategia aprobada. Actualiza la página y vuelve a seleccionarla.",
  evidence_note: "El fundamento de evidencia y límites debe tener entre 15 y 1000 caracteres.",
  kpi_name: "El nombre del KPI debe tener entre 3 y 150 caracteres.",
  kpi_unit: "La unidad del KPI debe tener entre 1 y 80 caracteres; % es una unidad válida.",
  kpi_definition: "Explica qué medirá el KPI en 10 a 500 caracteres.",
} as const;
export type ObjectiveValidationCode = keyof typeof OBJECTIVE_VALIDATION_MESSAGES;

export function validateObjectiveDraft(fields: ObjectiveDraftFields, availableActionIds: string[]): ObjectiveValidationCode[] {
  const issues: ObjectiveValidationCode[] = [];
  const length = (value: string, min: number, max: number) => {
    const size = value.trim().length;
    return size >= min && size <= max;
  };
  if (!PERSPECTIVES.includes(fields.perspective as Perspective)) issues.push("perspective");
  if (!length(fields.statement, 15, 300)) issues.push("statement");
  if (!length(fields.desiredResult, 15, 800)) issues.push("desired_result");
  if (!length(fields.strategyLink, 20, 1000)) issues.push("strategy_link");
  if (!fields.sourceActionIds.length) issues.push("source_action_id");
  else if (fields.sourceActionIds.some((id) => !availableActionIds.includes(id))) issues.push("source_action_unknown");
  if (!length(fields.evidenceNote, 15, 1000)) issues.push("evidence_note");
  if (!length(fields.kpiName, 3, 150)) issues.push("kpi_name");
  if (!length(fields.kpiUnit, 1, 80)) issues.push("kpi_unit");
  if (!length(fields.kpiDefinition, 10, 500)) issues.push("kpi_definition");
  return issues;
}

export function parseIds(raw: string): string[] {
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) && value.every((id) => typeof id === "string") ? [...new Set(value)] : [];
  } catch { return []; }
}

export function bscCoverage(objectives: { perspective: Perspective }[]) {
  const covered = new Set(objectives.map((item) => item.perspective));
  return { count: PERSPECTIVES.filter((item) => covered.has(item)).length,
    missing: PERSPECTIVES.filter((item) => !covered.has(item)) };
}

export function sourceEvidenceIds(actions: { id: string; evidence_ids_json: string }[], selectedIds: string[]): string[] {
  return [...new Set(actions.filter((action) => selectedIds.includes(action.id))
    .flatMap((action) => parseIds(action.evidence_ids_json)))];
}

export function initiativeActionBelongsToObjective(objectiveActionIdsJson: string, actionId: string): boolean {
  return parseIds(objectiveActionIdsJson).includes(actionId);
}
